import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { inspectModuleCode, inspectModuleFile } from "./check-module.mjs";
import { createModuleTestRuntime, validateChromiumRequest } from "./module-test-runtime.mjs";

const skillRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const templateRoot = path.join(skillRoot, "assets/templates");
const templates = fs.readdirSync(templateRoot).filter((file) => file.endsWith(".js")).sort();
const fixture = (entries, functions = "function list(){ return []; }") =>
  `var WidgetMetadata={id:"fixture.catalog",title:"Fixture",version:"1.0.0",modules:${JSON.stringify(entries)}};${functions}`;

test("all eight bundled templates pass standalone declaration and function inspection", () => {
  assert.equal(templates.length, 8);
  const categories = new Set();
  for (const file of templates) {
    const result = inspectModuleFile(path.join(templateRoot, file));
    assert.deepEqual(result.errors, [], file);
    assert.deepEqual(result.warnings, [], file);
    for (const entry of result.entries) categories.add(entry.category);
  }
  assert.deepEqual([...categories].sort(), ["category", "danmu", "list", "resource", "search", "subtitle"]);
});

test("checker rejects invalid syntax, unavailable functions, categories and unsupported types", () => {
  const cases = [
    ["var WidgetMetadata = ;", /Unexpected token/],
    ["var WidgetMetadata = {};", /没有声明/],
    [fixture([{ functionName: "missing" }]), /未找到入口函数/],
    [fixture([{ functionName: "list()", type: "media_list" }]), /函数名无效/],
    [fixture([{ functionName: "list", type: "custom_ui" }]), /不支持的入口类型/],
    [fixture([{ functionName: "list", type: "category" }]), /需要同脚本/],
    [fixture([{ functionName: "list", type: "danmu", commentFunctionName: "missing" }]), /commentFunctionName/],
    [fixture([{ functionName: "list" }, { functionName: "list" }]), /id 重复/],
    [fixture([{ functionName: "list", params: [{}] }]), /缺少 name/],
    ['Widget.http.get("https://example.invalid/");' + fixture([{ functionName: "list" }]), /安装检查期间/],
  ];
  for (const [code, expected] of cases) assert.match(inspectModuleCode(code).errors.join("\n"), expected);
});

test("checker accepts supported declarations, point paths and user-filled required settings", () => {
  for (const declaration of ["var WidgetMetadata", "let WidgetMetadata", "const WidgetMetadata", "WidgetMetadata", "globalThis.WidgetMetadata", "self.WidgetMetadata"]) {
    const code = `${declaration}={id:"fixture",title:"Fixture",version:"1.0.0",
      globalParams:[{name:"apiBase",type:"string",required:true}],
      modules:[{id:"list",functionName:"api.list",params:[{name:"count",value:0},{name:"enabled",value:false}]}]};
      const api={list(){return []}};`;
    assert.deepEqual(inspectModuleCode(code).errors, [], declaration);
  }
  assert.deepEqual(inspectModuleCode(fixture([{ functionName: "resolve" }], "const resolve=async()=>[];")).errors, [],
    "the validation bootstrap must not introduce a conflicting module-scope resolve function");
});

test("bundled documents and references stay inside the installed skill", () => {
  const documents = ["SKILL.md", ...fs.readdirSync(path.join(skillRoot, "references")).filter((name) => name.endsWith(".md")).map((name) => `references/${name}`)];
  for (const document of documents) {
    const content = fs.readFileSync(path.join(skillRoot, document), "utf8");
    for (const [, link] of content.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^https?:/.test(link)) continue;
      const target = path.resolve(path.dirname(path.join(skillRoot, document)), link.split("#")[0]);
      const relative = path.relative(skillRoot, target);
      assert.ok(!relative.startsWith("..") && !path.isAbsolute(relative), `${document} escapes package: ${link}`);
      assert.ok(fs.existsSync(target), `${document} missing: ${link}`);
    }
  }
});

test("offline template supports pagination, cold multi-season details and per-target resources in fresh environments", async () => {
  const source = fs.readFileSync(path.join(templateRoot, "wwplayer-offline-catalog.js"), "utf8");
  const runtime = createModuleTestRuntime(source);
  const invoke = (name, params) => runtime.invoke(name, params);
  assert.equal((await invoke("loadCatalog", { kind: "all", page: 2, count: 1 }))[0].id, "demo-series");
  assert.deepEqual(await invoke("loadCatalog", { kind: "all", page: 3, count: 1 }), []);
  const detail = await invoke("loadDetail", "wwplayer-example://catalog/episode/demo-series-s2e2");
  assert.equal(detail.seasonNumber, 2);
  assert.equal(detail.episodeNumber, 2);
  assert.equal(detail.seasons.length, 2);
  const playbackMap = JSON.stringify({
    "demo-series-s1e1": [{ id: "main", url: "https://media.example/s1e1.mp4", headers: { "X-Target": "s1e1" } }],
    "demo-series-s2e2": [{ id: "main", url: "https://media.example/s2e2.mp4", headers: { "X-Target": "s2e2" } }],
  });
  const routes = await invoke("loadResource", { id: "demo-series-s2e2", playbackMap });
  assert.equal(routes[0].url, "https://media.example/s2e2.mp4");
  assert.equal(routes[0].headers["X-Target"], "s2e2");
  await assert.rejects(invoke("loadResource", { id: "demo-series-s1e2", playbackMap }), /填写 demo-series-s1e2/);
});

test("declaration success does not conceal a dynamically constructed Chromium-incompatible Referer", async () => {
  const code = fixture([{ id: "list", functionName: "list" }], `
    function headers(id) { return { Referer: "https://catalog.fixture.example/video/" + id + "/" }; }
    async function list() {
      const response = await Widget.http.get("https://api.fixture.example/items", { headers: headers("42") });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.data.items;
    }`);
  assert.equal(inspectModuleCode(code).scope, "declaration");
  assert.deepEqual(inspectModuleCode(code).errors, [], "the old declaration-only check cannot see runtime headers");
  let fixtureCalls = 0;
  const http = async () => {
    fixtureCalls += 1;
    return { status: 200, data: { items: [{ id: "42", title: "作品" }] } };
  };
  await assert.rejects(createModuleTestRuntime(code, { http }).invokeEntry("list"), { code: "CHROMIUM_REFERRER_POLICY" });
  assert.equal(fixtureCalls, 0, "reject incompatible metadata before dispatch");
  const corrected = code.replace('Referer: "https://catalog.fixture.example/video/" + id + "/"', 'Referer: "https://catalog.fixture.example/"');
  assert.equal((await createModuleTestRuntime(corrected, { http }).invokeEntry("list"))[0].id, "42");
  assert.equal(fixtureCalls, 1);
  assert.doesNotThrow(() => validateChromiumRequest("https://api.fixture.example/items", { Referer: "https://api.fixture.example/watch/42" }),
    "same-origin full paths must not be rejected or rewritten");
});

test("generated-source fixtures exercise list to detail to resource with fresh environments and saved settings", async () => {
  const code = fs.readFileSync(path.join(templateRoot, "wwplayer-http-catalog.js"), "utf8");
  const runtime = createModuleTestRuntime(code, {
    globalValues: { apiBase: "https://source.fixture.example/v1/", apiToken: "fixture-token" },
    http: async (request) => {
      assert.equal(request.headers.authorization, "Bearer fixture-token");
      const target = new URL(request.url);
      if (target.pathname.endsWith("/catalog")) {
        assert.equal(target.searchParams.get("page"), "2");
        assert.equal(target.searchParams.get("count"), "20");
        return { status: 200, data: { items: [{ id: "source-42", title: "来源电影", mediaType: "movie" }] } };
      }
      if (target.pathname.endsWith("/detail/source-42")) return { status: 200, data: { id: "source-42", title: "来源电影", mediaType: "movie" } };
      if (target.pathname.endsWith("/resolve")) {
        assert.equal(target.searchParams.get("id"), "source-42");
        return { status: 200, data: { sources: [{ id: "main", url: "https://media.fixture.example/42.mp4",
          headers: { Referer: "https://source.fixture.example/" } }] } };
      }
      throw new Error("Unexpected request in generated-source fixture");
    },
  });
  const items = await runtime.invokeEntry("catalog", { page: 2 });
  const detail = await runtime.invoke("loadDetail", items[0].link);
  assert.equal(detail.id, items[0].id);
  const sources = await runtime.invokeEntry("resources", { id: detail.id, type: "movie", link: items[0].link });
  assert.equal(sources[0].url, "https://media.fixture.example/42.mp4");
  validateChromiumRequest(sources[0].url, sources[0].headers);
  assert.equal(runtime.requests.length, 3);
});

test("entry parameters preserve overrides, falsy values, constants and visibility", async () => {
  const runtime = createModuleTestRuntime(`
    var WidgetMetadata={globalParams:[{name:"count",value:20},{name:"enabled",value:true}],
      modules:[{id:"values",functionName:"values",params:[
        {name:"count",type:"count",defaultValue:5},{name:"mode",enumOptions:["public","private"]},{name:"empty",enumOptions:["","set"]},
        {name:"fixed",type:"constant",value:"source"},{name:"token",required:true,belongTo:{paramName:"mode",value:["private"]}}
      ]}]};
    function values(params){return params;}
  `, { globalValues: { enabled: false, count: 30 }, sourceValues: { values: { count: 7, mode: "", empty: "" } } });
  const values = await runtime.invokeEntry("values", { count: 0, fixed: "override" });
  assert.equal(values.count, 0);
  assert.equal(values.enabled, false);
  assert.equal(values.mode, "public");
  assert.equal(values.empty, "");
  assert.equal(values.fixed, "source");
  await assert.rejects(runtime.invokeEntry("values", { mode: "private" }), /token/);
});

test("execution fixtures use fresh globals and commit only successful storage changes", async () => {
  const runtime = createModuleTestRuntime(fixture([{ functionName: "list" }], `
    var localCounter=0;
    async function list(){
      Widget.storage.set("count",Widget.storage.get("count",0)+1);
      return {local:++localCounter,saved:await Widget.storage.getAsync("count")};
    }
    function fail(){Widget.storage.set("count",99);throw new Error("fixture failure");}
  `));
  assert.deepEqual(await runtime.invoke("list", {}), { local: 1, saved: 1 });
  await assert.rejects(runtime.invoke("fail", {}), /fixture failure/);
  assert.deepEqual(await runtime.invoke("list", {}), { local: 1, saved: 2 });
});

test("missing fixture responses and swallowed HTTP failures cannot pass as empty success", async () => {
  const code = fixture([{ id: "list", functionName: "list" }], `
    async function list(){
      try {
        var response=await Widget.http.get("https://source.fixture.example/items");
        if (!response.ok) return [];
        return response.data.items;
      } catch {return [];}
    }
  `);
  await assert.rejects(createModuleTestRuntime(code).invokeEntry("list"), /缺少 HTTP 响应样本/);
  await assert.rejects(createModuleTestRuntime(code, { http: async () => ({ status: 403, data: {} }) }).invokeEntry("list"), /HTTP 403/);
});

test("point-path receivers and fetch responses retain the input and response contract", async () => {
  const runtime = createModuleTestRuntime(fixture([{ id: "list", functionName: "api.list" }], `
    const api={prefix:"owner",async list(params){
      const response=await fetch("https://source.fixture.example/query",{
        method:"POST",headers:{"X-Query":"fixture"},body:JSON.stringify(params)
      });
      const data=await response.json();
      params.changed=true;
      return {title:this.prefix+":"+data.title,url:response.url,reply:response.headers.get("X-Reply")};
    }};
  `), { http: async (request) => {
    assert.equal(request.method, "POST");
    assert.equal(request.headers["x-query"], "fixture");
    assert.equal(JSON.parse(request.body).id, "42");
    return { status: 200, headers: { "X-Reply": "ok" }, data: { title: "作品" } };
  } });
  const input = { id: "42" };
  assert.deepEqual(await runtime.invoke("api.list", input), {
    title: "owner:作品", url: "https://source.fixture.example/query", reply: "ok",
  });
  assert.deepEqual(input, { id: "42" }, "module mutations cannot modify the caller's input object");
});

test("TMDB data returns directly and the actual bundled catalogue uses declared parameters", async () => {
  const code = fs.readFileSync(path.join(templateRoot, "wwplayer-tmdb-catalog.js"), "utf8");
  const runtime = createModuleTestRuntime(code, { tmdb: async (endpoint, options) => {
    assert.equal(endpoint, "/discover/movie");
    assert.equal(options.params.page, 2);
    assert.equal(options.params.with_genres, "28");
    return { results: [{ id: 550, title: "样本电影" }] };
  } });
  const items = await runtime.invokeEntry("movies", { page: 2, genre: "28" });
  assert.equal(items[0].id, "550");
  assert.equal(items[0].title, "样本电影");
});

test("copied skill runs its CLI from an unrelated directory without WWPlayer checkout or node_modules", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wwplayer-skill-install-"));
  try {
    const installed = path.join(temporaryRoot, "skills/wwplayer-module-maker");
    fs.cpSync(skillRoot, installed, { recursive: true });
    const checked = spawnSync(process.execPath, [
      path.join(installed, "scripts/check-module.mjs"), path.join(installed, "assets/templates"), "--json",
    ], { cwd: temporaryRoot, encoding: "utf8" });
    assert.equal(checked.status, 0, checked.stderr);
    const results = JSON.parse(checked.stdout);
    assert.equal(results.length, 8);
    assert.ok(results.every((result) => result.errors.length === 0));
    const invalid = path.join(temporaryRoot, "invalid.js");
    fs.writeFileSync(invalid, fixture([{ functionName: "missing" }]));
    const failed = spawnSync(process.execPath, [path.join(installed, "scripts/check-module.mjs"), invalid, "--json"], {
      cwd: temporaryRoot, encoding: "utf8",
    });
    assert.equal(failed.status, 1);
    assert.match(JSON.parse(failed.stdout)[0].errors.join("\n"), /未找到入口函数/);
  } finally {
    assert.equal(path.dirname(path.resolve(temporaryRoot)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporaryRoot).startsWith("wwplayer-skill-install-"));
    fs.rmSync(temporaryRoot, { recursive: true });
  }
});

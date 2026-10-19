import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { inspectModuleCode, inspectModuleFile } from "./check-module.mjs";

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
  const invoke = async (name, params) => {
    const context = vm.createContext({ URL });
    new vm.Script(source).runInContext(context);
    context.callParams = params;
    return JSON.parse(JSON.stringify(await new vm.Script(`${name}(callParams)`).runInContext(context)));
  };
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

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";

const functionPath = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
const categories = new Map([
  ["media_list", "list"], ["list", "list"], ["video", "list"], ["calendar", "list"],
  ["search", "search"], ["category", "category"], ["resource", "resource"], ["stream", "resource"],
  ["subtitle", "subtitle"], ["danmu", "danmu"], ["danmaku", "danmu"],
]);
const record = (value) => value && typeof value === "object" && !Array.isArray(value);

export function inspectModuleCode(code, file = "module.js") {
  const result = { file, id: "", title: "", version: "", entries: [], detail: false, errors: [], warnings: [] };
  try {
    if (!code.trim()) throw new Error("脚本为空。");
    if (Buffer.byteLength(code, "utf8") > 512 * 1024) throw new Error("脚本超过 512 KiB。");
    new vm.Script(code, { filename: file });
    const unavailable = (name) => () => { throw new Error(`安装检查期间不能调用宿主业务 API：${name}`); };
    const context = vm.createContext({
      URL, URLSearchParams, TextEncoder, TextDecoder, atob, btoa,
      console: { log() {}, info() {}, warn() {}, error() {} },
      fetch: unavailable("fetch"),
      Widget: {
        http: Object.fromEntries(["get", "post", "request"].map((name) => [name, unavailable(`Widget.http.${name}`)])),
        tmdb: { get: unavailable("Widget.tmdb.get") },
        html: { load: unavailable("Widget.html.load") },
        dom: Object.fromEntries(["parse", "select", "text", "attr", "remove"].map((name) => [name, unavailable(`Widget.dom.${name}`)])),
        storage: { get: (_key, fallback) => fallback, getAsync: async (_key, fallback) => fallback,
          set: unavailable("Widget.storage.set"), remove: unavailable("Widget.storage.remove") },
        sharedCache: { get: () => undefined, set: unavailable("Widget.sharedCache.set"), remove: unavailable("Widget.sharedCache.remove") },
      },
    });
    context.self = context;
    const bootstrap = `(function() {\n${code}\nreturn {
      metadata: typeof WidgetMetadata !== "undefined" ? WidgetMetadata : globalThis.WidgetMetadata,
      has: function(name) {
        try {
          var parts = name.split("."), target = eval(parts.shift());
          for (var part of parts) target = target[part];
          return typeof target === "function";
        } catch { return false; }
      }
    }; }).call(globalThis)`;
    context.__wwpSkillLoaded = new vm.Script(bootstrap, { filename: file }).runInContext(context, { timeout: 1000 });
    const metadata = context.__wwpSkillLoaded.metadata;
    if (!record(metadata)) throw new Error("没有找到对象形式的 WidgetMetadata。");
    const has = (name) => functionPath.test(name) && new vm.Script(`__wwpSkillLoaded.has(${JSON.stringify(name)})`).runInContext(context, { timeout: 1000 });
    result.id = String(metadata.id || "");
    result.title = String(metadata.title || metadata.name || "");
    result.version = String(metadata.version || "");
    if (!result.id) result.warnings.push("建议显式声明稳定的模块 id。");
    if (!result.title) result.warnings.push("建议显式填写 title。");
    if (!/^\d+\.\d+\.\d+$/.test(result.version)) result.warnings.push("分享时使用三段数字 version。");
    const parameters = (raw, label) => {
      if (raw === undefined) return;
      if (!Array.isArray(raw)) {
        if (record(raw)) result.warnings.push(`${label} 推荐使用参数对象数组。`);
        else result.errors.push(`${label} 必须是数组或参数映射。`);
        return;
      }
      const names = new Set();
      for (const parameter of raw) {
        if (!record(parameter) || typeof parameter.name !== "string" || !parameter.name.trim()) {
          result.errors.push(`${label} 存在缺少 name 的参数。`);
          continue;
        }
        if (names.has(parameter.name)) result.errors.push(`${label} 参数名重复：${parameter.name}`);
        names.add(parameter.name);
        if (parameter.belongTo !== undefined && (!record(parameter.belongTo) || !parameter.belongTo.paramName)) {
          result.errors.push(`${label}.${parameter.name} 的 belongTo 缺少 paramName。`);
        }
      }
    };
    parameters(metadata.globalParams, "globalParams");
    const modules = metadata.modules ?? metadata.dataSources ?? [];
    if (!Array.isArray(modules)) throw new Error("modules 必须是数组。");
    const searches = metadata.search ? (Array.isArray(metadata.search) ? metadata.search : [metadata.search]) : [];
    const entries = [...modules.map((entry) => ({ entry, search: false })), ...searches.map((entry) => ({ entry, search: true }))];
    if (!entries.length) result.errors.push("没有声明可调用的入口。");
    const ids = new Set();
    for (const { entry, search } of entries) {
      if (!record(entry)) {
        result.errors.push("入口必须是对象。");
        continue;
      }
      const name = String(entry.functionName || entry.methodName || "");
      const id = String(entry.id || name);
      const type = String(entry.type || "media_list").trim().toLowerCase();
      const category = categories.get(type);
      if (!category) result.errors.push(`不支持的入口类型：${type}`);
      if (!functionPath.test(name)) result.errors.push(`入口函数名无效：${name || "(缺失)"}`);
      else if (!has(name)) result.errors.push(`未找到入口函数：${name}`);
      if (ids.has(id)) result.errors.push(`入口 id 重复：${id}`);
      ids.add(id);
      parameters(entry.params ?? entry.parameters, `入口 ${id} 的 params`);
      if (category === "danmu") {
        for (const field of ["episodeFunctionName", "commentFunctionName"]) {
          if (entry[field] !== undefined && !has(String(entry[field]))) result.errors.push(`${field} 未找到可调用函数：${entry[field]}`);
        }
      }
      result.entries.push({ id, type, category: search && category === "list" ? "search" : category, functionName: name });
    }
    if (result.entries.some((entry) => entry.category === "category") && !result.entries.some((entry) => entry.category === "list")) {
      result.errors.push("分类入口需要同脚本的内容列表入口。");
    }
    result.detail = has("loadDetail");
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }
  return result;
}

export function inspectModuleFile(file) {
  try {
    return inspectModuleCode(fs.readFileSync(file, "utf8"), file);
  } catch (error) {
    return { file, id: "", title: "", version: "", entries: [], detail: false, errors: [error.message], warnings: [] };
  }
}

function main(args) {
  const usage = "用法：node check-module.mjs <模块.js 或模板目录> [更多文件...] [--json]";
  if (args.includes("--help")) { console.log(usage); return; }
  const json = args.includes("--json");
  const inputs = args.filter((arg) => arg !== "--json");
  if (!inputs.length) { console.error(usage); process.exitCode = 2; return; }
  const files = inputs.flatMap((input) => {
    if (!fs.existsSync(input) || !fs.statSync(input).isDirectory()) return [input];
    const found = fs.readdirSync(input).filter((file) => file.endsWith(".js")).sort().map((file) => path.join(input, file));
    if (!found.length) throw new Error(`目录没有 JS 模块：${input}`);
    return found;
  });
  const results = files.map(inspectModuleFile);
  if (json) console.log(JSON.stringify(results, null, 2));
  else for (const result of results) {
    console.log(`${result.errors.length ? "FAIL" : "PASS"} ${result.file} · ${result.entries.length} 个入口`);
    for (const message of result.errors) console.error(`  错误：${message}`);
    for (const message of result.warnings) console.log(`  建议：${message}`);
  }
  if (results.some((result) => result.errors.length)) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

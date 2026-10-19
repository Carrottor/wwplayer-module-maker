# 验证本次模块，而不只是模板

本页在用途与能力明确后读取。保留分步问答和可选认证，不为没有选择的功能添加验收负担。

## 1. 先确定可验证路径

生成前了解来源的实际响应和宿主可表达的输出。影视资源尤其要确认：返回独立媒体还是分离音视频 / 多段文件，地址是否临时有效，接口与媒体分别需要哪些请求头。不能写完后才发现宿主无法表达该资源。

按本次选定能力安排最小测试：列表 / 搜索验证默认配置与分页；详情用实际返回的 link；资源沿用实际条目身份和季集号；字幕检查独立文件地址；弹幕检查作品、分集与内容的连接。合法空结果和错误分开检查，不把所有模块都变成完整影视源。

接口字段以已核对的样本和文档为准。不要用猜测增加一批必填条件，再用同样猜测的假数据证明实现正确。样本应脱敏；Cookie / Token 仍可由用户以后在本地填写。

## 2. 区分验证层级

| 证据 | 能证明什么 | 不能替代什么 |
| --- | --- | --- |
| declaration：语法与声明检查 | 脚本可解析，入口存在，参数形状可检查 | 业务入口执行 |
| fixture-execution：实际脚本 + 响应样本 | 函数、参数、身份连接、映射与已建模的宿主限制 | 真实来源和完整宿主 |
| 真实 API 请求 | 当前网络与认证下能取得真实数据 | 目标应用的请求策略、媒体可读性 |
| Electron / WWPlayer 请求通路 | 应用传输能发送该请求，媒体能按给定请求头读取 | 播放器首帧、声音、拖动 |
| WWPlayer 播放器验收 | 已实际观察的播放行为 | 未测试的线路、目标或账号 |

`node scripts/check-module.mjs` 输出 DECLARATION PASS；JSON 的 scope 为 declaration。它不执行函数内的请求，也不会证明某个视频可以播放。`node --test scripts/test-package.mjs` 检查 skill 自身，不能冒充新模块的测试。

## 3. 为生成脚本写最小行为测试

从安装目录的 `scripts/module-test-runtime.mjs` 导入工具。`createModuleTestRuntime(code, options)` 提供：

- `metadata`：真实脚本的元数据。
- `invokeEntry(id, overrides)`：合并声明默认值、globalValues、sourceValues 与本次参数后调用入口。
- `invoke(functionName, input)`：直接调用约定函数，详情 input 是原始 link 字符串。
- `requests`：已执行请求的测试记录，默认不打印；不要把带真实凭据的记录公开。
- 每次调用都建立新 JS 环境；成功的私有存储 / 共享缓存变更可供下一次调用使用，失败变更不提交。
- HTTP 与 TMDB 必须显式提供响应样本；不自动联网。HTML/DOM 等未提供的适配器会明确报错，不假装实现完整宿主。

以下演示 JSON 内容接口配方。改造其他来源时替换真实入口、参数与已核对的样本；文件路径必须指向**本次生成的 JS**：

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const skillDirectory = "<安装的 skill 目录>";
const { createModuleTestRuntime, validateChromiumRequest } = await import(
  pathToFileURL(path.join(skillDirectory, "scripts/module-test-runtime.mjs")).href
);
const code = fs.readFileSync(new URL("./my-module.js", import.meta.url), "utf8");

test("本次模块：列表到详情和资源", async () => {
  const runtime = createModuleTestRuntime(code, {
    globalValues: { apiBase: "https://source.fixture.example/v1/" },
    http: async (request) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/catalog")) {
        return { status: 200, data: { items: [{ id: "film-42", title: "样本影片" }] } };
      }
      if (url.pathname.endsWith("/detail/film-42")) {
        return { status: 200, data: { id: "film-42", title: "样本影片", mediaType: "movie" } };
      }
      if (url.pathname.endsWith("/resolve")) {
        assert.equal(url.searchParams.get("id"), "film-42");
        return { status: 200, data: { sources: [{
          id: "main", url: "https://media.fixture.example/42.mp4",
          headers: { Referer: "https://source.fixture.example/" }
        }] } };
      }
      throw new Error("样本没有覆盖这条实际请求");
    }
  });
  const items = await runtime.invokeEntry("catalog");
  assert.equal(items[0].id, "film-42");
  const detail = await runtime.invoke("loadDetail", items[0].link);
  const sources = await runtime.invokeEntry("resources", {
    id: detail.id, type: "movie", link: items[0].link
  });
  assert.equal(sources.length, 1);
  for (const source of sources) validateChromiumRequest(source.url, source.headers);
});
```

还应按实际能力测试第二页、末页、失败，以及另一个目标的身份 / 请求头不串用。来源只返回字幕或弹幕时，对应测试自己的入口和内容即可，不照搬影视链路。

这些工具的范围是常见原生声明、请求样本和存储行为。没有实现完整 DOM、浏览器认证、网络重定向、代理、取消、媒体解码或应用 UI。不要据此声称跑过真实 Worker 或播放器。

## 4. 请求元数据要经过目标传输检查

Electron 默认 referrerPolicy 为 strict-origin-when-cross-origin，说明见官方 [ClientRequest 文档](https://www.electronjs.org/docs/latest/api/client-request)。本包的 `validateChromiumRequest(url, headers)` 建模其关键限制：

- 跨来源 Referer 携带完整路径 / 查询可能在默认 Chromium 请求通路触发 `net::ERR_BLOCKED_BY_CLIENT`。
- 如果来源接受根地址，可显式使用其 origin 加 `/`，再做验证。
- 同来源完整 Referer 路径可以合法使用。不能将所有 Referer 一律截断，也不能为让测试通过而删除来源真正需要的头。
- 来源确实要求与宿主策略冲突的完整引用时，说明需要解决的宿主能力；模块不能靠 Node 请求成功掩盖应用失败。

这个检查会在 fixture HTTP 调用前执行。资源入口返回的线路也要显式检查，因为媒体读取使用的 URL / 请求头与列表 API 不同。它不等于已读取真实媒体；仍需按实际条件通过宿主请求检查状态、内容类型 / 文件头及必要的 Range。

案例边界来自真实 Electron 本地回归：跨来源完整路径失败，根地址成功，同来源完整路径成功。公开回归使用虚构来源，不绑定某个站点或用户影片。

## 5. 首次交付与修复

交付说明分别列出声明、执行样本、真实 API、实际宿主请求、播放器五个层级的结果，只填写真实完成的部分。缺少某层环境时如实写明，不能把“未测”改成“通过”。

失败后先比较最后成功层与第一失败层：接口、请求参数、请求头、重定向、响应形状、来源身份与资源格式。不要一遇到访问失败就要求 Cookie，也不默认换站、重试、降级或裁剪请求头。

修正后重新运行本次模块最小行为测试，并保留一个可复现原错误的回归样本。不要只增加“以后要小心”的文字。

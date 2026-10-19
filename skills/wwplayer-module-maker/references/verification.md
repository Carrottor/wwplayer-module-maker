# 验证本次模块，而不只是模板

本页在用途与能力明确后读取。保留分步问答和可选认证，不为没有选择的功能添加验收负担。

## 按可用工具验证，不要求用户具备开发环境

验证由 AI 在其工具允许的范围内完成。手机用户可能使用有云端执行能力的 AI，桌面用户也可能只有纯聊天；判断依据是当前工具，不是用户设备。环境判断不新增启动选项或固定必答题。

| 当前条件 | 应完成的工作 | 交付时说明 |
| --- | --- | --- |
| 可执行代码，有来源和宿主环境 | 执行本次模块的最小测试，继续核对真实来源及应用通路 | 分别记录实际完成的层级 |
| 可执行代码，但无网络或宿主 | 声明和样本执行；已有资料支持的协议核对 | 样本通过不等于真实来源 / 宿主通过 |
| 可阅读资料，但没有执行工具或获准执行权限 | 契约与代码审阅，追踪参数、函数、返回值及消费方 | 标明未自动执行，不宣称语法 / 行为测试通过 |
| 只有文本输出，没有文件工具 | 提供完整可保存 JS、文件名和简短说明 | 不虚构已写入本地文件 |

没有执行条件也可以交付资料足够支持的模块，不强制安装 Node、Electron、源码或提供认证。缺少的是决定实现的来源协议时，才询问那一项资料；资料不足以完成真实接入时，明确交付模板 / 草稿，不能编造接口。

参考资料也无法读取时，不声称已经阅读；先使用对话已有信息，仅在缺少决定性协议时索取相关片段，不要求手机用户准备整套开发仓库。

AI 已有工具且获准时，应自行完成能做的验证，不把任务转交用户；执行受限时继续可完成的审阅，不反复绕过限制。已执行并失败的检查必须保留失败结论，不能改标“无环境”或靠切换通路冒充通过。

用户愿意实机反馈时只给最短的可选观察步骤，例如导入后能否看到首屏、点击能否出画面；不把反馈设为制作前置条件。没有反馈时仍可交付，只说明还未实机验证。

编写设备、AI 的工具环境、目标播放器分别判断。如果用户仅在手机上与 AI 对话，不因此改变目标模块契约。目标播放器确为移动端且接口尚不明确时，再确认其契约；默认 Chromium 请求限制不能自动套用到所有手机宿主。

## 1. 先确定可验证路径

生成前了解来源的实际响应和宿主可表达的输出。影视资源尤其要确认：返回独立媒体还是分离音视频 / 多段文件，地址是否临时有效，接口与媒体分别需要哪些请求头。不能写完后才发现宿主无法表达该资源。

有执行环境时按本次能力安排最小测试：列表 / 搜索验证默认配置与分页；详情用实际返回的 link；资源沿用实际条目身份和季集号；字幕检查独立文件地址；弹幕检查作品、分集与内容的连接。无法执行时沿同一路径做代码与契约核对。合法空结果和错误分开检查，不把所有模块都变成完整影视源。

接口字段以已核对的样本和文档为准。不要用猜测增加一批必填条件，再用同样猜测的假数据证明实现正确。样本应脱敏；Cookie / Token 仍可由用户以后在本地填写。

## 2. 区分验证层级

| 证据 | 支持的结论 | 不能替代什么 |
| --- | --- | --- |
| 代码 / 契约审阅，无执行 | 已按现有资料核对声明、调用与数据连接 | 编译、行为执行或真实来源可用 |
| declaration：语法与声明检查 | 脚本可解析，入口存在，参数形状可检查 | 业务入口执行 |
| fixture-execution：实际脚本 + 响应样本 | 函数、参数、身份连接、映射与已建模的宿主限制 | 真实来源和完整宿主 |
| 真实 API 请求 | 当前网络与认证下能取得真实数据 | 目标应用的请求策略、媒体可读性 |
| Electron / WWPlayer 请求通路 | 应用传输能发送该请求，媒体能按给定请求头读取 | 播放器首帧、声音、拖动 |
| WWPlayer 播放器验收 | 已实际观察的播放行为 | 未测试的线路、目标或账号 |

`node scripts/check-module.mjs` 输出 DECLARATION PASS；JSON 的 scope 为 declaration。它不执行函数内的请求，也不会证明某个视频可以播放。`node --test scripts/test-package.mjs` 检查 skill 自身，不能冒充新模块的测试。

## 3. 有执行环境时，为生成脚本写最小行为测试

本节的 Node 工具是可用环境中的验证方式，不要求手机或纯聊天用户安装。没有这些工具时继续进行上一节的代码 / 契约审阅，并如实交付。

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
  // 这些线路若经 Chromium 探测 / 读取，则检查该通路的请求元数据。
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

这个检查会在 fixture HTTP 调用前执行。资源入口返回的线路要按实际探测和播放后端分别验证，因为媒体读取使用的 URL / 请求头与列表 API 不同。只有会经 Chromium 发送的请求才适用这份策略检查；不能据此判定 mpv 等其他后端的一切完整 Referer 都无效，也不能统一裁剪它们。

元数据检查不等于已读取真实媒体；仍需按实际条件通过目标宿主请求检查状态、内容类型 / 文件头及必要的 Range。

案例边界来自真实 Electron 本地回归：跨来源完整路径失败，根地址成功，同来源完整路径成功。公开回归使用虚构来源，不绑定某个站点或用户影片。

## 5. 首次交付与修复

交付说明只需简短写出本次做过和没做过的检查，按适用层级说明，不必给所有用户输出一张未测试清单。纯聊天可写“已按契约和样本审阅；没有代码执行环境，自动测试与实机播放未验证”。缺少环境不是拒绝制作的理由，也不能把“未测”改为“通过”。

失败后先比较最后成功层与第一失败层：接口、请求参数、请求头、重定向、响应形状、来源身份与资源格式。不要一遇到访问失败就要求 Cookie，也不默认换站、重试、降级或裁剪请求头。

修正后有执行条件就重跑本次模块最小行为测试并保留回归样本；无法执行时重新追踪原错误路径及其调用方，并保留可供以后运行的样本或明确复现描述。不要把无执行条件伪装为通过，也不要仅追加“以后要小心”。

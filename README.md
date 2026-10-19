# WWPlayer Module Maker

为 WWPlayer 制作模块的独立 Agent Skill，内置开发指南、迁移说明、8 个 JS 模板、声明检查及入口执行测试工具。无需获取 WWPlayer 源码或安装客户端开发依赖。

按影视内容、字幕、弹幕三类用途提供制作向导；列表、分类、搜索、详情、季集和播放解析等能力按需组合。接口基线为 WWPlayer 宿主契约 7。

## 快速安装

### Codex 一条命令安装

先安装 Node.js 22+，然后运行：

```bash
npx skills add Carrottor/wwplayer-module-maker --skill wwplayer-module-maker -a codex -g -y
```

这是 Vercel 的第三方 `skills` CLI。去掉 `-g` 安装到当前项目；其他 Agent 的安装目标按该 CLI 的支持情况选择。

### 使用 Codex 内置安装 skill

在 Codex 中发送：

```text
使用 $skill-installer 安装这个 skill：
https://github.com/Carrottor/wwplayer-module-maker/tree/main/skills/wwplayer-module-maker
```

或者把仓库的整个 `skills/wwplayer-module-maker` 文件夹放入项目 `.agents/skills/`。保留文件夹内的 references、assets 和 scripts；只复制 SKILL.md 会缺少资料。

## 使用

安装后在新一轮对话中发送：

```text
$wwplayer-module-maker
```

skill 先了解想做影视内容、字幕还是弹幕模块，再逐步了解所需能力和来源。影视内容可只提供资料或片单，也可提供可播放来源；搜索、分类、分页、多线路等在选定用途后按需补充，不作为同级模块类型。

可以自然描述需求或组合不同用途，不另设“综合模块”一类。每轮只补充关键问题，不要求一次性准备全部资料；独立搜索或纯播放资源也能制作，不强加整套影视站能力。

Cookie、Token、API Key、自定义请求头及登录认证只在可能相关时提示，可按需保留本地配置，不是固定必答题。来源确实需要认证的接口仍会说明实际要求及待验证部分。

已有完整需求、来源或 JS 时也可以直接给出，skill 会沿用已知信息继续制作，不重复问答。首次交付前会针对生成的 JS 做最小行为测试，输出模块、测试与使用说明，分别说明来源、宿主及播放器验证到哪里。

skill 安装到 AI 编程工具中；生成的 JS 才是导入播放器的模块。

## 包含内容

- [完整开发指南](skills/wwplayer-module-maker/references/development-guide.md)：声明、参数、网络、缓存、详情、季集、资源、字幕和弹幕。
- [制作配方](skills/wwplayer-module-maker/references/recipes.md)：按确认的能力映射技术入口并选择模板。
- [问答指引](skills/wwplayer-module-maker/references/interview.md)：先明确用途，再逐步了解能力和来源。
- [迁移说明](skills/wwplayer-module-maker/references/migration.md)：外部 Widget 与 WWPlayer 的接口差异。
- [验证与交付](skills/wwplayer-module-maker/references/verification.md)：验证本次生成模块，区分声明、执行样本、真实接口和应用消费。
- [8 个可导入模板](skills/wwplayer-module-maker/assets/templates/)：离线目录、公共元数据、JSON、HTML、纯资源、字幕、弹幕及组合来源。
- [声明检查](skills/wwplayer-module-maker/scripts/check-module.mjs)：无需 npm 依赖，检查脚本语法、声明与函数。
- [入口执行测试](skills/wwplayer-module-maker/scripts/module-test-runtime.mjs)：用响应样本执行真实函数，检查参数、存储与默认 Chromium Referer 限制。

## 本地检查

克隆本仓库后，使用 Node.js 22+：

```bash
npm test
node skills/wwplayer-module-maker/scripts/check-module.mjs skills/wwplayer-module-maker/assets/templates
node skills/wwplayer-module-maker/scripts/check-module.mjs ./my-module.js --json
```

安装后的工具在 skill 自己的 scripts 目录中，也可以从任意工作目录通过绝对路径调用。无需运行 npm install。

声明检查输出 DECLARATION PASS，只执行脚本顶层，不执行业务入口。包自身 npm test 通过也不能替代新模块的测试。入口测试工具不自动联网，并非完整宿主或安全沙箱，只用于自己制作或已审阅的代码。

生成的模块需要自己的行为测试；列表、详情、资源应沿用返回的实际身份，API 与媒体请求头分别验证。Node/curl 请求成功不能替代 Electron/WWPlayer 验证，返回播放 URL 不等于已有画面、声音或可拖动。具体例子见验证与交付指南。

示例不附带内容服务、视频文件或账号。离线示例的浏览和详情无需网络，播放时填写自己的媒体 URL；其他模板按实际来源适配接口。

## 更新与许可

使用第三方 CLI 安装的用户可以更新已安装的 skills：

```bash
npx skills update
```

重新分发模板或生成自己的模块时，更换示例的模块 ID；更新已有模块则保留自己的稳定 ID。

MIT License，见 [LICENSE](LICENSE)。

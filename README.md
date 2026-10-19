# WWPlayer Module Maker

为 WWPlayer 制作模块的独立 Agent Skill，内置开发指南、迁移说明、8 个 JS 模板和基础校验工具。无需获取 WWPlayer 源码或安装客户端开发依赖。

支持媒体列表、片单、专题、分类、搜索、电影 / 多季剧集、播放资源、字幕和弹幕。接口基线为 WWPlayer 宿主契约 7。

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

skill 会先展示可制作的类型：榜单 / 片单 / 专题、分类浏览、影视搜索、完整影视内容源、播放资源、字幕、弹幕或综合模块。选定后再逐步了解来源与功能，每轮只补充关键问题，不要求一次性准备全部资料。

Cookie、Token、API Key、自定义请求头及登录认证只在可能相关时提示，可按需保留本地配置，不是固定必答题。来源确实需要认证的接口仍会说明实际要求及待验证部分。

已有完整需求、来源或 JS 时也可以直接给出，skill 会沿用已知信息继续制作，不重复问答。输出为本地 JS 与使用说明，之后在 WWPlayer 的“设置 → 模块”中导入。

skill 安装到 AI 编程工具中；生成的 JS 才是导入播放器的模块。

## 包含内容

- [完整开发指南](skills/wwplayer-module-maker/references/development-guide.md)：声明、参数、网络、缓存、详情、季集、资源、字幕和弹幕。
- [制作配方](skills/wwplayer-module-maker/references/recipes.md)：按目标选择模板。
- [问答指引](skills/wwplayer-module-maker/references/interview.md)：先选类型，再逐步了解来源和关键行为。
- [迁移说明](skills/wwplayer-module-maker/references/migration.md)：外部 Widget 与 WWPlayer 的接口差异。
- [8 个可导入模板](skills/wwplayer-module-maker/assets/templates/)：离线目录、公共元数据、JSON、HTML、纯资源、字幕、弹幕及组合来源。
- [基础校验工具](skills/wwplayer-module-maker/scripts/check-module.mjs)：无需 npm 依赖，检查脚本语法、声明与函数。

## 本地检查

克隆本仓库后，使用 Node.js 22+：

```bash
npm test
node skills/wwplayer-module-maker/scripts/check-module.mjs skills/wwplayer-module-maker/assets/templates
node skills/wwplayer-module-maker/scripts/check-module.mjs ./my-module.js --json
```

安装后的工具在 skill 自己的 scripts 目录中，也可以从任意工作目录通过绝对路径调用。无需运行 npm install。

检查器会执行被检查脚本的顶层，适用于自己制作或已审阅的代码，不是宿主沙箱；宿主业务 API 不可用。基础检查通过不等于真实接口、媒体播放或字幕装载已验收，最终按指南在 WWPlayer 中检查对应使用路径。

示例不附带内容服务、视频文件或账号。离线示例的浏览和详情无需网络，播放时填写自己的媒体 URL；其他模板按实际来源适配接口。

## 更新与许可

使用第三方 CLI 安装的用户可以更新已安装的 skills：

```bash
npx skills update
```

重新分发模板或生成自己的模块时，更换示例的模块 ID；更新已有模块则保留自己的稳定 ID。

MIT License，见 [LICENSE](LICENSE)。

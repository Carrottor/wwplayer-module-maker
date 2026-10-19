# 按已确认的能力选择制作配方

本页是开发者的实现配方索引，不是启动时展示的模块类型。先通过问答明确影视内容、字幕或弹幕用途及所需能力，再选择以下配方。本页所有模板随 skill 提供，完整字段见[开发指南](development-guide.md)。

## 选择

| 实现目标 / 能力 | 模板起点 | 技术入口组合 |
| --- | --- | --- |
| 静态片单、离线协议演示 | [离线目录](../assets/templates/wwplayer-offline-catalog.js) | 按需求保留列表 / 搜索 / 详情 |
| 榜单、专题与分类 | [公共元数据目录](../assets/templates/wwplayer-tmdb-catalog.js) | 列表，按需加分类与搜索 |
| 自有电影及剧集内容源 | [JSON 内容接口](../assets/templates/wwplayer-http-catalog.js) + 离线目录的季集结构 | 列表 + 详情，按需加资源 / 搜索 / 分类 |
| 为现有详情增加播放版本 | [资源接口](../assets/templates/wwplayer-resource-api.js) | resource |
| 增加在线字幕来源 | [字幕接口](../assets/templates/wwplayer-subtitle-api.js) | subtitle |
| 增加弹幕来源 | [弹幕接口](../assets/templates/wwplayer-danmaku-api.js) | danmu，按需声明两步后续函数 |
| 同一服务的字幕与弹幕 | [组合接口](../assets/templates/wwplayer-subtitle-danmaku.js) | subtitle + danmu |
| HTML 电影站 | [HTML 来源](../assets/templates/wwplayer-html-catalog.js) | 列表 + 搜索 + loadDetail |

## 影视内容：列表、分类和搜索

先确定来源能提供公共媒体身份，还是自己的详情引用。公共元数据条目使用确切 ID；自有来源保留原始 ID 与 link。用户只需片单时，无需增加资源入口。

分类返回 `{ id, name, params }`，params 必须对应内容入口声明的筛选参数。内容入口多于一个时，说明在栏目配置中选择目标。筛选参数不等于新的基础模块类型。

搜索读取宿主关键词；按来源选择 page 或 offset，不同时引入两种分页约定。验证第二页、末页、筛选变化和结构错误，不能把错误页面当空列表。

## 影视内容：电影、季集与资源

需要完整选集时，读取离线目录的 `seasons` 示例；实际剧集和季集号必须来自用户来源数据。`loadDetail(link)` 在新 Worker 中执行，不能读取上一次调用的普通全局变量。

自有 JSON 模板在私有存储保存当前来源设置，详情函数校验同源后使用。更换接口地址时，旧链接不能映射为新来源的同名内容。完整目录链接应可再次取得季集目录。

每集保留稳定来源 ID、seasonNumber、episodeNumber 和自身线路；公共系列 ID 不当作公共单集 ID。系列详情的线路不能复制到每一集。临时 URL 用 resource 在目标播放时解析；固定 URL 也可由目标详情的 playSources 提供。

纯资源模板只匹配明确公共 ID。若真实来源采用其他匹配协议，先检查它返回的身份和歧义处理，再调整；不能通过任取第一条结果宣称命中。

验收电影、多线路、第二集、跨季、重新打开详情和解析失败。每个结果必须仍属于请求目标。

## 字幕

输入包括媒体上下文、title、keyword / query 和 language。输出推荐 `[{ id, name, lang, url, headers? }]`。字幕接口模板的服务端封装是 `{ subtitles: [...] }`。

确认 url 指向独立字幕文件；若来源只给压缩包或页面，当前模板不能直接交付为可加载字幕。下载请求头必须来自该来源，不能继承媒体服务器头。

验收语言、季集、下载与主 / 副字幕加载。只有模板响应通过而未实际下载文件时，按此范围报告。

## 弹幕

来源能按媒体直接返回内容时，只需一个 danmu 函数；无需为了贴合模板虚构作品目录。

分步来源显式声明 `episodeFunctionName`、`commentFunctionName`：

| 阶段 | 参数 | 输出 |
| --- | --- | --- |
| 作品搜索 | 媒体上下文与 keyword | `[{ animeId, animeTitle }]` |
| 分集 | `params.animeId` | `[{ episodeId, episodeTitle, seasonNumber?, episodeNumber? }]` |
| 内容 | `params.episodeId` | `{ comments: [{ time, text, mode?, color? }] }` 或现有格式内容 |

验收手动选集、明确季集的自动命中、缺少季集的手动选择、内容解析和错误。URL 字符串不能代替已获取的弹幕内容。

## HTML 与浏览器方式

HTML 模板的选择器只是示范来源协议。根据真实页面样本修改目录容器、条目 ID、标题、详情链接和线路，保留可判断“合法空页”的容器或明确标记。先取得 HTML，再交给 `Widget.html.load`。

模块设置的浏览器方式改变请求执行通路，不提供任意点击、注入页面 JS 或软件账户 Cookie。页面样本不足以确认资源地址时，先说明缺少哪段接口或页面证据。

## 迁移与验证入口

外部脚本先按[迁移说明](migration.md)检查，再选择对应配方。部分类型别名可识别，不表示另一宿主的全套生命周期可执行。

使用随包 `scripts/check-module.mjs` 检查声明，再按[验证与交付](verification.md)对本次新脚本执行入口测试和请求头检查；不能只检查模板。随后按实际条件验证真实来源及应用传输。基础执行测试不需要 WWPlayer 源码；HTML、真实字幕下载和播放行为分别标明实际验证范围。

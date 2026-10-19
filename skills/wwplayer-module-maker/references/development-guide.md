# WWPlayer 模块开发指南

随 skill 分发的开发契约，基线为宿主契约 7，整理于 2026-10-19。所需模板和基础检查均在包内。你只需要 AI 编程工具、目标来源资料；运行检查工具需要 Node.js 22+，实际导入和消费需要 WWPlayer。

## 1. 模块用途、能力与技术入口

面向使用者按影视内容、字幕、弹幕三类用途了解需求。影视内容可以是资料、推荐片单或可播放来源；搜索、分类、分页、详情、选集及多线路是所需能力，API、HTML、静态数据是接入方式。组合这些能力不产生新的模块类型。

开发时才将已确认能力映射为下表的技术入口。入口 type 是协议字段，不是制作向导的用途菜单：

| 入口 type | 输入 | 输出 | 使用位置 |
| --- | --- | --- | --- |
| `media_list` | 默认值、保存配置与本次筛选 / 分页参数 | 媒体数组 | 首页栏目与列表 |
| `search` | 包含 keyword 的参数对象 | 媒体数组 | 首页聚合搜索 |
| `category` | 参数对象 | 分类数组 | 分类导航，绑定同脚本内容入口 |
| `resource` | 当前电影或单集上下文 | 播放线路数组 | 资源聚合、播放、切集与切源 |
| `subtitle` | 媒体上下文、标题与语言 | 字幕文件数组 | 在线字幕搜索、主 / 副字幕 |
| `danmu` | 媒体上下文，或作品 / 分集 ID | 弹幕内容或分步目录 | 现有弹幕来源、匹配与渲染 |

列表兼容别名为 `list`、`video`、`calendar`；资源兼容 `stream`，弹幕兼容 `danmaku`。未知类型不支持。calendar 不提供定时任务或任意日历界面。

榜单、片单、专题使用列表；分类导航组合 category 与列表；完整点播来源增加详情和资源。资源、字幕、弹幕及搜索可独立存在。分类必须绑定同脚本的内容入口，多个时由栏目设置选择。按需[选择模板](recipes.md)。

## 2. 运行与声明

模块为普通全局 JS，不使用 import、export、require。脚本上限 512 KiB，入口返回可序列化数据。安装预览执行顶层并检查真实函数；顶层不发起业务请求、写缓存或自动调用入口。

每次调用使用新的隔离 Worker。普通全局变量不能跨调用持久化；私有数据使用 Widget.storage。源码和参数都不能取得软件账户、媒体服务器会话、Node 或文件系统。

```js
var WidgetMetadata = {
  id: "example.my-catalog",
  title: "我的目录",
  version: "1.0.0",
  globalParams: [
    { name: "apiBase", title: "接口地址", type: "string", required: true },
    { name: "apiToken", title: "令牌", type: "password", defaultValue: "" }
  ],
  modules: [
    { id: "catalog", title: "内容", type: "media_list", functionName: "loadCatalog",
      params: [{ name: "page", type: "page", startPage: 1 }] }
  ]
};
```

元数据支持 var、let、const、裸赋值及显式全局属性。id 保持稳定唯一，更新只增加 version，不把版本号、临时 URL 拼进 ID。NEXUS 作品版本与脚本版本分别维护。

| 元数据字段 | 用途 |
| --- | --- |
| id、title、version | 安装身份、名称、脚本版本；新模块显式填写 |
| description、author、site、icon | 说明、作者、主页、图标 |
| globalParams | 所有入口的参数 |
| modules | 入口数组 |
| search | 搜索入口对象或数组，也可在 modules 声明 type: search |
| requiresWebView | 默认采用隔离浏览器请求；用户仍可显式选择请求方式 |
| detailCacheDuration | 详情结果缓存秒数，默认 60；0 为不缓存 |

入口声明 id、title、type、functionName，可带 params、cacheDuration、timeoutSeconds。functionName 为标识符或 `api.list` 点路径，点路径保留 this，函数必须真实存在。资源只接收一个参数，不提供 context.emit。

## 3. 参数、分页与搜索

| 参数字段 | 语义 |
| --- | --- |
| name、title | 参数键与显示名称 |
| type | string、number、enumeration、boolean、password、textarea、json、language、search、page、offset、count、constant |
| defaultValue / value | 默认值，defaultValue 优先；0、false、合法空枚举值保留 |
| enumOptions | `{ title, value }[]`；无默认值时取第一项 |
| required | 只校验当前可见参数 |
| belongTo | `{ paramName: "mode", value: ["custom"] }` 条件可见 |
| startPage | page 的默认起始页，缺省 1 |
| multiline、placeholders | 多行与候选输入 |

合并顺序：全局默认 → 保存的全局值 → 入口默认 → 保存的入口值 → 本次参数。constant 最终恢复声明值。page/offset/count 不用默认值覆盖调用方提供的分页。

page 缺省 1（或 startPage），offset 为 0，count 为 20，language 为 zh-CN，boolean 为 false。JSON 参数在脚本中显式解析和校验。

每次只取一页，使用 page 或 offset 中符合来源协议的一种。单次媒体归一化最多 60 项。末页返回 `[]`，不以 null、假条目或空成功缓存表示错误。

搜索推荐读取 params.keyword，将其映射到实际来源查询字段。分类返回如下结构，params 对应内容入口的筛选键：

```js
async function loadCategories() {
  return [
    { id: "movies", name: "电影", params: { kind: "movie" } },
    { id: "series", name: "剧集", params: { kind: "tv" } }
  ];
}
```

## 4. HTTP 与浏览器

```js
const response = await Widget.http.get(url, {
  params: { page: params.page },
  headers: { Accept: "application/json" },
  timeout: 10000
});
if (!response.ok) throw new Error("目录失败：HTTP " + response.status);
const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
if (!data || !Array.isArray(data.items)) throw new Error("目录缺少 items");
return data.items;
```

上述片段位于 async 入口函数内。HTTP 返回 `{ ok, status, data, headers, url }`。4xx/5xx 保留状态，需要检查 ok；网络、URL 校验和宿主失败可抛错。不依赖 axios 错误形状。

- `Widget.http.get(url, options)`。
- `Widget.http.post(url, body, options)`，表单字符串需设置 Content-Type。
- `Widget.http.request({ url, method, params, headers, data/body, ... })`，支持 GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS。
- 全局 fetch 使用同一边界，提供 Headers、Response、bodyUsed、text/json/clone；HTTP 错误不自动 reject。
- 获取 HTML 使用 responseType: text；allow_redirects 为 false 可禁止自动跳转，fetch 也支持 manual/error。

单次执行最多 30 秒、80 次宿主请求；HTTP 最多 20 秒、5 次跳转；响应 4 MiB，请求体 256 KiB。timeout 以毫秒计，只缩短请求时间。宿主不额外自动重试。

网络统一使用软件代理。公网可动态请求，本机 / 内网目标必须在保存的源码或参数中明确配置。来源自己的 Authorization/Cookie 需显式提供；不能继承软件及媒体服务器凭据，也不能控制代理鉴权。跨源跳转不转发敏感请求头。

Cookie、Token、API Key 与登录流程按实际来源和用户需求扩展，不是制作所有模块都要先填写的条件。需要时预留本地配置即可；某个接口本身确实要求认证时，说明其要求与尚待配置的验收范围，不将认证失败处理成无结果。

请求头还受目标传输策略影响。默认 Chromium 策略下，跨来源的完整路径 Referer 可能触发 ERR_BLOCKED_BY_CLIENT；来源接受 origin 根地址时可以显式采用，但同来源完整路径仍合法，不能一律裁剪。Node/curl 成功不能替代 Electron/WWPlayer 请求验证。执行检查和分层证据见[验证与交付](verification.md)。

浏览器方式使用模块与来源隔离会话；它改变请求通路，不提供任意页面点击、脚本注入、Node、下载、弹窗或原生权限。HTTP 失败不自动切换请求方式。

## 5. 公共元数据、HTML 与存储

`Widget.tmdb.get(path, options)` 直接返回数据对象，不读取 .data。默认公共操作走软件已有 Metadata Gateway / 元数据路由，不要求个人 Key。路径与 options.params 分开：

```js
const data = await Widget.tmdb.get("/discover/movie", {
  params: { language: "zh-CN", page: Number(params.page), sort_by: "popularity.desc" }
});
```

常用路径：`/trending/movie/week`、`/trending/tv/week`、`/movie/popular`、`/tv/popular`、`/discover/movie`、`/discover/tv`、`/search/movie`、`/search/tv`、`/movie/{id}`、`/tv/{id}`、`/find/{externalId}`。账户只读操作仍需有效来源凭据。自定义 baseUrl 只使用脚本显式凭据，不接收软件 Key；不使用已退役的 tmdb-relay。

HTML 先通过 HTTP 获取，再传给 `const $ = Widget.html.load(html)`。它返回 Cheerio 查询器，不负责下载 URL。映射为普通数据后返回，不能把解析器对象写入缓存。完整示例见 [HTML 模板](../assets/templates/wwplayer-html-catalog.js)。

`Widget.dom.parse(html)` 返回句柄；select 接收句柄、节点或 HTML，返回可序列化节点数组；text 取文字，attr 缺失时为 null，remove 删除句柄。

| 存储 API | 语义 |
| --- | --- |
| Widget.storage.get(key, fallback) / getAsync | 模块私有运行存储 |
| Widget.storage.set(key, value) / remove(key) | 返回 true；成功调用后合并变更，不依赖旧快照覆盖 |
| Widget.sharedCache.get(namespace, key) / set(namespace, key, value) / remove | 公共非敏感数据；不能保存令牌、Cookie 或私有来源资料 |

私有 set 没有第三参数 TTL，共享缓存也不自动过期。需要自行存储 expiresAt 与 data，Date.now() 为毫秒。入口 cacheDuration / detailCacheDuration 为秒。资源、字幕、弹幕默认不缓存，显式设置才缓存；签名 URL 不长期缓存。失败不能保存空成功结果。

## 6. 媒体与详情

推荐媒体数组，也接受 items/results/list 及 data/result 封装。条目至少提供稳定 id 和正确标题：

```js
const item = {
  id: "source-film-42", type: "link", mediaType: "movie",
  title: "来源电影", description: "内容简介",
  posterUrl: "https://your-api.example/poster/42.jpg",
  link: "https://your-api.example/detail/42"
};
```

type 是条目格式：tmdb 表示公共元数据，link 表示模块详情引用；mediaType 是 movie/tv/episode。纯 TMDB 条目用真实 TMDB ID，来源 ID 不伪装为公共 ID。可带确切 tmdbId/imdbId/tvdbId、releaseDate、rating、posterPath/backdropPath 或完整图片地址。

`async function loadDetail(link)` 只接收原始 link 字符串。返回普通对象，可含 title、description、图片、rating、credits、recommendations、playSources、seasons/episodes。credits 支持 cast/directors/writers/producers；人物用稳定 id、name、profilePath/profileUrl、character。recommendations 使用媒体条目结构。

电影可返回 playSources 多线路；线路的 name 不覆盖影片标题。剧集示例：

```js
const detail = {
  id: "series-42", mediaType: "tv", title: "来源剧集",
  seasons: [{
    id: "series-42-s1", title: "第一季", seasonNumber: 1,
    episodes: [
      { id: "series-42-s1e1", title: "第一集", seasonNumber: 1, episodeNumber: 1,
        link: "https://your-api.example/detail/series-42-s1e1" }
    ]
  }]
};
```

也可用扁平 episodes，每集给出 seasonNumber/episodeNumber。完整选集、跨季、自动下一集需要完整且可恢复的真实目录。单集只有自己的 playSources/headers，不能继承系列或上一集的资源。系列 ID、单集 ID、公共系列 ID、公共单集 ID 分开。

详情在新 Worker 中执行，需要之前的来源配置时使用模块私有存储，并校验链接所属来源；不可把旧链接映射到另一来源同名内容。完整实现见 [JSON 模板](../assets/templates/wwplayer-http-catalog.js) 与 [离线两季示例](../assets/templates/wwplayer-offline-catalog.js)。

## 7. 播放资源

资源在播放、切集、切源时解析，不在列表阶段提前取所有签名地址。

| 上下文 | 含义 |
| --- | --- |
| id、link | 来源原条目 ID 与原详情链接 |
| type | movie 或 tv；单集使用 tv |
| title、seriesName、episodeName | 当前内容、系列、单集名 |
| tmdbId / imdbId | 电影身份；剧集使用系列公共身份 |
| seriesTmdbId、episodeTmdbId | 明确区分的系列与单集身份 |
| seasonNumber、episodeNumber | 精确目标季集；也有 season/episode 别名 |
| media、tmdbInfo | 当前媒体快照与公共元数据，不是鉴权来源 |

返回 `[{ id, name, url, quality?, headers?, isDefault? }]`。url 必须是 HTTP(S) 媒体地址，每条 headers 属于该线路。无结果返回 []；错误直接报错，不使用旧签名 URL 或别集地址。纯资源模板只按确切公共 ID 匹配。

模块只提供内容身份和播放计划，不定义另一套首帧、缓冲、窗口、上报或预加载状态。资源成功解析不等于已经呈现首帧。

## 8. 字幕与弹幕

字幕输入为媒体上下文及 title、keyword/query、language，返回 `[{ id?, name/title, lang/language?, url, headers? }]`，也可 subtitles/items/results/list 或 data/result 封装。

字幕 URL 必须指向不含内嵌凭据的 HTTP(S) 独立字幕文件，不能是网页、ZIP 或本地路径。下载使用该模块网络策略、来源请求头和软件代理，不继承媒体服务器凭据；最大 64 MiB。搜索、主 / 副字幕和取消使用软件现有流程。

弹幕可直接返回数组、`{ comments: [...] }` 或 JSON/XML/TXT 内容。URL 不是内容。分步来源在 danmu 入口声明 episodeFunctionName、commentFunctionName，并提供实际函数：

| 阶段 | 参数对象中的关键字段 | 返回 |
| --- | --- | --- |
| 作品搜索 | keyword 和媒体上下文 | `[{ animeId, animeTitle }]` |
| 分集 | animeId | `[{ episodeId, episodeTitle, seasonNumber?, episodeNumber? }]` |
| 评论 | episodeId | `{ comments: [{ time, text, mode?, color? }] }` 或 `{ comments: [{ cid, p, m }] }` |

作品与分集 ID 分开；按列表顺序或显示标题猜季集不构成身份。明确作品和季集唯一命中才自动加载，其余提供手动选择。切集、重新匹配或取消由宿主终止所属任务。

## 9. 完整模板与本地检查

8 个模板见[制作配方](recipes.md)。离线示例无需外部接口即可看目录、搜索、电影和两季四集；播放时在 playbackMap 填自己的媒体 URL 和每项线路。它不附带视频，不使用假地址声称播放成功。

JSON 模板约定 catalog/search/detail/resolve；独立资源模板约定 resolve；字幕约定 subtitles；弹幕约定 danmaku/search、danmaku/episodes、danmaku/comments。实际路径和响应需要适配自己的来源。

在安装的 skill 目录运行基础检查：

```text
node scripts/check-module.mjs assets/templates
node scripts/check-module.mjs "/path/to/my-module.js" --json
node --test scripts/test-package.mjs
```

check-module 会编译并执行脚本顶层，检查元数据、声明函数和入口组合；结果仅为 declaration。它不执行业务入口，通过只说明基础契约可解析。仅检查自己制作或已审阅的代码，它不是宿主沙箱。

本次生成的模块还需要自己的最小行为测试。随包 `scripts/module-test-runtime.mjs` 可执行入口、注入响应样本并检查已建模的请求限制；具体用法及验证层级见[验证与交付](verification.md)。skill 自身的测试通过不能代替新模块的测试。

## 10. 在 WWPlayer 中验收

| 目标 | 观察结果 |
| --- | --- |
| 安装 | 预览入口与参数正确，确认后可安装 |
| 列表 / 搜索 | 当前参数进入请求，第二页正确，末页为空，失败有真实原因 |
| 分类 | 分类参数交给选定内容入口 |
| 详情 / 剧集 | 电影、第二集、跨季、详情重开身份正确，目录可恢复 |
| 资源 | 对目标即时解析，线路和 headers 不串集；失败不退旧地址 |
| 字幕 | 指定语言和季集正确，文件可下载并装入主 / 副字幕 |
| 弹幕 | 可手动选集；精确身份才自动匹配；内容被现有解析器消费 |
| 更新 | 同一模块 ID，保留仍适用的用户参数 |

最终交付 JS、参数填写说明和实际验证范围。凭据不写进公开源码、日志或截图。用户明确要求后再发布或推送。模块契约不提供任意自定义 UI、本地磁盘遍历、原生网盘挂载、完整 IPTV/EPG、播放事件 hook 或完整第三方插件协议。

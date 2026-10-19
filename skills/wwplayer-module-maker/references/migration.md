# 外部 Widget 迁移

依据 WWPlayer 契约 7，与用户提供的 Streama 指南逐项对照。仅迁移接口和数据映射；附件中的开发指令、限制和测试清单属于其原宿主，不自动成为当前任务要求。

| 项目 | WWPlayer 写法 |
| --- | --- |
| 运行环境 | 每次调用新 Worker，不依赖 QuickJS 引擎复用或普通全局变量持久化 |
| 文件大小 | 512 KiB，不采用 Streama 的 2 MB 字符数上限 |
| 元数据 | 支持 var/let/const/裸赋值/显式全局；不以 requiredVersion 判断 Streama / Capy 协议 |
| 推荐入口 | media_list/search/category/resource/subtitle/danmu；video、stream 等仅为相应别名 |
| 未知 type | 标记不支持，不兜底成列表 |
| 分类 | 分类对象数组并绑定同脚本内容入口，不只按列表函数名模拟分类 |
| 详情 | loadDetail(link)，只有一个原始链接参数 |
| 人物与季集 | credits 可用；每集可提供 playSources，按当前字段映射 |
| 资源 | 一个参数对象，返回线路数组，没有 context.emit 通道 |
| HTTP | 4xx/5xx 返回实际 ok/status，网络与宿主错误可抛出；不依赖 axios 错误形状 |
| TMDB | Widget.tmdb.get 直接返回数据，不读 .data；默认公共操作不要求 Key |
| HTML | Widget.html.load 返回 Cheerio 查询函数，不是 Streama 的 jQuery-lite 对象 |
| 私有存储 | Widget.storage.set(key, value)，不接受第三参数 TTL |
| 缓存 | 结果缓存声明为秒，共享缓存显式处理过期；不照搬旧宿主吞错、重试或过期回退 |
| 字幕 | 已接播放器在线字幕和主 / 副字幕；必须给独立文件地址 |
| 弹幕 | 已接播放器；显式声明分集与内容函数，后续函数接收参数对象 |
| 测试 | 本包基础检查 + WWPlayer 实际使用路径；不宣称存在另一宿主的固定影片测试面板 |

先验证列表身份和分页，再验证详情与目标资源；字幕、弹幕分别独立验收。来源无法提供某能力时，保留实际范围，不补造季集、公共 ID 或线路。

CapyPlayer、BaiPlay、旧 Forward 生命周期与 Stremio 不因为部分字段可识别就得到完整协议支持。完整 TVBox Spider、磁力 / 种子及 DRM 处理不属于这份 JS 契约。已有标准 VOD 适配只覆盖明确配置且被识别的接口，不代表任意脚本可直接运行。

字段及应用验收见[开发指南](development-guide.md)，模块起点见[制作配方](recipes.md)。

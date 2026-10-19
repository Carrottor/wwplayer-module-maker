// 独立资源入口：按明确公共身份匹配播放版本，不提供首页目录。
var WidgetMetadata = {
  id: "wwplayer.example.resource-api",
  title: "播放资源接口模板",
  version: "1.0.0",
  globalParams: [
    { name: "apiBase", title: "接口地址", type: "string", required: true },
    { name: "apiToken", title: "令牌", type: "password", defaultValue: "" }
  ],
  modules: [
    { id: "resources", title: "播放资源", type: "resource", functionName: "loadResource", cacheDuration: 0 }
  ]
};

async function loadResource(params) {
  if (params.type !== "movie" && params.type !== "tv") throw new Error("资源上下文需要 movie 或 tv 类型。");
  if (!params.tmdbId && !params.imdbId) return [];
  var query = { tmdbId: params.tmdbId, imdbId: params.imdbId, type: params.type };
  if (params.type === "tv") {
    var season = Number(params.seasonNumber), episode = Number(params.episodeNumber);
    if (!Number.isInteger(season) || season < 0 || !Number.isInteger(episode) || episode < 1) {
      throw new Error("剧集资源需要明确的季号和集号。");
    }
    query.season = season;
    query.episode = episode;
  }
  var base = new URL(String(params.apiBase));
  if (!/^https?:$/.test(base.protocol) || base.username || base.password) throw new Error("接口地址须为 HTTP(S) 来源。");
  var url = new URL("resolve", base.href.replace(/\/+$/, "") + "/");
  var response = await Widget.http.get(url.href, {
    params: query, headers: params.apiToken ? { Authorization: "Bearer " + params.apiToken } : {}
  });
  if (!response.ok) throw new Error("播放资源接口失败：HTTP " + response.status);
  var data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
  if (!data || !Array.isArray(data.sources)) throw new Error("播放资源接口缺少 sources 数组。");
  // sources: [{ id, name, url, quality?, headers?, isDefault? }]；空数组表示没有对应版本。
  return data.sources;
}

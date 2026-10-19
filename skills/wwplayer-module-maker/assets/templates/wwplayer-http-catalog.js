// WWPlayer 自定义 JSON 接口模板。安装后填写“接口地址”，按指南实现相应接口。
var WidgetMetadata = {
  id: "wwplayer.example.json-catalog",
  title: "自定义内容接口模板",
  description: "列表、搜索、详情和播放资源使用同一来源的稳定内容 ID。",
  version: "1.0.0",
  globalParams: [
    { name: "apiBase", title: "接口地址", type: "string", required: true, defaultValue: "" },
    { name: "apiToken", title: "访问令牌", type: "password", defaultValue: "" }
  ],
  modules: [
    { id: "catalog", title: "内容", type: "media_list", functionName: "loadCatalog",
      params: [{ name: "page", type: "page", startPage: 1 }, { name: "count", type: "count", defaultValue: 20 }] },
    { id: "resources", title: "播放资源", type: "resource", functionName: "loadResource", cacheDuration: 0 }
  ],
  search: {
    id: "search", title: "内容搜索", type: "search", functionName: "searchCatalog",
    params: [{ name: "keyword", title: "关键词", type: "search", required: true },
      { name: "page", type: "page", startPage: 1 }]
  }
};

function sourceOptions(params) {
  var base = new URL(String(params.apiBase || ""));
  if (!/^https?:$/.test(base.protocol) || base.username || base.password) {
    throw new Error("接口地址必须是有效的 HTTP(S) 来源。");
  }
  var options = { base: base.href.replace(/\/+$/, "") + "/", token: String(params.apiToken || "") };
  // 详情入口接收原链接字符串，来源设置在本模块私有运行存储中取得。
  Widget.storage.set("source-options", options);
  return options;
}

async function getJson(url, options, query) {
  var headers = { Accept: "application/json" };
  if (options.token) headers.Authorization = "Bearer " + options.token;
  var response = await Widget.http.get(url, { params: query || {}, headers: headers });
  if (!response.ok) throw new Error("内容接口返回 HTTP " + response.status);
  var data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
  if (!data || typeof data !== "object") throw new Error("内容接口必须返回 JSON 对象。");
  return data;
}

function catalogItems(data, options) {
  if (!Array.isArray(data.items)) throw new Error("内容接口缺少 items 数组。");
  return data.items.map(function(item) {
    if (item.id === undefined || !item.title) throw new Error("内容条目缺少 id 或 title。");
    var link = new URL("detail/" + encodeURIComponent(String(item.id)), options.base).href;
    return {
      id: String(item.id),
      type: "link",
      mediaType: item.mediaType || "movie",
      title: item.title,
      posterUrl: item.posterUrl || "",
      backdropUrl: item.backdropUrl || "",
      description: item.description || "",
      releaseDate: item.releaseDate || "",
      rating: Number(item.rating || 0),
      tmdbId: item.tmdbId ? String(item.tmdbId) : undefined,
      link: link
    };
  });
}

async function loadCatalog(params) {
  var options = sourceOptions(params);
  var data = await getJson(new URL("catalog", options.base).href, options, {
    page: Number(params.page), count: Number(params.count)
  });
  return catalogItems(data, options);
}

async function searchCatalog(params) {
  var options = sourceOptions(params);
  var keyword = String(params.keyword || "").trim();
  if (!keyword) throw new Error("请输入关键词。");
  var data = await getJson(new URL("search", options.base).href, options, {
    keyword: keyword, page: Number(params.page)
  });
  return catalogItems(data, options);
}

async function loadDetail(link) {
  var options = Widget.storage.get("source-options");
  if (!options) throw new Error("请先打开本模块的内容列表，确认来源设置。");
  var target = new URL(String(link));
  if (target.origin !== new URL(options.base).origin) throw new Error("详情链接不属于当前来源。");
  // 返回标题、介绍、演职员或 seasons 等信息；临时播放地址交给资源入口解析。
  return getJson(target.href, options);
}

async function loadResource(params) {
  var options = sourceOptions(params);
  var query = { id: String(params.id), type: params.type };
  if (params.seasonNumber !== undefined) query.season = Number(params.seasonNumber);
  if (params.episodeNumber !== undefined) query.episode = Number(params.episodeNumber);
  var data = await getJson(new URL("resolve", options.base).href, options, query);
  if (!Array.isArray(data.sources)) throw new Error("资源接口缺少 sources 数组。");
  return data.sources.map(function(source) {
    if (!source.url) throw new Error("播放资源缺少 url。");
    return { id: String(source.id), name: source.name || "播放资源", url: source.url,
      quality: source.quality || "", headers: source.headers || {} };
  });
}

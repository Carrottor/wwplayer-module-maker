// 独立弹幕源：作品搜索 → 分集目录 → 弹幕内容。
var WidgetMetadata = {
  id: "wwplayer.example.danmaku-api",
  title: "弹幕接口模板",
  version: "1.0.0",
  globalParams: [
    { name: "apiBase", title: "接口地址", type: "string", required: true },
    { name: "apiToken", title: "令牌", type: "password", defaultValue: "" }
  ],
  modules: [{
    id: "danmaku", title: "弹幕", type: "danmu", functionName: "searchWorks",
    episodeFunctionName: "loadEpisodes", commentFunctionName: "loadComments"
  }]
};

async function requestDanmaku(path, params, query, key) {
  var base = new URL(String(params.apiBase));
  if (!/^https?:$/.test(base.protocol) || base.username || base.password) throw new Error("接口地址须为 HTTP(S) 来源。");
  var url = new URL(path, base.href.replace(/\/+$/, "") + "/");
  var response = await Widget.http.get(url.href, {
    params: query, headers: params.apiToken ? { Authorization: "Bearer " + params.apiToken } : {}
  });
  if (!response.ok) throw new Error("弹幕接口失败：HTTP " + response.status);
  var data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
  if (!data || !Array.isArray(data[key])) throw new Error("弹幕接口缺少 " + key + " 数组。");
  return data;
}

async function searchWorks(params) {
  return (await requestDanmaku("danmaku/search", params, { keyword: params.keyword }, "animes")).animes;
}

async function loadEpisodes(params) {
  return (await requestDanmaku("danmaku/episodes", params, { animeId: params.animeId }, "episodes")).episodes;
}

async function loadComments(params) {
  return requestDanmaku("danmaku/comments", params, { episodeId: params.episodeId }, "comments");
}

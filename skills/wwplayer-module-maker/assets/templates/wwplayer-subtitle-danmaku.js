var WidgetMetadata = {
  id: "wwplayer.subtitle-danmaku.example",
  title: "字幕与弹幕接口",
  version: "1.0.0",
  globalParams: [
    { name: "apiBase", title: "接口地址", type: "string", required: true },
    { name: "apiToken", title: "令牌", type: "password", defaultValue: "" },
  ],
  modules: [
    {
      id: "subtitles", title: "字幕", type: "subtitle", functionName: "loadSubtitles",
      params: [{ name: "language", title: "语言", type: "language" }],
    },
    {
      id: "danmaku", title: "弹幕", type: "danmu", functionName: "searchDanmu",
      episodeFunctionName: "getDanmu", commentFunctionName: "getComments",
    },
  ],
};

async function requestExtension(path, params, query) {
  var base = String(params.apiBase || "").replace(/\/+$/, "") + "/";
  var url = new URL(path, base);
  var response = await Widget.http.get(url.href, {
    params: query,
    headers: params.apiToken ? { Authorization: "Bearer " + params.apiToken } : {},
  });
  if (!response.ok) throw new Error("接口请求失败：HTTP " + response.status);
  return response.data;
}

// 返回 [{ id, name, lang, url, headers? }]，url 必须指向可直接加载的字幕文件。
async function loadSubtitles(params) {
  var data = await requestExtension("subtitles", params, {
    title: params.title, imdb: params.imdbId, tmdb: params.tmdbId,
    season: params.seasonNumber, episode: params.episodeNumber, language: params.language,
  });
  if (!data || !Array.isArray(data.subtitles)) throw new Error("字幕接口缺少 subtitles 数组");
  return data.subtitles;
}

// 返回 [{ animeId, animeTitle, type? }]。
async function searchDanmu(params) {
  var data = await requestExtension("danmaku/search", params, { keyword: params.keyword });
  if (!data || !Array.isArray(data.animes)) throw new Error("弹幕接口缺少 animes 数组");
  return data.animes;
}

// 返回 [{ episodeId, episodeTitle, seasonNumber?, episodeNumber? }]。
// 无明确季集号时，播放器要求手动选择，不从标题或数组顺序猜测。
async function getDanmu(params) {
  var data = await requestExtension("danmaku/episodes", params, { animeId: params.animeId });
  if (!data || !Array.isArray(data.episodes)) throw new Error("弹幕接口缺少 episodes 数组");
  return data.episodes;
}

// 返回 { comments: [{ cid, p, m }] } 或 { comments: [{ time, text, mode?, color? }] }。
async function getComments(params) {
  var data = await requestExtension("danmaku/comments", params, { episodeId: params.episodeId });
  if (!data || !Array.isArray(data.comments)) throw new Error("弹幕接口缺少 comments 数组");
  return data;
}

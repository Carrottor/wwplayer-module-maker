// 独立字幕源：接口返回可直接加载的字幕文件地址。
var WidgetMetadata = {
  id: "wwplayer.example.subtitle-api",
  title: "在线字幕接口模板",
  version: "1.0.0",
  globalParams: [
    { name: "apiBase", title: "接口地址", type: "string", required: true },
    { name: "apiToken", title: "令牌", type: "password", defaultValue: "" }
  ],
  modules: [{
    id: "subtitles", title: "字幕", type: "subtitle", functionName: "loadSubtitles",
    params: [{ name: "language", title: "语言", type: "language" }]
  }]
};

async function loadSubtitles(params) {
  var base = new URL(String(params.apiBase));
  if (!/^https?:$/.test(base.protocol) || base.username || base.password) throw new Error("接口地址须为 HTTP(S) 来源。");
  var url = new URL("subtitles", base.href.replace(/\/+$/, "") + "/");
  var response = await Widget.http.get(url.href, {
    params: {
      title: params.title, tmdbId: params.tmdbId, imdbId: params.imdbId,
      season: params.seasonNumber, episode: params.episodeNumber, language: params.language
    },
    headers: params.apiToken ? { Authorization: "Bearer " + params.apiToken } : {}
  });
  if (!response.ok) throw new Error("字幕接口失败：HTTP " + response.status);
  var data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
  if (!data || !Array.isArray(data.subtitles)) throw new Error("字幕接口缺少 subtitles 数组。");
  // [{ id, name, lang, url, headers? }]；url 指向字幕文件，headers 仅属于该文件。
  return data.subtitles;
}

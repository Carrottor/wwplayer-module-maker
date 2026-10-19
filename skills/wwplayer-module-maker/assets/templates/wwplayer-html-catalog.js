// 按开发指南的 HTML 结构提供电影列表、搜索和详情；用于适配自己的来源。
var WidgetMetadata = {
  id: "wwplayer.example.html-catalog",
  title: "HTML 电影来源模板",
  version: "1.0.0",
  globalParams: [
    { name: "siteBase", title: "来源地址", type: "string", required: true }
  ],
  modules: [{
    id: "catalog", title: "电影", type: "media_list", functionName: "loadCatalog",
    params: [{ name: "page", type: "page", startPage: 1 }]
  }],
  search: {
    id: "search", title: "搜索电影", type: "search", functionName: "searchCatalog",
    params: [
      { name: "keyword", title: "关键词", type: "search", required: true },
      { name: "page", type: "page", startPage: 1 }
    ]
  }
};

function sourceBase(params) {
  var base = new URL(String(params.siteBase));
  if (!/^https?:$/.test(base.protocol) || base.username || base.password) throw new Error("来源地址须为 HTTP(S) URL。");
  Widget.storage.set("source-origin", base.origin);
  return base.href.replace(/\/+$/, "") + "/";
}

async function getPage(url, query) {
  var response = await Widget.http.get(url, { params: query || {}, responseType: "text" });
  if (!response.ok) throw new Error("来源页面失败：HTTP " + response.status);
  return { $: Widget.html.load(response.data), url: response.url };
}

function readCatalog(page) {
  var $ = page.$;
  if ($(".media-catalog").length !== 1) throw new Error("页面缺少唯一的 media-catalog 目录。");
  return $(".media-catalog .media-card").map(function(index, element) {
    var card = $(element), id = card.attr("data-id"), title = card.find(".title").text().trim();
    var href = card.find("a.detail").attr("href");
    if (!id || !title || !href) throw new Error("电影卡片缺少 id、标题或详情链接。");
    var link = new URL(href, page.url);
    if (link.origin !== Widget.storage.get("source-origin")) throw new Error("详情链接不属于当前来源。");
    var poster = card.find("img").attr("src");
    return {
      id: id, type: "link", mediaType: "movie", title: title, link: link.href,
      posterUrl: poster ? new URL(poster, page.url).href : ""
    };
  }).get();
}

async function loadCatalog(params) {
  return readCatalog(await getPage(new URL("catalog", sourceBase(params)).href, { page: params.page }));
}

async function searchCatalog(params) {
  var keyword = String(params.keyword || "").trim();
  if (!keyword) throw new Error("请输入搜索关键词。");
  return readCatalog(await getPage(new URL("search", sourceBase(params)).href, { keyword: keyword, page: params.page }));
}

async function loadDetail(link) {
  var origin = Widget.storage.get("source-origin");
  if (!origin) throw new Error("请先打开本模块目录或搜索以保存来源。");
  var target = new URL(link);
  if (target.origin !== origin) throw new Error("详情链接不属于当前来源。");
  var page = await getPage(target.href), $ = page.$, detail = $(".media-detail");
  if (detail.length !== 1 || !detail.attr("data-id") || !detail.find(".title").text().trim()) {
    throw new Error("页面缺少有效的 media-detail 电影详情。");
  }
  return {
    id: detail.attr("data-id"), type: "link", mediaType: "movie", title: detail.find(".title").text().trim(),
    description: detail.find(".description").text().trim(),
    playSources: detail.find("a.play-source").map(function(index, element) {
      var source = $(element), id = source.attr("data-id"), href = source.attr("href");
      if (!id || !href) throw new Error("播放线路缺少 id 或地址。");
      return { id: id, name: source.text().trim(), url: new URL(href, page.url).href,
        quality: source.attr("data-quality") || "" };
    }).get()
  };
}

// 列表、分类、搜索和详情完全离线。播放地址由用户在“播放配置”中填写。
var WidgetMetadata = {
  id: "wwplayer.example.offline-catalog",
  title: "离线电影与剧集示例",
  version: "1.0.0",
  description: "电影、两季剧集和可配置多线路；不调用外部内容接口。",
  detailCacheDuration: 0,
  globalParams: [
    { name: "playbackMap", title: "播放配置", type: "json", defaultValue: "{}" }
  ],
  modules: [
    { id: "catalog", title: "内容", type: "media_list", functionName: "loadCatalog",
      params: [
        { name: "kind", title: "类型", type: "enumeration", defaultValue: "all",
          enumOptions: [{ title: "全部", value: "all" }, { title: "电影", value: "movie" }, { title: "剧集", value: "tv" }] },
        { name: "page", type: "page", startPage: 1 },
        { name: "count", type: "count", defaultValue: 1 }
      ] },
    { id: "categories", title: "分类", type: "category", functionName: "loadCategories" },
    { id: "resources", title: "播放资源", type: "resource", functionName: "loadResource", cacheDuration: 0 }
  ],
  search: {
    id: "search", title: "搜索示例", type: "search", functionName: "searchCatalog",
    params: [
      { name: "keyword", title: "关键词", type: "search", required: true },
      { name: "page", type: "page", startPage: 1 },
      { name: "count", type: "count", defaultValue: 1 }
    ]
  }
};

var EXAMPLE_ITEMS = [
  { id: "demo-movie", type: "link", mediaType: "movie", title: "离线示例电影",
    link: "wwplayer-example://catalog/movie", description: "本地静态电影资料，用于验证目录、详情和多线路。" },
  { id: "demo-series", type: "link", mediaType: "tv", title: "离线示例剧集",
    link: "wwplayer-example://catalog/series", description: "两季、每季两集，所有季集都有独立身份。" }
];

var EXAMPLE_SEASONS = [1, 2].map(function(season) {
  return {
    id: "demo-series-s" + season, title: "第 " + season + " 季", seasonNumber: season,
    episodes: [1, 2].map(function(episode) {
      var id = "demo-series-s" + season + "e" + episode;
      return {
        id: id, type: "link", mediaType: "episode", title: "第 " + season + " 季 第 " + episode + " 集",
        seasonNumber: season, episodeNumber: episode,
        link: "wwplayer-example://catalog/episode/" + id,
        description: "每集只读取播放配置中属于自己 ID 的线路。"
      };
    })
  };
});

function copyValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function pageItems(items, params) {
  var page = Number(params.page), count = Number(params.count);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(count) || count < 1 || count > 60) {
    throw new Error("分页需要正整数 page 和 1–60 范围内的 count。");
  }
  return copyValue(items.slice((page - 1) * count, page * count));
}

async function loadCatalog(params) {
  if (["all", "movie", "tv"].indexOf(params.kind) < 0) throw new Error("未知的内容类型。");
  return pageItems(EXAMPLE_ITEMS.filter(function(item) {
    return params.kind === "all" || item.mediaType === params.kind;
  }), params);
}

async function loadCategories() {
  return [
    { id: "movies", name: "电影", params: { kind: "movie" } },
    { id: "series", name: "剧集", params: { kind: "tv" } }
  ];
}

async function searchCatalog(params) {
  var keyword = String(params.keyword || "").trim().toLowerCase();
  if (!keyword) throw new Error("请输入搜索关键词。");
  return pageItems(EXAMPLE_ITEMS.filter(function(item) {
    return item.title.toLowerCase().indexOf(keyword) >= 0;
  }), params);
}

async function loadDetail(link) {
  if (link === EXAMPLE_ITEMS[0].link) return copyValue(EXAMPLE_ITEMS[0]);
  if (link === EXAMPLE_ITEMS[1].link) {
    return copyValue(Object.assign({}, EXAMPLE_ITEMS[1], {
      seasons: EXAMPLE_SEASONS, recommendations: [EXAMPLE_ITEMS[0]]
    }));
  }
  for (var season of EXAMPLE_SEASONS) {
    for (var episode of season.episodes) {
      if (episode.link === link) return copyValue(Object.assign({}, episode, { seasons: EXAMPLE_SEASONS }));
    }
  }
  throw new Error("loadDetail：未知的示例详情链接。");
}

async function loadResource(params) {
  var id = String(params.id || "");
  var episodes = EXAMPLE_SEASONS.reduce(function(items, season) { return items.concat(season.episodes); }, []);
  if (id === "demo-series") {
    var selected = episodes.find(function(episode) {
      return episode.seasonNumber === Number(params.seasonNumber) && episode.episodeNumber === Number(params.episodeNumber);
    });
    if (!selected) throw new Error("请先选择示例剧集的具体季和集。");
    id = selected.id;
  }
  if (id !== "demo-movie" && !episodes.some(function(episode) { return episode.id === id; })) return [];
  var mapping = JSON.parse(String(params.playbackMap));
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) throw new Error("播放配置必须是 JSON 对象。");
  if (!Array.isArray(mapping[id]) || !mapping[id].length) throw new Error("请在播放配置中填写 " + id + " 的线路。");
  return mapping[id].map(function(source) {
    if (!source || !source.id || !source.url) throw new Error("示例线路需要稳定 id 和播放 url。");
    var url = new URL(source.url);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("示例播放地址须为不含内嵌凭据的 HTTP(S) URL。");
    return {
      id: String(source.id), name: source.name || String(source.id), url: url.href,
      quality: source.quality || "", headers: source.headers || {}, isDefault: source.isDefault === true
    };
  });
}

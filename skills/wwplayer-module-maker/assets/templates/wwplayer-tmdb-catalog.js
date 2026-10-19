// 可直接导入的 WWPlayer 模块示例：电影列表、分类和搜索。
var WidgetMetadata = {
  id: "wwplayer.example.movie-catalog",
  title: "电影目录示例",
  description: "通过公共元数据提供电影列表、分类和搜索。",
  version: "1.0.0",
  author: "WWPlayer",
  globalParams: [
    { name: "language", title: "语言", type: "enumeration", defaultValue: "zh-CN",
      enumOptions: [{ title: "简体中文", value: "zh-CN" }, { title: "English", value: "en-US" }] }
  ],
  modules: [
    { id: "movies", title: "电影", type: "media_list", functionName: "loadMovies",
      cacheDuration: 120,
      params: [
        { name: "genre", title: "分类", type: "string", defaultValue: "" },
        { name: "order", title: "排序", type: "enumeration", defaultValue: "popularity.desc",
          enumOptions: [{ title: "热门", value: "popularity.desc" }, { title: "最新", value: "primary_release_date.desc" }] },
        { name: "page", type: "page", startPage: 1 }
      ] },
    { id: "genres", title: "电影分类", type: "category", functionName: "loadGenres", cacheDuration: 3600 }
  ],
  search: {
    id: "movie-search", title: "搜索电影", type: "search", functionName: "searchMovies",
    params: [
      { name: "keyword", title: "关键词", type: "search", required: true },
      { name: "page", type: "page", startPage: 1 }
    ]
  }
};

function movieItems(data) {
  if (!data || !Array.isArray(data.results)) {
    throw new Error("电影接口没有返回 results 数组。");
  }
  return data.results.map(function(movie) {
    if (!movie.id || !movie.title) throw new Error("电影条目缺少 id 或 title。");
    return {
      id: String(movie.id),
      type: "tmdb",
      mediaType: "movie",
      title: movie.title,
      posterPath: movie.poster_path || "",
      backdropPath: movie.backdrop_path || "",
      releaseDate: movie.release_date || "",
      description: movie.overview || "",
      rating: Number(movie.vote_average || 0)
    };
  });
}

async function loadMovies(params) {
  var query = {
    language: params.language,
    page: Number(params.page),
    sort_by: params.order
  };
  if (params.genre) query.with_genres = String(params.genre);
  var data = await Widget.tmdb.get("/discover/movie", { params: query });
  return movieItems(data);
}

async function loadGenres() {
  // 示例只展示四个固定筛选入口，不额外请求分类接口。
  return [
    { id: 28, name: "动作" }, { id: 35, name: "喜剧" },
    { id: 878, name: "科幻" }, { id: 18, name: "剧情" }
  ].map(function(genre) {
    return { id: String(genre.id), name: genre.name, params: { genre: String(genre.id) } };
  });
}

async function searchMovies(params) {
  var keyword = String(params.keyword || "").trim();
  if (!keyword) throw new Error("请输入搜索关键词。");
  var data = await Widget.tmdb.get("/search/movie", {
    params: { query: keyword, language: params.language, page: Number(params.page) }
  });
  return movieItems(data);
}

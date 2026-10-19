import { createModuleContext } from "./check-module.mjs";

const own = (value, key) => Object.hasOwn(value, key);
const clone = (value) => structuredClone(value);
const unavailable = (name) => () => { throw new Error(`执行测试缺少宿主适配器：${name}`); };

export function validateChromiumRequest(url, headers = {}) {
  const target = new URL(url);
  if (!/^https?:$/.test(target.protocol) || target.username || target.password) {
    throw new Error("模块请求须为不含内嵌凭据的 HTTP(S) URL。");
  }
  const rawReferrer = Object.entries(headers).find(([name]) => name.toLowerCase() === "referer")?.[1];
  if (!rawReferrer) return;
  const referrer = new URL(String(rawReferrer));
  const crossOrigin = referrer.origin !== target.origin;
  const hasPath = referrer.pathname !== "/" || Boolean(referrer.search || referrer.hash);
  if (crossOrigin && hasPath) {
    throw Object.assign(new Error(
      "跨来源完整路径 Referer 与 Chromium 默认 strict-origin-when-cross-origin 策略冲突，可能触发 ERR_BLOCKED_BY_CLIENT。核对来源实际要求；不能自动截断所有 Referer。",
    ), { code: "CHROMIUM_REFERRER_POLICY" });
  }
}

function parameterDefinitions(raw = []) {
  return Array.isArray(raw) ? raw : Object.entries(raw).map(([name, value]) => ({ name, value }));
}

function parameterValues(definitions = [], saved = {}) {
  return Object.fromEntries(definitions.map((parameter) => {
    const firstOption = (parameter.enumOptions || parameter.enumValues || [])[0];
    const optionValue = firstOption && typeof firstOption === "object" ? firstOption.value : firstOption;
    let value = parameter.defaultValue ?? parameter.value
      ?? optionValue
      ?? ({ page: parameter.startPage ?? 1, offset: 0, count: 20, language: "zh-CN", boolean: false }[parameter.type] ?? "");
    const savedValue = saved[parameter.name];
    const options = parameter.enumOptions || parameter.enumValues || [];
    const representable = savedValue !== "" || !options.length
      || options.some((option) => (option && typeof option === "object" ? option.value : option) === "");
    if (own(saved, parameter.name) && savedValue !== undefined && savedValue !== null && representable) value = savedValue;
    return [parameter.name, value];
  }));
}

// Fixture execution only. It never creates a live network transport.
// Every invocation gets a new JS environment; only successful storage mutations persist.
export function createModuleTestRuntime(code, {
  file = "module.js", http, tmdb, html, dom, globalValues = {}, sourceValues = {},
} = {}) {
  const metadata = clone(createModuleContext(code, { file }).metadata);
  const requests = [];
  const privateValues = new Map();
  const sharedValues = new Map();
  const searches = metadata.search ? (Array.isArray(metadata.search) ? metadata.search : [metadata.search]) : [];
  const entries = [...(metadata.modules || metadata.dataSources || []), ...searches];

  async function invoke(functionName, params) {
    const storage = clone(privateValues), shared = clone(sharedValues), mutations = [];
    let successfulRequests = 0;
    const failedRequests = [];
    const request = async ({ url, method = "GET", body, options = {} }) => {
      const target = new URL(String(url));
      for (const [key, value] of Object.entries(options.params || {})) {
        if (value !== undefined && value !== null && value !== "") target.searchParams.set(key, String(value));
      }
      const headers = Object.fromEntries(new Headers(options.headers || {}).entries());
      const recorded = { kind: "http", url: target.href, method: String(method).toUpperCase(), headers, body };
      requests.push(recorded);
      try {
        validateChromiumRequest(target.href, headers);
        if (!http) throw new Error("执行测试缺少 HTTP 响应样本，不会自动改为真实联网。");
        const response = await http(clone(recorded));
        if (!Number.isInteger(response?.status) || response.status < 100 || response.status > 599) {
          throw new Error("HTTP 样本需要明确的合法 status。");
        }
        const ok = response.status >= 200 && response.status < 300;
        if (ok) successfulRequests += 1;
        else failedRequests.push(`HTTP ${response.status}`);
        return {
          ...clone(response), ok, headers: clone(response.headers || {}), url: response.url || target.href,
        };
      } catch (error) {
        failedRequests.push(error);
        throw error;
      }
    };
    const storageApi = {
      get: (key, fallback) => storage.has(String(key)) ? storage.get(String(key)) : fallback,
      getAsync: async (key, fallback) => storageApi.get(key, fallback),
      set(key, value) {
        storage.set(String(key), value);
        mutations.push(() => privateValues.set(String(key), clone(value)));
        return true;
      },
      remove(key) {
        storage.delete(String(key));
        mutations.push(() => privateValues.delete(String(key)));
        return true;
      },
    };
    const Widget = {
      http: {
        get: (url, options) => request({ url, options }),
        post: (url, body, options) => request({ url, body, options, method: "POST" }),
        request: (options = {}) => request({ url: options.url, method: options.method, body: options.data ?? options.body, options }),
      },
      tmdb: { async get(path, options = {}) {
        requests.push({ kind: "tmdb", path, options: clone(options) });
        try {
          if (!tmdb) throw new Error("执行测试缺少 TMDB 响应样本。");
          const data = await tmdb(path, clone(options));
          successfulRequests += 1;
          return clone(data);
        } catch (error) { failedRequests.push(error); throw error; }
      } },
      html: html || { load: unavailable("Widget.html.load") },
      dom: dom || Object.fromEntries(["parse", "select", "text", "attr", "remove"].map((name) => [name, unavailable(`Widget.dom.${name}`)])),
      storage: storageApi,
      sharedCache: {
        get(namespace, key) { return shared.get(String(namespace))?.get(String(key)); },
        set(namespace, key, value) {
          const name = String(namespace), itemKey = String(key);
          if (!shared.has(name)) shared.set(name, new Map());
          shared.get(name).set(itemKey, value);
          mutations.push(() => {
            if (!sharedValues.has(name)) sharedValues.set(name, new Map());
            sharedValues.get(name).set(itemKey, clone(value));
          });
        },
        remove(namespace, key) {
          shared.get(String(namespace))?.delete(String(key));
          mutations.push(() => sharedValues.get(String(namespace))?.delete(String(key)));
        },
      },
    };
    const fetchImpl = async (input, init) => {
      const fetchRequest = new Request(input, init);
      const result = await request({
        url: fetchRequest.url, method: fetchRequest.method,
        body: fetchRequest.body ? await fetchRequest.text() : undefined,
        options: { headers: Object.fromEntries(fetchRequest.headers.entries()) },
      });
      const response = new Response([204, 205, 304].includes(result.status) || fetchRequest.method === "HEAD" ? null
        : typeof result.data === "string" ? result.data : JSON.stringify(result.data),
      { status: result.status, headers: result.headers });
      Object.defineProperty(response, "url", { value: result.url });
      return response;
    };
    const context = createModuleContext(code, { file, Widget, fetch: fetchImpl });
    const result = await context.invoke(functionName, clone(params));
    if (!successfulRequests && failedRequests.length) {
      const failure = failedRequests[0];
      throw failure instanceof Error ? failure : new Error(`宿主请求全部失败：${failure}`);
    }
    const output = clone(result);
    for (const commit of mutations) commit();
    return output;
  }

  async function invokeEntry(id, overrides = {}) {
    const entry = entries.find((value) => String(value.id || value.functionName || value.methodName) === id);
    if (!entry) throw new Error(`测试入口不存在：${id}`);
    const globals = parameterDefinitions(metadata.globalParams), parameters = parameterDefinitions(entry.params || entry.parameters);
    const values = { ...parameterValues(globals, globalValues), ...parameterValues(parameters, sourceValues[id]), ...overrides };
    for (const parameter of new Map([...globals, ...parameters].map((value) => [value.name, value])).values()) {
      if (parameter.type === "constant") values[parameter.name] = parameter.defaultValue ?? parameter.value ?? "";
      const condition = parameter.belongTo;
      const visible = !condition || (Array.isArray(condition.value) ? condition.value : [condition.value]).map(String).includes(String(values[condition.paramName] ?? ""));
      if (visible && parameter.required && (values[parameter.name] === undefined || values[parameter.name] === null || values[parameter.name] === "")) {
        throw new Error(`模块参数未填写：${parameter.title || parameter.name}`);
      }
    }
    return invoke(entry.functionName || entry.methodName, values);
  }
  return { scope: "fixture-execution", metadata, requests, invoke, invokeEntry };
}

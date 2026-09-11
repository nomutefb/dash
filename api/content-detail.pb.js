// Restore the shared detail-page route used by the blog and Kakao content tools.

routerAdd("POST", "/api/content/detail", function(e) {
  var info = e.requestInfo();
  var body = info && info.body && typeof info.body === "object" ? info.body : {};
  var url = String(body.url || "").trim();
  if (!/^https:\/\/(?:www\.)?yeulmaru\.org\/(?:performance|exhibition)\/v\/?(?:\?|$)/i.test(url)) {
    return e.json(400, { ok: false, error: "invalid detail url" });
  }

  var runtimeProxy = require(`${__hooks}/_runtime_proxy.js`);
  var response;
  try {
    response = runtimeProxy.proxyFetch({
      url: url,
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; YeulmaruContent/1.0)",
      },
      timeout: 30,
    });
  } catch (err) {
    return e.json(502, { ok: false, error: "detail fetch failed" });
  }

  if (!response || response.statusCode < 200 || response.statusCode >= 300) {
    return e.json(502, { ok: false, error: "detail fetch status " + (response && response.statusCode ? response.statusCode : 502) });
  }

  var html = String((response && response.text) || "");
  var text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(?:p|div|li|br|h[1-6]|tr|td|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, function(_, hex) { return String.fromCharCode(parseInt(hex, 16)); })
    .replace(/&#(\d+);/g, function(_, dec) { return String.fromCharCode(parseInt(dec, 10)); })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t\f\r]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return e.json(200, {
    ok: true,
    text: text.slice(0, 50000),
    ocrText: "",
    cached: false,
    source: url,
  });
});

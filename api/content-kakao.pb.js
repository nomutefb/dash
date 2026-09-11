// Kakao copy generation route. Keep all helpers inside the handler for Goja hook scope isolation.

routerAdd("POST", "/api/content/kakao", function(e) {
  try {
    var info = e.requestInfo();
    var body = info && info.body && typeof info.body === "object" ? info.body : {};
    var text = function(value) { return value == null ? "" : String(value); };
    var count = Math.max(1, Number(body.count) || 5);
    var model = {
      registeredProviderId: "bea96bff-f8d2-4c04-bfbb-52a51d59d9f1",
      modelId: "global.anthropic.claude-opus-4-8",
    };
    var runtimeProxy = require(__hooks + "/_runtime_proxy.js");
    var smUrl = $os.getenv("SM_UPSTREAM_INTERNAL_URL") || $os.getenv("SM_INTERNAL_URL");
    if (!smUrl) return e.json(200, { ok: false, error: "MISO runtime env missing (SM_UPSTREAM_INTERNAL_URL or SM_INTERNAL_URL)" });

    var config = runtimeProxy.proxyFetch({
      url: smUrl.replace(/\/$/, "") + "/__api/llm/config",
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (config.statusCode < 200 || config.statusCode >= 300) {
      return e.json(200, { ok: false, error: "MISO LLM config status " + config.statusCode, detail: String(config.text || "").slice(0, 300) });
    }
    var configBody = JSON.parse(config.text || "{}");
    var selected = (configBody && (configBody.selected_models || configBody.models)) || [];
    var enabled = false;
    for (var si = 0; si < selected.length; si++) {
      var selectedModel = selected[si] || {};
      var provider = selectedModel.registered_provider_id || selectedModel.registeredProviderId;
      var modelId = selectedModel.model_id || selectedModel.modelId;
      if (String(provider || "") === model.registeredProviderId && String(modelId || "") === model.modelId) {
        enabled = true;
        break;
      }
    }
    if (!enabled) return e.json(200, { ok: false, error: "Claude Opus 4.8 is not enabled in selected_models" });

    var context = "제목: " + text(body.title) + "\n프로그램: " + text(body.program) + "\n일시: " + text(body.date) + "\n추가 요청: " + text(body.extra) + "\n상세 링크: " + text(body.url);
    var prompt = "카카오 채널용 홍보 문구 후보 " + count + "개를 작성하세요. 설명·머리말·맺음말·질문을 절대 붙이지 말고 오직 JSON 배열만 출력하세요. 형식: [\"문구1\",\"문구2\",\"문구3\",\"문구4\",\"문구5\"]. 각 문구는 링크 URL을 제외한 본문 기준 76자 이내여야 합니다.\n" + context;
    var completion = runtimeProxy.proxyFetch({
      url: smUrl.replace(/\/$/, "") + "/__api/llm/completions",
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        system_prompt: "예울마루 홍보 카피를 작성하는 Claude Opus 4.8입니다. 설명·머리말·맺음말·질문을 절대 붙이지 말고 오직 JSON 배열만 출력하세요.",
        target_model: { registered_provider_id: model.registeredProviderId, model_id: model.modelId },
      }),
    });
    if (completion.statusCode < 200 || completion.statusCode >= 300) {
      return e.json(200, { ok: false, error: "MISO LLM request rejected (" + completion.statusCode + ")", upstreamStatus: completion.statusCode, detail: String(completion.text || "").slice(0, 300) });
    }
    var response = JSON.parse(completion.text || "{}");
    var raw = typeof response.text === "string" ? response.text : (typeof response.answer === "string" ? response.answer : "");
    var source = text(raw).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    var values = null;
    try {
      var parsed = JSON.parse(source);
      if (Array.isArray(parsed)) values = parsed;
      else if (parsed && Array.isArray(parsed.candidates)) values = parsed.candidates;
      else if (parsed && Array.isArray(parsed.items)) values = parsed.items;
    } catch (parseErr) {}
    if (!values) values = source.split(/\r?\n/).map(function(line) { return line.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").trim(); }).filter(function(line) { return line; });
    var candidates = [];
    for (var i = 0; i < values.length && candidates.length < count; i++) {
      var candidate = typeof values[i] === "string" ? values[i].trim() : (values[i] && typeof values[i].text === "string" ? values[i].text.trim() : "");
      if (candidate && !/^참고\s*[:：]/.test(candidate) && !/^만약\b/.test(candidate)) candidates.push(candidate);
    }
    var items = candidates.map(function(candidate, index) { return { text: candidate, len: candidate.length, tone: "후보 " + (index + 1) }; });
    return e.json(200, { ok: true, text: raw, candidates: candidates, items: items, source: text(body.url), over: items.filter(function(item) { return item.len > 76; }).length });
  } catch (err) {
    return e.json(200, { ok: false, error: "카카오 문구 생성 어댑터 실패", detail: String(err && err.message ? err.message : err).slice(0, 300) });
  }
});

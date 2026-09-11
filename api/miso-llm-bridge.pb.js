// miso-llm-bridge.pb.js — 미소 자체 Direct LLM REST 브리지
// 역할: 정적 HTML(public/standalone.html)에서 React SDK 없이 미소 LLM을 호출할 수 있도록
//       REST 엔드포인트를 노출한다. 키/인증은 모두 미소 플랫폼 측, 브라우저 노출 없음.
//
// 라우트:
//   GET  /api/miso-llm/models
//        응답 { ok: true, models: [{ registeredProviderId, modelId, label?, maxOutputTokens?, contextSize?, supportsVision? }, ...] }
//        실패시 { ok: false, error: "<사유>" }  (HTTP 200 유지 — 프론트가 파싱하게)
//   POST /api/miso-llm
//        요청 body { system?, prompt, history?, model?, maxTokens?, temperature? }
//        응답 { ok: true, text: "...", model: "<registeredProviderId>/<modelId>" }
//        실패시 { ok: false, error: "<사유>" }
//
// 미사용 라우트 이름·메서드 변경 금지. payload shape 도 프론트(standalone.html)가 기대하는
// 형태로 고정. 다른 .pb.js / 프론트 / src 수정 불필요.
//
// Goja 제약: async/await·import/export·npm 패키지 사용 불가. 헬퍼는 핸들러 내부에 인라인.
// 외부 HTTP는 require(__hooks + "/_runtime_proxy.js").proxyFetch() 만 사용.

var MISO_CLAUDE_OPUS_4_8 = {
  registeredProviderId: "bea96bff-f8d2-4c04-bfbb-52a51d59d9f1",
  modelId: "global.anthropic.claude-opus-4-8",
};

function bridgeGetModels(e) {
  var runtimeProxy;
  try {
    runtimeProxy = require(__hooks + "/_runtime_proxy.js");
  } catch (err) {
    return e.json(200, { ok: false, error: "runtime proxy unavailable: " + String(err && err.message ? err.message : err) });
  }

  var smUrl = $os.getenv("SM_INTERNAL_URL");
  var appId = $os.getenv("RUNTIME_APP_ID");
  if (!smUrl || !appId) {
    return e.json(200, { ok: false, error: "MISO runtime env missing (SM_INTERNAL_URL or RUNTIME_APP_ID)" });
  }

  /* __api/llm/config는 미소 서비스가 노출하는 LLM 설정(JSON). 같은 오리진 경로이므로
     prefix는 runtime base(__api) 그대로 두고 proxyFetch 에게 외부 URL 형태로 받힌다.
     SM proxy는 /__api/llm/* → MISO Direct LLM 라우트로 forwarding 한다. */
   var configUrl = smUrl.replace(/\/$/, "") + "/__api/llm/config";

  var res;
  try {
    res = runtimeProxy.proxyFetch({
      url: configUrl,
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    return e.json(200, { ok: false, error: "proxyFetch failed: " + String(err && err.message ? err.message : err) });
  }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    return e.json(200, { ok: false, error: "llm config returned status " + res.statusCode + " " + (res.text ? res.text.slice(0, 200) : "") });
  }

  var body = null;
  if (typeof res.text === "string" && res.text.length > 0) {
    try { body = JSON.parse(res.text); } catch (err) {
      return e.json(200, { ok: false, error: "llm config parse failed: " + String(err && err.message ? err.message : err) });
    }
  }

  var raw = (body && (body.selected_models || body.models)) || [];
  var models = [];
  for (var i = 0; i < raw.length; i++) {
    var m = raw[i];
    if (!m) continue;
    var rpid = m.registered_provider_id || m.registeredProviderId;
    var mid = m.model_id || m.modelId;
    if (!rpid || !mid) continue;
    if (String(rpid) !== MISO_CLAUDE_OPUS_4_8.registeredProviderId || String(mid) !== MISO_CLAUDE_OPUS_4_8.modelId) continue;
    var out = { registeredProviderId: String(rpid), modelId: String(mid) };
    if (m.label) out.label = String(m.label);
    if (m.max_output_tokens != null) out.maxOutputTokens = Number(m.max_output_tokens);
    if (m.context_size != null) out.contextSize = Number(m.context_size);
    if (m.supports_vision != null) out.supportsVision = !!m.supports_vision;
    models.push(out);
  }

  return e.json(200, { ok: true, models: models });
}

function bridgePost(e) {
  var runtimeProxy;
  try {
    runtimeProxy = require(__hooks + "/_runtime_proxy.js");
  } catch (err) {
    return e.json(200, { ok: false, error: "runtime proxy unavailable: " + String(err && err.message ? err.message : err) });
  }

  var smUrl = $os.getenv("SM_INTERNAL_URL");
  var appId = $os.getenv("RUNTIME_APP_ID");
  if (!smUrl || !appId) {
    return e.json(200, { ok: false, error: "MISO runtime env missing (SM_INTERNAL_URL or RUNTIME_APP_ID)" });
  }

  var info;
  try {
    info = e.requestInfo();
  } catch (err) {
    info = null;
  }
  var body = info && info.body;
  if (!body || typeof body !== "object") {
    return e.json(200, { ok: false, error: "request body must be JSON object" });
  }

  var system = typeof body.system === "string" ? body.system : "";
  var prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt) {
    return e.json(200, { ok: false, error: "prompt is required" });
  }
  var history = Array.isArray(body.history) ? body.history : null;

  var targetModel = {
    registeredProviderId: MISO_CLAUDE_OPUS_4_8.registeredProviderId,
    modelId: MISO_CLAUDE_OPUS_4_8.modelId,
  };

  var modelParameters = {};
  if (body.temperature != null && Number.isFinite(Number(body.temperature))) {
    modelParameters.temperature = Number(body.temperature);
  }
  if (body.maxTokens != null && Number.isFinite(Number(body.maxTokens))) {
    modelParameters.max_output_tokens = Number(body.maxTokens);
  }

  var messages = [];
  if (system) {
    messages.push({ role: "system", content: [{ type: "text", text: system }] });
  }
  if (history && history.length) {
    for (var hi = 0; hi < history.length; hi++) {
      var h = history[hi];
      if (!h || typeof h !== "object") continue;
      var hr = h.role === "assistant" ? "assistant" : (h.role === "system" ? "system" : "user");
      if (typeof h.content === "string") {
        messages.push({ role: hr, content: [{ type: "text", text: h.content }] });
      }
    }
  }
  messages.push({ role: "user", content: [{ type: "text", text: prompt }] });

  var llmRequest = {
    messages: messages,
  };
  if (Object.keys(modelParameters).length > 0) {
    llmRequest.model_parameters = modelParameters;
  }
  if (targetModel) {
    llmRequest.target_model = { registered_provider_id: targetModel.registeredProviderId, model_id: targetModel.modelId };
  }

  /* 고정 모델이 런타임 selected_models에 있어야만 호출한다. */
   var cfgUrl = smUrl.replace(/\/$/, "") + "/__api/llm/config";
  var cfgRes;
  try {
    cfgRes = runtimeProxy.proxyFetch({ url: cfgUrl, method: "GET", headers: { Accept: "application/json" } });
  } catch (err) {
    return e.json(200, { ok: false, error: "config fetch failed: " + String(err && err.message ? err.message : err) });
  }
  if (cfgRes.statusCode < 200 || cfgRes.statusCode >= 300) {
    return e.json(200, { ok: false, error: "config status " + cfgRes.statusCode });
  }
  var cfgBody = null;
  try { cfgBody = JSON.parse(cfgRes.text); } catch (err) {
    return e.json(200, { ok: false, error: "config parse failed" });
  }
  var sm = (cfgBody && (cfgBody.selected_models || cfgBody.models)) || [];
  var fixedModelEnabled = false;
  for (var si = 0; si < sm.length; si++) {
    var selected = sm[si];
    if (!selected) continue;
    var selectedProvider = selected.registered_provider_id || selected.registeredProviderId;
    var selectedModel = selected.model_id || selected.modelId;
    if (String(selectedProvider || "") === targetModel.registeredProviderId && String(selectedModel || "") === targetModel.modelId) {
      fixedModelEnabled = true;
      break;
    }
  }
  if (!fixedModelEnabled) {
    return e.json(200, { ok: false, error: "Claude Opus 4.8 is not enabled in selected_models" });
  }
   llmRequest.target_model = { registered_provider_id: targetModel.registeredProviderId, model_id: targetModel.modelId };

   var completionsUrl = smUrl.replace(/\/$/, "") + "/__api/llm/completions";
  var compRes;
  try {
    compRes = runtimeProxy.proxyFetch({
      url: completionsUrl,
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(llmRequest),
    });
  } catch (err) {
    return e.json(200, { ok: false, error: "completions fetch failed: " + String(err && err.message ? err.message : err) });
  }

  if (compRes.statusCode < 200 || compRes.statusCode >= 300) {
    return e.json(200, { ok: false, error: "completions status " + compRes.statusCode, detail: (compRes.text ? compRes.text.slice(0, 300) : "") });
  }

  var compBody = null;
  try { compBody = JSON.parse(compRes.text); } catch (err) {
    return e.json(200, { ok: false, error: "completions parse failed" });
  }

  /* MISO completions 응답 스키마 — 직접 LLM SDK 의 DirectLlmCompletionResponse 기준:
        { text: string, finish_reason?: string, usage?: {...}, model?: string } */
  var text = "";
  if (compBody) {
    if (typeof compBody.text === "string") text = compBody.text;
    else if (compBody.answer && typeof compBody.answer === "string") text = compBody.answer;
    else if (Array.isArray(compBody.choices) && compBody.choices.length > 0) {
      var ch0 = compBody.choices[0];
      if (ch0 && ch0.message) {
        if (typeof ch0.message.content === "string") text = ch0.message.content;
        else if (Array.isArray(ch0.message.content)) {
          for (var ci = 0; ci < ch0.message.content.length; ci++) {
            var part = ch0.message.content[ci];
            if (part && (part.type === "text" || part.text)) { text += String(part.text || ""); }
          }
        }
      }
    }
  }
  var usedModel = (compBody && compBody.model) || (targetModel.registeredProviderId + "/" + targetModel.modelId);

  return e.json(200, { ok: true, text: text, model: usedModel });
}

routerAdd("GET", "/api/miso-llm/models", bridgeGetModels);
routerAdd("POST", "/api/miso-llm", bridgePost);

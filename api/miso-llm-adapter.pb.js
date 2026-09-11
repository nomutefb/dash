// MISO LLM adapters for legacy Worker-shaped app routes.
// LLM routes only; data CRUD routes remain on the existing Worker path.

var MISO_ADAPTER_MODEL = {
  registeredProviderId: "bea96bff-f8d2-4c04-bfbb-52a51d59d9f1",
  modelId: "global.anthropic.claude-opus-4-8",
};
var MISO_ADAPTER_DRAFTS = {};
var MISO_ADAPTER_LATEST = "";

function adapterJsonBody(e) {
  var info;
  try { info = e.requestInfo(); } catch (err) { info = null; }
  return info && info.body && typeof info.body === "object" ? info.body : {};
}

function adapterText(value) {
  return value == null ? "" : String(value);
}

function adapterUpstreamDetail(response) {
  var detail = response && typeof response.text === "string" ? response.text : "";
  return detail.slice(0, 300).replace(/(api[_-]?key|authorization|token|secret|password)(\s*[:=]\s*)[^,\s}]+/ig, "$1$2[redacted]");
}

function adapterCandidateText(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value.text === "string") return value.text.trim();
  return "";
}

function adapterParseCandidates(raw, count) {
  var source = adapterText(raw).trim();
  var jsonSource = source.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  var values = null;
  try {
    var parsed = JSON.parse(jsonSource);
    if (Array.isArray(parsed)) values = parsed;
    else if (parsed && Array.isArray(parsed.candidates)) values = parsed.candidates;
    else if (parsed && Array.isArray(parsed.items)) values = parsed.items;
  } catch (err) {}
  if (!values) {
    var numbered = source.split(/\r?\n/).map(function(line) {
      return line.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").trim();
    }).filter(function(line) { return line && !/^---+$/.test(line); });
    values = numbered.length > 1 ? numbered : source.split(/\r?\n\s*\r?\n/);
  }
  var out = [];
  for (var i = 0; i < values.length && out.length < count; i++) {
    var text = adapterCandidateText(values[i]);
    if (!text || /^참고\s*[:：]/.test(text) || /^만약\b/.test(text) || /^---+$/.test(text)) continue;
    out.push(text);
  }
  return out;
}

function adapterComplete(prompt, system) {
  var runtimeProxy = require(__hooks + "/_runtime_proxy.js");
  var smUrl = $os.getenv("SM_UPSTREAM_INTERNAL_URL") || $os.getenv("SM_INTERNAL_URL");
  if (!smUrl) return { ok: false, error: "MISO runtime env missing (SM_INTERNAL_URL)" };

  var config = runtimeProxy.proxyFetch({
     url: smUrl.replace(/\/$/, "") + "/__api/llm/config",
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (config.statusCode < 200 || config.statusCode >= 300) {
    return { ok: false, error: "MISO LLM config status " + config.statusCode };
  }

  var configBody;
  try { configBody = JSON.parse(config.text || "{}"); } catch (err) {
    return { ok: false, error: "MISO LLM config parse failed" };
  }
  var selected = (configBody && (configBody.selected_models || configBody.models)) || [];
  var enabled = false;
  for (var i = 0; i < selected.length; i++) {
    var item = selected[i] || {};
    var provider = item.registered_provider_id || item.registeredProviderId;
    var model = item.model_id || item.modelId;
    if (String(provider || "") === MISO_ADAPTER_MODEL.registeredProviderId && String(model || "") === MISO_ADAPTER_MODEL.modelId) {
      enabled = true;
      break;
    }
  }
  if (!enabled) return { ok: false, error: "Claude Opus 4.8 is not enabled in selected_models" };

  var messages = [{ role: "user", content: adapterText(prompt) }];
  var completion = runtimeProxy.proxyFetch({
     url: smUrl.replace(/\/$/, "") + "/__api/llm/completions",
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ messages: messages, system_prompt: adapterText(system), target_model: { registered_provider_id: MISO_ADAPTER_MODEL.registeredProviderId, model_id: MISO_ADAPTER_MODEL.modelId } }),
  });
  if (completion.statusCode < 200 || completion.statusCode >= 300) {
    return { ok: false, error: "MISO LLM request rejected (" + completion.statusCode + ")", upstreamStatus: completion.statusCode, detail: adapterUpstreamDetail(completion) };
  }

  var response;
  try { response = JSON.parse(completion.text || "{}"); } catch (err) {
    return { ok: false, error: "MISO LLM completion parse failed" };
  }
  var text = "";
  if (typeof response.text === "string") text = response.text;
  else if (typeof response.answer === "string") text = response.answer;
  else if (Array.isArray(response.choices) && response.choices[0] && response.choices[0].message) {
    var content = response.choices[0].message.content;
    if (typeof content === "string") text = content;
    else if (Array.isArray(content)) {
      for (var ci = 0; ci < content.length; ci++) if (content[ci] && content[ci].text) text += String(content[ci].text);
    }
  }
  return { ok: true, text: text, model: MISO_ADAPTER_MODEL.modelId };
}

function adapterStoreDraft(id, draft) {
  var key = adapterText(id) || "miso-" + Date.now();
  MISO_ADAPTER_DRAFTS[key] = draft;
  MISO_ADAPTER_LATEST = key;
  return key;
}

function adapterDraftResponse(id) {
  var draft = MISO_ADAPTER_DRAFTS[adapterText(id)];
  if (!draft) return null;
  return { ok: true, ready: true, draft: draft };
}

routerAdd("POST", "/api/blog/dispatch", function(e) {
  var body = adapterJsonBody(e);
  var payload = body.payload || body;
  var kind = payload.segparse ? "segparse" : (payload.yeulchat ? "yeulchat" : "blog");
  var prompt = kind === "segparse"
    ? "다음 고객 분류 조건 문장을 JSON 조건으로 변환해 주세요. JSON만 반환하세요.\n질문: " + adapterText(payload.q) + "\n선택 가능한 조건 문맥: " + adapterText(payload.ctx)
    : kind === "yeulchat"
      ? "예울마루 고객 질문에 답해 주세요. 근거가 없는 사실은 추정하지 말고 간결한 한국어로 답하세요.\n질문: " + adapterText(payload.q) + "\n문맥: " + adapterText(payload.ctx) + "\n페르소나: " + adapterText(payload.persona)
      : "예울마루 홍보 초안을 작성해 주세요. 입력된 자료에 근거하고 한국어로 답하세요.\n" + JSON.stringify(payload);
  var result;
  try { result = adapterComplete(prompt, "당신은 예울마루 운영 업무를 돕는 Claude Opus 4.8입니다."); }
  catch (err) { return e.json(200, { ok: false, error: String(err && err.message ? err.message : err) }); }
  if (!result.ok) return e.json(200, result);
  var id = adapterStoreDraft(payload.id, { ok: true, text: result.text, model: result.model });
  return e.json(200, { ok: true, id: id });
});

routerAdd("GET", "/api/blog/draft", function(e) {
  var info = e.requestInfo();
  var query = info && info.query ? info.query : {};
  var id = query.id || "";
  var result = adapterDraftResponse(id);
  return result ? e.json(200, result) : e.json(404, { ok: false, error: "draft not found" });
});

routerAdd("POST", "/api/promo/auto-run", function(e) {
  var result;
  try { result = adapterComplete("예울마루의 오늘 사업·판매·홍보 데이터를 바탕으로 운영자용 AI 홍보 브리핑을 작성하세요. 데이터가 없으면 확인이 필요한 항목을 명시하세요.", "한국어 운영 브리핑을 작성하는 Claude Opus 4.8입니다."); }
  catch (err) { return e.json(200, { ok: false, error: String(err && err.message ? err.message : err) }); }
  if (!result.ok) return e.json(200, result);
  var id = adapterStoreDraft("promo-" + Date.now(), { ok: true, text: result.text, model: result.model });
  return e.json(200, { ok: true, id: id });
});

routerAdd("GET", "/api/promo/auto-latest", function(e) {
  return e.json(200, MISO_ADAPTER_LATEST ? { ok: true, id: MISO_ADAPTER_LATEST } : { ok: false, error: "no briefing" });
});

routerAdd("POST", "/api/content/structure", function(e) {
  var body = adapterJsonBody(e);
  var result;
  try { result = adapterComplete("다음 OCR 원문에서 일시·장소·출연·제목을 구조화해 주세요. JSON 또는 명확한 항목 목록으로 답하세요.\n" + adapterText(body.text), "공연 상세 정보를 구조화하는 Claude Opus 4.8입니다."); }
  catch (err) { return e.json(200, { ok: false, error: String(err && err.message ? err.message : err) }); }
  if (!result.ok) return e.json(200, result);
  return e.json(200, { ok: true, text: result.text });
});

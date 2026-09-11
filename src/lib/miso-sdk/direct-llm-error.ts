export type DirectLlmErrorCode =
  | "invalid_param"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "session_terminated"
  | "published_site_suspended"
  | "published_site_unpublished"
  | "app_blocked"
  | "app_permission_denied"
  | "app_permission_ip_restricted"
  | "input_size_exceeded"
  | "token_limit_exceeded"
  | "timeout_exceeded"
  | "upstream_timeout"
  | "rate_limit_error"
  | "completion_request_error"
  | "coder_tool_unavailable"
  | "coder_tool_invoke_failed"
  | "sandbox_runtime_error"
  | "sandbox_syntax_error"
  | "sandbox_timeout"
  | "sandbox_memory_limit_exceeded"
  | "sandbox_security_violation"
  | "sandbox_network_error"
  | "sandbox_rate_limit_exceeded"
  | "sandbox_concurrency_limit_exceeded"
  | "sandbox_quota_exceeded"
  | "sandbox_internal_error"
  | "sandbox_unknown_error"
  | "sheet_analysis_timeout"
  | "skill_execution_failed"
  | "sheet_analysis_failed"
  | "tool_invoke_error"
  | "tool_execution_error"
  | "tool_step_limit_exceeded"
  | "client_callback_error"
  | "service_unavailable"
  | "internal_server_error";

const DIRECT_LLM_ERROR_CONTRACT: Record<
  DirectLlmErrorCode,
  { message: string; status: number }
> = {
  invalid_param: { message: "요청 값이 올바르지 않습니다.", status: 400 },
  unauthorized: { message: "인증이 필요합니다.", status: 401 },
  forbidden: {
    message: "요청한 작업을 수행할 권한이 없습니다.",
    status: 403,
  },
  not_found: { message: "요청한 리소스를 찾을 수 없습니다.", status: 404 },
  session_terminated: { message: "코더 세션이 종료되었습니다.", status: 410 },
  published_site_suspended: {
    message: "관리자에 의해 일시정지된 사이트예요.",
    status: 503,
  },
  published_site_unpublished: {
    message: "더 이상 공개 중인 사이트가 아니에요.",
    status: 410,
  },
  app_blocked: {
    message: "운영자에 의해 사용이 중지되었어요.",
    status: 503,
  },
  app_permission_denied: {
    message: "이 앱을 사용하려면 관리자 승인이 필요해요.",
    status: 403,
  },
  app_permission_ip_restricted: {
    message: "현재 네트워크에서는 이 앱에 접근할 수 없어요.",
    status: 403,
  },
  input_size_exceeded: {
    message: "입력 크기가 허용된 한도를 초과했습니다.",
    status: 400,
  },
  token_limit_exceeded: { message: "토큰 한도를 초과했습니다.", status: 400 },
  // The work outran its execution cap — it is finished and it failed.
  timeout_exceeded: { message: "실행 시간이 초과되었습니다.", status: 408 },
  // The proxy stopped waiting. The call may still be running upstream, so a
  // blind retry can run it a second time.
  upstream_timeout: {
    message: "외부 서비스 응답 시간이 초과되었습니다.",
    status: 504,
  },
  rate_limit_error: {
    message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    status: 429,
  },
  completion_request_error: {
    message: "AI 응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    status: 502,
  },
  coder_tool_unavailable: {
    message: "요청한 도구를 사용할 수 없습니다. 도구 연결과 권한을 확인해 주세요.",
    status: 400,
  },
  coder_tool_invoke_failed: {
    message: "도구 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    status: 502,
  },
  sandbox_runtime_error: {
    message: "코드 실행 중 오류가 발생했습니다.",
    status: 502,
  },
  sandbox_syntax_error: {
    message: "코드 문법을 확인해 주세요.",
    status: 400,
  },
  sandbox_timeout: {
    message: "코드 실행 시간이 초과되었습니다.",
    status: 408,
  },
  sandbox_memory_limit_exceeded: {
    message: "코드 실행 메모리 한도를 초과했습니다.",
    status: 502,
  },
  sandbox_security_violation: {
    message: "보안 정책상 실행할 수 없는 코드입니다.",
    status: 403,
  },
  sandbox_network_error: {
    message: "코드 실행 중 네트워크 오류가 발생했습니다.",
    status: 502,
  },
  sandbox_rate_limit_exceeded: {
    message: "코드 실행 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    status: 429,
  },
  sandbox_concurrency_limit_exceeded: {
    message: "동시에 실행할 수 있는 코드 수를 초과했습니다.",
    status: 429,
  },
  sandbox_quota_exceeded: {
    message: "코드 실행 한도를 모두 사용했습니다.",
    status: 429,
  },
  sandbox_internal_error: {
    message: "코드 실행 서비스에 일시적인 오류가 발생했습니다.",
    status: 503,
  },
  sandbox_unknown_error: {
    message: "코드 실행 중 알 수 없는 오류가 발생했습니다.",
    status: 502,
  },
  sheet_analysis_timeout: {
    message: "시트 분석 시간이 초과되었습니다. 다시 시도해 주세요.",
    status: 408,
  },
  skill_execution_failed: {
    message: "스킬 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    status: 502,
  },
  sheet_analysis_failed: {
    message: "시트 분석 중 오류가 발생했습니다.",
    status: 502,
  },
  tool_invoke_error: {
    message: "도구 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    status: 502,
  },
  tool_execution_error: {
    message: "도구 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    status: 500,
  },
  tool_step_limit_exceeded: {
    message: "도구 실행 단계 한도를 초과했습니다.",
    status: 400,
  },
  client_callback_error: {
    message: "응답 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    status: 500,
  },
  service_unavailable: {
    message: "서비스를 일시적으로 사용할 수 없습니다.",
    status: 503,
  },
  internal_server_error: {
    message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    status: 500,
  },
};

const LIMIT_ERROR_CODES = new Set<DirectLlmErrorCode>([
  "input_size_exceeded",
  "token_limit_exceeded",
  "timeout_exceeded",
]);
const LEGACY_DETAIL_ERROR_CODES = new Set<DirectLlmErrorCode>([
  "unauthorized",
  "forbidden",
  "not_found",
  "session_terminated",
  "service_unavailable",
]);
const SAFE_LIMIT_TYPES = new Set(["input_size", "context_tokens", "execution_time"]);
const SAFE_LIMIT_UNITS = new Set(["bytes", "tokens", "seconds"]);

function sanitizeErrorDetail(
  code: DirectLlmErrorCode,
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const detail: Record<string, unknown> = {};

  if (LIMIT_ERROR_CODES.has(code)) {
    if (typeof value.limit_type === "string" && SAFE_LIMIT_TYPES.has(value.limit_type)) {
      detail.limit_type = value.limit_type;
    }
    if (typeof value.actual_value === "number" && Number.isInteger(value.actual_value)) {
      detail.actual_value = value.actual_value;
    }
    if (typeof value.allowed_value === "number" && Number.isInteger(value.allowed_value)) {
      detail.allowed_value = value.allowed_value;
    }
    if (typeof value.unit === "string" && SAFE_LIMIT_UNITS.has(value.unit)) {
      detail.unit = value.unit;
    }
  }

  if (LEGACY_DETAIL_ERROR_CODES.has(code)) {
    if (
      typeof value.legacy_code === "string" &&
      /^[A-Z0-9_]{1,64}$/.test(value.legacy_code)
    ) {
      detail.legacy_code = value.legacy_code;
    }
    if (value.reason === "failed" || value.reason === "blocked") {
      detail.reason = value.reason;
    }
  }

  return Object.keys(detail).length > 0 ? detail : undefined;
}

export class DirectLlmApiError extends Error {
  readonly code: DirectLlmErrorCode;
  readonly status: number;
  readonly errorDetail?: Record<string, unknown>;

  constructor(
    code: DirectLlmErrorCode,
    status: number = DIRECT_LLM_ERROR_CONTRACT[code].status,
    errorDetail?: Record<string, unknown>,
  ) {
    super(DIRECT_LLM_ERROR_CONTRACT[code].message);
    this.name = "DirectLlmApiError";
    this.code = code;
    this.status = code === "timeout_exceeded" ? 408 : status;
    this.errorDetail = sanitizeErrorDetail(code, errorDetail);
  }

  toPayload(): {
    code: DirectLlmErrorCode;
    message: string;
    status: number;
    error_detail?: Record<string, unknown>;
  } {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      ...(this.errorDetail ? { error_detail: this.errorDetail } : {}),
    };
  }
}

function isDirectLlmErrorCode(value: unknown): value is DirectLlmErrorCode {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(DIRECT_LLM_ERROR_CONTRACT, value)
  );
}

function fallbackDirectLlmErrorCode(status: number): DirectLlmErrorCode {
  if (status === 400) return "invalid_param";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 408 || status === 504) return "timeout_exceeded";
  if (status === 410) return "session_terminated";
  if (status === 429) return "rate_limit_error";
  if (status === 503) return "service_unavailable";
  if (status >= 500 && status !== 502) return "internal_server_error";
  return "completion_request_error";
}

export function directLlmErrorFromPayload(
  payload: unknown,
  responseStatus?: number,
): DirectLlmApiError {
  const record = payload && typeof payload === "object"
    ? payload as Record<string, unknown>
    : undefined;
  const payloadStatus = record?.status;
  const fallbackStatus = responseStatus ?? (
    typeof payloadStatus === "number" && Number.isInteger(payloadStatus)
      ? payloadStatus
      : 502
  );
  const code = isDirectLlmErrorCode(record?.code)
    ? record.code
    : fallbackDirectLlmErrorCode(fallbackStatus);
  const errorDetail = record?.error_detail;

  return new DirectLlmApiError(
    code,
    fallbackStatus,
    errorDetail && typeof errorDetail === "object"
      ? errorDetail as Record<string, unknown>
      : undefined,
  );
}

export async function directLlmErrorFromResponse(
  response: Response,
): Promise<DirectLlmApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  return directLlmErrorFromPayload(payload, response.status);
}

export function normalizeDirectLlmClientError(
  error: unknown,
  fallbackCode: DirectLlmErrorCode = "completion_request_error",
): DirectLlmApiError {
  if (error instanceof DirectLlmApiError) return error;
  if (error instanceof Error && error.name === "TimeoutError") {
    return new DirectLlmApiError("timeout_exceeded");
  }
  return new DirectLlmApiError(fallbackCode);
}

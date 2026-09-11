/// <reference types="vite/client" />

import { useCallback, useState } from "react";
import { getApiBase, getAuthHeaders } from "./site-client";
import {
  invokeMisoLLMWithTools,
  streamMisoLLMWithTools,
} from "./miso-llm-tool-loop";
import type {
  DirectLlmToolInvocation,
  DirectLlmToolSet,
} from "./miso-llm-tool-loop";
import {
  DirectLlmApiError,
  directLlmErrorFromPayload,
  directLlmErrorFromResponse,
  normalizeDirectLlmClientError,
  type DirectLlmErrorCode,
} from "./direct-llm-error";

export { DirectLlmApiError, type DirectLlmErrorCode };

export type DirectLlmMessageRole = "system" | "user" | "assistant" | "tool";

/** A single tool invocation requested by the model (assistant → client). */
export interface DirectLlmToolCall {
  id: string;
  name: string;
  /** JSON-encoded arguments string (already complete/parseable). */
  arguments: string;
}

/** A tool exposed to the model. `input_schema` is a JSON Schema object. */
export interface DirectLlmToolManifest {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface DirectLlmTextContentPart {
  type: "text";
  text: string;
}

export interface DirectLlmImageContentPart {
  type: "image";
  mimeType: string;
  url?: string;
  base64Data?: string;
  format?: string;
  detail?: "low" | "high";
}

export type DirectLlmContentPart =
  | DirectLlmTextContentPart
  | DirectLlmImageContentPart;

export interface DirectLlmMessage {
  role: DirectLlmMessageRole;
  content: string | DirectLlmContentPart[];
  /** assistant tool-call message: the tool calls the model requested. */
  toolCalls?: DirectLlmToolCall[];
  /** tool result message: the id of the tool call this result answers. */
  toolCallId?: string;
  /** tool result message: the name of the tool that produced this result. */
  name?: string;
}

export interface DirectLlmTargetModel {
  registeredProviderId: string;
  modelId: string;
}

export interface DirectLlmCompletionRequest {
  messages: DirectLlmMessage[];
  targetModel: DirectLlmTargetModel;
  systemPrompt?: string;
  modelParameters?: Record<string, unknown>;
  /**
   * Tools exposed to the model. When omitted/empty the `tools` key is dropped
   * from the wire request entirely, keeping non-tool requests byte-identical.
   */
  tools?: DirectLlmToolManifest[];
}

export interface DirectLlmConfigResponse {
  selected_models: Array<{
    registered_provider_id: string;
    model_id: string;
    /**
     * 표시용 additive 필드 (MISO-4901 enrichment — 구 백엔드 응답엔 없을 수 있음).
     * provider_id: 공급 게이트웨이 타입 슬러그 (openai·anthropic·bedrock·vercel_ai_gateway…),
     * provider_alias: 관리자가 등록한 공급자 별칭.
     */
    provider_id?: string;
    provider_alias?: string;
    /** 배포 런타임이 해당 모델에 허용하는 최대 출력 토큰 수. */
    max_output_tokens?: number;
    /** 배포 런타임이 해석한 모델의 전체 컨텍스트 토큰 수. */
    context_size?: number;
    /** 모델 schema가 이미지 입력을 지원하는지 여부. */
    supports_vision?: boolean;
  }>;
}

export interface DirectLlmCompletionResponse {
  id?: string | null;
  model: string;
  answer: string;
  selected_model?: {
    registered_provider_id?: string | null;
    model_id?: string | null;
  } | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    latency: number;
    total_price?: string;
    currency?: string;
  };
  /** Present only when the model requested tool calls. */
  tool_calls?: DirectLlmToolCall[];
  /** e.g. "tool_calls" | "stop" | "length". */
  finish_reason?: string | null;
}

export interface DirectLlmStreamEvent {
  event: string;
  answer?: string;
  data?: Record<string, unknown>;
  code?: string;
  message?: string;
  status?: number;
  error_detail?: Record<string, unknown>;
  [key: string]: unknown;
}

function buildDirectLlmUrl(): string {
  return `${getApiBase()}/llm/completions`;
}

function serializeDirectLlmMessages(messages: DirectLlmMessage[]) {
  return messages.map((message) => {
    const serialized: Record<string, unknown> = {
      role: message.role,
      content:
        typeof message.content === "string"
          ? message.content
          : message.content.map((part) => {
              if (part.type === "text") {
                return {
                  type: "text",
                  text: part.text,
                };
              }

              return {
                type: "image",
                mime_type: part.mimeType,
                url: part.url,
                base64_data: part.base64Data,
                format: part.format,
                detail: part.detail,
              };
            }),
    };

    // Additive tool-protocol fields — only emitted when present so that
    // ordinary (non-tool) messages serialize to identical bytes as before.
    if (message.toolCalls && message.toolCalls.length > 0) {
      serialized.tool_calls = message.toolCalls.map((call) => ({
        id: call.id,
        name: call.name,
        arguments: call.arguments,
      }));
    }
    if (message.toolCallId !== undefined) {
      serialized.tool_call_id = message.toolCallId;
    }
    if (message.name !== undefined) {
      serialized.name = message.name;
    }

    return serialized;
  });
}

/**
 * Build the wire request body. The `tools` key is added only when tools are
 * provided so requests from apps that don't use tools are unchanged.
 */
function buildDirectLlmRequestBody(
  request: DirectLlmCompletionRequest,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    messages: serializeDirectLlmMessages(request.messages),
    target_model: {
      registered_provider_id: request.targetModel.registeredProviderId,
      model_id: request.targetModel.modelId,
    },
    system_prompt: request.systemPrompt,
    model_parameters: request.modelParameters,
  };

  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));
  }

  return body;
}

function estimateSerializedTokens(value: unknown): number {
  const serialized = JSON.stringify(value);
  let asciiBytes = 0;
  let nonAsciiBytes = 0;

  for (const codePoint of serialized) {
    if (codePoint.charCodeAt(0) <= 0x7f) {
      asciiBytes += 1;
    } else {
      nonAsciiBytes += new TextEncoder().encode(codePoint).length;
    }
  }

  return Math.max(1, Math.ceil(asciiBytes / 4 + nonAsciiBytes));
}

export function estimateDirectLlmRequestOverheadTokens(
  request: Omit<DirectLlmCompletionRequest, "messages">,
): number {
  return estimateSerializedTokens(
    buildDirectLlmRequestBody({ ...request, messages: [] }),
  );
}

export async function getMisoLLMConfig(): Promise<DirectLlmConfigResponse> {
  let response: Response;
  try {
    response = await fetch(`${getApiBase()}/llm/config`, {
      method: "GET",
      headers: {
        ...getAuthHeaders(),
      },
    });
  } catch (error) {
    throw normalizeDirectLlmClientError(error);
  }

  if (!response.ok) {
    throw await directLlmErrorFromResponse(response);
  }

  try {
    return await response.json() as DirectLlmConfigResponse;
  } catch (error) {
    throw normalizeDirectLlmClientError(error);
  }
}

export async function invokeMisoLLM(
  request: DirectLlmCompletionRequest,
  options?: { signal?: AbortSignal },
): Promise<DirectLlmCompletionResponse> {
  let response: Response;
  try {
    response = await fetch(buildDirectLlmUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(buildDirectLlmRequestBody(request)),
      signal: options?.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw normalizeDirectLlmClientError(error);
  }

  if (!response.ok) {
    throw await directLlmErrorFromResponse(response);
  }

  try {
    return await response.json() as DirectLlmCompletionResponse;
  } catch (error) {
    throw normalizeDirectLlmClientError(error);
  }
}

export interface DirectLlmStreamHandle {
  abort: () => void;
}

export function streamMisoLLM(
  request: DirectLlmCompletionRequest,
  options: {
    onEvent: (event: DirectLlmStreamEvent) => void;
    onError?: (error: Error) => void;
    onDone?: () => void;
  },
): DirectLlmStreamHandle {
  const controller = new AbortController();

  const run = async () => {
    try {
      const response = await fetch(`${buildDirectLlmUrl()}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(buildDirectLlmRequestBody(request)),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw await directLlmErrorFromResponse(response);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new DirectLlmApiError("completion_request_error");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6);
          if (!jsonStr) continue;
          let event: DirectLlmStreamEvent;
          try {
            event = JSON.parse(jsonStr) as DirectLlmStreamEvent;
          } catch {
            // ignore malformed JSON chunks
            continue;
          }
          if (event.event === "error") {
            throw directLlmErrorFromPayload(event);
          }
          options.onEvent(event);
        }
      }

      if (buffer.trim().startsWith("data: ")) {
        let event: DirectLlmStreamEvent | undefined;
        try {
          event = JSON.parse(buffer.trim().slice(6)) as DirectLlmStreamEvent;
        } catch {
          // ignore malformed trailing JSON
        }
        if (event?.event === "error") {
          throw directLlmErrorFromPayload(event);
        }
        if (event) options.onEvent(event);
      }

      options.onDone?.();
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        options.onDone?.();
        return;
      }
      options.onError?.(normalizeDirectLlmClientError(err));
    }
  };

  run();

  return {
    abort: () => controller.abort(),
  };
}

export interface UseMisoLLMToolHandlers {
  onToolCall?: (call: DirectLlmToolInvocation) => void;
  onToolResult?: (result: DirectLlmToolInvocation) => void;
  onStepStart?: (step: number) => void;
}

export interface UseMisoLLMSendOptions {
  targetModel: DirectLlmTargetModel;
  systemPrompt?: string;
  history?: DirectLlmMessage[];
  modelParameters?: Record<string, unknown>;
  tools?: DirectLlmToolSet;
  maxToolSteps?: number;
  handlers?: UseMisoLLMToolHandlers;
}

export interface UseMisoLLMReturn {
  send: (
    message: string | DirectLlmContentPart[],
    options: UseMisoLLMSendOptions,
  ) => Promise<DirectLlmCompletionResponse>;
  data: DirectLlmCompletionResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function useMisoLLM(): UseMisoLLMReturn {
  const [data, setData] = useState<DirectLlmCompletionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (
      message: string | DirectLlmContentPart[],
      options: UseMisoLLMSendOptions,
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const messages: DirectLlmMessage[] = [
          ...(options.history ?? []),
          { role: "user", content: message },
        ];
        const result = options.tools
          ? await invokeMisoLLMWithTools(
              {
                targetModel: options.targetModel,
                systemPrompt: options.systemPrompt,
                modelParameters: options.modelParameters,
                messages,
                tools: options.tools,
                maxToolSteps: options.maxToolSteps,
              },
              options.handlers,
            )
          : await invokeMisoLLM({
              targetModel: options.targetModel,
              systemPrompt: options.systemPrompt,
              modelParameters: options.modelParameters,
              messages,
            });
        setData(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Direct LLM request failed";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    send,
    data,
    isLoading,
    error,
  };
}

export interface UseMisoLLMStreamHandlers {
  onMessage?: (chunk: string, event: DirectLlmStreamEvent) => void;
  onMessageReplace?: (answer: string, event: DirectLlmStreamEvent) => void;
  onReasoning?: (chunk: string, event: DirectLlmStreamEvent) => void;
  onToolCall?: (call: DirectLlmToolInvocation) => void;
  onToolResult?: (result: DirectLlmToolInvocation) => void;
  onStepStart?: (step: number) => void;
  onMessageEnd?: (event: DirectLlmStreamEvent) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
}

export interface UseMisoLLMStreamSendOptions {
  targetModel: DirectLlmTargetModel;
  systemPrompt?: string;
  history?: DirectLlmMessage[];
  modelParameters?: Record<string, unknown>;
  tools?: DirectLlmToolSet;
  maxToolSteps?: number;
  handlers?: UseMisoLLMStreamHandlers;
}

export interface UseMisoLLMStreamReturn {
  send: (
    message: string | DirectLlmContentPart[],
    options: UseMisoLLMStreamSendOptions,
  ) => void;
  answer: string;
  isStreaming: boolean;
  error: string | null;
  abort: () => void;
}

export function useMisoLLMStream(): UseMisoLLMStreamReturn {
  const [answer, setAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState<DirectLlmStreamHandle | null>(null);

  const send = useCallback(
    (
      message: string | DirectLlmContentPart[],
      options: UseMisoLLMStreamSendOptions,
    ) => {
      setAnswer("");
      setError(null);
      setIsStreaming(true);

      const messages: DirectLlmMessage[] = [
        ...(options.history ?? []),
        { role: "user", content: message },
      ];

      if (options.tools) {
        const nextHandle = streamMisoLLMWithTools(
          {
            targetModel: options.targetModel,
            systemPrompt: options.systemPrompt,
            modelParameters: options.modelParameters,
            messages,
            tools: options.tools,
            maxToolSteps: options.maxToolSteps,
          },
          {
            onStepStart: (step) => options.handlers?.onStepStart?.(step),
            onText: (chunk) => {
              setAnswer((prev) => prev + chunk);
              options.handlers?.onMessage?.(chunk, {
                event: "text_chunk",
                answer: chunk,
              });
            },
            onMessageReplace: (nextAnswer) => {
              setAnswer(nextAnswer);
              options.handlers?.onMessageReplace?.(nextAnswer, {
                event: "message_replace",
                answer: nextAnswer,
              });
            },
            onReasoning: (chunk) => {
              options.handlers?.onReasoning?.(chunk, {
                event: "reasoning_chunk",
                answer: chunk,
              });
            },
            onToolCall: (call) => options.handlers?.onToolCall?.(call),
            onToolResult: (result) => options.handlers?.onToolResult?.(result),
            onError: (err) => {
              setError(err.message);
              setIsStreaming(false);
              options.handlers?.onError?.(err);
            },
            onDone: (final) => {
              setIsStreaming(false);
              options.handlers?.onMessageEnd?.({
                event: "message_end",
                data: {
                  finish_reason: "stop",
                  tool_steps: final.steps,
                },
              });
              options.handlers?.onDone?.();
            },
          },
        );

        setHandle(nextHandle);
        return;
      }

      const nextHandle = streamMisoLLM(
        {
          targetModel: options.targetModel,
          systemPrompt: options.systemPrompt,
          modelParameters: options.modelParameters,
          messages,
        },
        {
          onEvent: (event) => {
            switch (event.event) {
              case "text_chunk":
                if (event.answer) {
                  setAnswer((prev) => prev + event.answer);
                  options?.handlers?.onMessage?.(event.answer, event);
                }
                break;
              case "message_replace":
                if (event.answer) {
                  setAnswer(event.answer);
                  options?.handlers?.onMessageReplace?.(event.answer, event);
                }
                break;
              case "reasoning":
              case "reasoning_chunk": {
                const chunk =
                  typeof event.answer === "string"
                    ? event.answer
                    : typeof event.data?.text === "string"
                      ? event.data.text
                      : "";
                if (chunk) options?.handlers?.onReasoning?.(chunk, event);
                break;
              }
              case "tool_call": {
                const data = event.data ?? {};
                const rawArgs =
                  typeof data.arguments === "string" ? data.arguments : "";
                let input: unknown;
                try {
                  input = rawArgs ? JSON.parse(rawArgs) : {};
                } catch {
                  input = rawArgs;
                }
                const call: DirectLlmToolInvocation = {
                  toolCallId: typeof data.id === "string" ? data.id : "",
                  toolName: typeof data.name === "string" ? data.name : "",
                  state: "input-available",
                  input,
                };
                options?.handlers?.onToolCall?.(call);
                break;
              }
              case "message_end":
                options?.handlers?.onMessageEnd?.(event);
                break;
            }
          },
          onError: (err) => {
            setError(err.message);
            setIsStreaming(false);
            options?.handlers?.onError?.(err);
          },
          onDone: () => {
            setIsStreaming(false);
            options?.handlers?.onDone?.();
          },
        },
      );

      setHandle(nextHandle);
    },
    [],
  );

  const abort = useCallback(() => {
    handle?.abort();
    setHandle(null);
  }, [handle]);

  return {
    send,
    answer,
    isStreaming,
    error,
    abort,
  };
}

export {
  defineMisoLLMTools,
  invokeMisoLLMWithTools,
  streamMisoLLMWithTools,
} from "./miso-llm-tool-loop";

export type {
  DirectLlmToolDefinition,
  DirectLlmToolInvocation,
  DirectLlmToolSet,
  InvokeMisoLLMWithToolsHandlers,
  InvokeMisoLLMWithToolsRequest,
  InvokeMisoLLMWithToolsResponse,
  StreamMisoLLMWithToolsHandle,
  StreamMisoLLMWithToolsHandlers,
  StreamMisoLLMWithToolsRequest,
} from "./miso-llm-tool-loop";

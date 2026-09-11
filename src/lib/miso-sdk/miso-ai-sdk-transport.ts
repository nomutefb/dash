/// <reference types="vite/client" />

/**
 * MISO ⇄ Vercel AI SDK `ChatTransport` adapter.
 *
 * Compatible with AI SDK v6 and v7: the `ChatTransport` / `UIMessage` /
 * `UIMessageChunk` shapes used here are structurally identical across both
 * majors (verified against ai@6.0.219 `.d.ts` and the v7 contract). To keep
 * this file free of a hard dependency on `ai`, those types are declared
 * locally rather than imported — the only import is the local MISO SDK.
 *
 * Usage (in an app that has installed `ai@6+` / `@ai-sdk/react`):
 *
 *   import { useChat } from "@ai-sdk/react";
 *   import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
 *   import { MisoChatTransport } from "@/lib/miso-sdk/miso-ai-sdk-transport";
 *
 *   const chat = useChat({
 *     transport: new MisoChatTransport({
 *       targetModel: { registeredProviderId, modelId },
 *       tools: toolManifests, // optional DirectLlmToolManifest[]
 *       onToolRoundCall: ({ roundId, chatId, ...call }) =>
 *         toolScheduler.enqueue(roundId, call, contextFor(chatId)),
 *       onToolRoundClosed: (roundId) => void toolScheduler.closeRound(roundId),
 *     }),
 *     sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
 *   });
 *
 * Note: MISO tool execution remains the app's responsibility. The transport
 * exposes explicit model-round callbacks so apps do not have to infer a round
 * boundary from UI stream consumption timing. Non-image attachments (office
 * docs etc.) are likewise the app's responsibility via the generic
 * `attachmentContentResolver` option — the core only handles image file
 * parts (a wire-level concern).
 *
 * 템플릿 승격 가능(앱 의존 없음): 이 파일의 import는 `./miso-llm` 하나뿐이다.
 */

import {
  DirectLlmApiError,
  estimateDirectLlmRequestOverheadTokens,
  streamMisoLLM,
  type DirectLlmContentPart,
  type DirectLlmMessage,
  type DirectLlmStreamHandle,
  type DirectLlmTargetModel,
  type DirectLlmToolCall,
  type DirectLlmToolManifest,
} from "./miso-llm";

// ---------------------------------------------------------------------------
// Local structural mirror of the AI SDK v6/v7 types (do NOT import "ai")
// ---------------------------------------------------------------------------

type FinishReason =
  | "stop"
  | "length"
  | "content-filter"
  | "tool-calls"
  | "error"
  | "other"
  | "unknown";

/** The subset of `UIMessageChunk` this transport emits. */
type UIMessageChunk =
  | { type: "start"; messageId?: string }
  | { type: "start-step" }
  | { type: "finish-step" }
  | { type: "finish"; finishReason?: FinishReason; messageMetadata?: unknown }
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  | { type: "reasoning-start"; id: string }
  | { type: "reasoning-delta"; id: string; delta: string }
  | { type: "reasoning-end"; id: string }
  | {
      type: "tool-input-available";
      toolCallId: string;
      toolName: string;
      input: unknown;
      dynamic?: true;
    }
  | { type: "error"; errorText: string };

/**
 * A UIMessage part. Tool parts use `type: "tool-<NAME>"` or `"dynamic-tool"`;
 * fields beyond the common ones are optional and discriminated at runtime.
 */
export interface UIMessagePart {
  type: string;
  text?: string;
  toolName?: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  /** file part (attachments): media type + URL (http(s) or data:). */
  mediaType?: string;
  url?: string;
  /** file 파트: 컴포저가 넣어주는 원본 파일명(오피스 확장자 판별에 사용). */
  name?: string;
}

export interface UIMessage {
  id: string;
  role: "system" | "user" | "assistant";
  parts: UIMessagePart[];
}

interface ChatRequestOptions {
  headers?: Record<string, string> | Headers;
  body?: object;
  metadata?: unknown;
}

interface ChatTransport<UI_MESSAGE> {
  sendMessages: (
    options: {
      trigger: "submit-message" | "regenerate-message";
      chatId: string;
      messageId: string | undefined;
      messages: UI_MESSAGE[];
      abortSignal: AbortSignal | undefined;
    } & {
      headers?: Record<string, string> | Headers;
      body?: object;
      metadata?: unknown;
    },
  ) => Promise<ReadableStream<UIMessageChunk>>;
  reconnectToStream: (
    options: { chatId: string } & ChatRequestOptions,
  ) => Promise<ReadableStream<UIMessageChunk> | null>;
}

// ---------------------------------------------------------------------------
// UIMessage[] → DirectLlmMessage[] (deserialization is the transport's job)
// ---------------------------------------------------------------------------

function isToolPart(part: UIMessagePart): boolean {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

function toolNameOf(part: UIMessagePart): string {
  if (part.type === "dynamic-tool") return part.toolName ?? "";
  if (part.type.startsWith("tool-")) return part.type.slice("tool-".length);
  return part.toolName ?? "";
}

function collectText(parts: UIMessagePart[]): string {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("");
}

/**
 * AI SDK는 한 assistant UIMessage에 여러 모델 라운드를 이어 붙이고 각 라운드
 * 시작을 `step-start` 파트로 표시한다. 이 경계를 잃으면 최종 답변이 과거
 * tool_calls보다 앞에 붙어 다음 턴의 대화 순서가 뒤집힌다.
 *
 * 예전 저장 데이터에 step marker가 없더라도 마지막 tool 뒤의 text는 별도
 * assistant 라운드로 분리해 가능한 한 원래 순서를 복원한다.
 */
function splitAssistantSteps(parts: UIMessagePart[]): UIMessagePart[][] {
  if (parts.some((part) => part.type === "step-start")) {
    const steps: UIMessagePart[][] = [];
    let current: UIMessagePart[] = [];
    for (const part of parts) {
      if (part.type === "step-start") {
        if (current.length > 0) steps.push(current);
        current = [];
        continue;
      }
      current.push(part);
    }
    if (current.length > 0) steps.push(current);
    return steps;
  }

  const lastCompletedToolIndex = parts.reduce(
    (lastIndex, part, index) =>
      isToolPart(part) &&
      (part.state === "output-available" || part.state === "output-error")
        ? index
        : lastIndex,
    -1,
  );
  const hasTrailingAssistantText = parts
    .slice(lastCompletedToolIndex + 1)
    .some((part) => part.type === "text" && Boolean(part.text?.trim()));
  if (lastCompletedToolIndex >= 0 && hasTrailingAssistantText) {
    return [
      parts.slice(0, lastCompletedToolIndex + 1),
      parts.slice(lastCompletedToolIndex + 1),
    ];
  }
  return [parts];
}

/**
 * 앱이 주입하는 generic 첨부 resolver. file 파트마다 호출되어 content 파트
 * 배열을 돌려주면 그 결과를 쓰고, null이면 미처리 → 코어의 기본 이미지 경로로
 * 폴백한다. 파싱 실패 처리(강등 텍스트 등)는 resolver 내부 책임이다.
 */
export type AttachmentContentResolver = (part: {
  name?: string;
  mediaType?: string;
  url?: string;
  /** Additive serialization context for stable app-level attachment refs. */
  messageId?: string;
  partIndex?: number;
  signal?: AbortSignal;
}) => Promise<DirectLlmContentPart[] | null>;

/**
 * 이미지 file 파트 1건을 miso-llm content 파트로 변환한다(비이미지는 null).
 * data URL(게스트 업로드)은 base64Data로, 원격 URL(PB file)은 url로 전달 —
 * 필드 관례는 기존 ai-chat `use-chat-stream.ts`의 이미지 직렬화와 동일.
 * 이미지 처리는 와이어 직결 기능이므로 resolver와 무관하게 코어에 남는다.
 */
function imageContentOf(part: UIMessagePart): DirectLlmContentPart | null {
  if (typeof part.url !== "string") return null;
  const mimeType = part.mediaType ?? "";
  if (!mimeType.startsWith("image/")) return null;
  if (part.url.startsWith("data:")) {
    const [, base64Data = ""] = part.url.split(",", 2);
    return {
      type: "image",
      mimeType,
      base64Data,
      format: mimeType.split("/")[1] ?? "image",
    };
  }
  return { type: "image", mimeType, url: part.url };
}

/**
 * user 메시지의 file 파트(첨부) 전부를 content 파트로 수집한다.
 * 파트마다 resolver 우선(오피스 문서 등 앱 정의 처리) → 미처리(null)면
 * 기본 이미지 경로. 순서는 원본 파트 순서를 따른다.
 */
async function collectAttachmentParts(
  message: UIMessage,
  resolver: AttachmentContentResolver | undefined,
  signal?: AbortSignal,
): Promise<DirectLlmContentPart[]> {
  const collected = await Promise.all(
    message.parts.map(
      async (part, partIndex): Promise<DirectLlmContentPart[]> => {
        if (part.type !== "file" || typeof part.url !== "string") return [];
        signal?.throwIfAborted();
        if (resolver) {
          const resolved = await resolver({
            name: part.name,
            mediaType: part.mediaType,
            url: part.url,
            messageId: message.id,
            partIndex,
            signal,
          });
          signal?.throwIfAborted();
          if (resolved) {
            return resolved;
          }
        }
        const image = imageContentOf(part);
        return image ? [image] : [];
      },
    ),
  );
  return collected.flat();
}

function projectedAttachmentParts(
  parts: DirectLlmContentPart[],
): UIMessagePart[] {
  return parts.map((part) => {
    if (part.type === "text") {
      return { type: "text", text: part.text };
    }
    return {
      type: "text",
      text: JSON.stringify({
        kind: "resolved-image",
        mimeType: part.mimeType,
      }),
    };
  });
}

/**
 * Resolve raw file parts before context projection. The caller keeps the raw
 * transcript for persistence and compaction hashes; this clone contains only
 * model-facing text receipts/extracted text, so binary data URLs never enter
 * summary or budget calculations.
 */
export async function projectAttachmentsForModel(
  messages: UIMessage[],
  resolver: AttachmentContentResolver,
  signal?: AbortSignal,
): Promise<UIMessage[]> {
  const projected = structuredClone(messages);

  await Promise.all(
    projected.map(async (message) => {
      if (message.role !== "user") return;

      const resolvedParts = await Promise.all(
        message.parts.map(async (part, partIndex): Promise<UIMessagePart[]> => {
          if (part.type !== "file" || typeof part.url !== "string") {
            return [part];
          }

          signal?.throwIfAborted();
          const resolved = await resolver({
            name: part.name,
            mediaType: part.mediaType,
            url: part.url,
            messageId: message.id,
            partIndex,
            signal,
          });
          signal?.throwIfAborted();
          return resolved ? projectedAttachmentParts(resolved) : [];
        }),
      );
      message.parts = resolvedParts.flat();
    }),
  );

  return projected;
}

/**
 * 툴 결과의 모델-facing 직렬화. 저장된 UI output은 건드리지 않되 이미지 바이너리는
 * 대화 모델로 재주입하지 않는다. vision 결과는 ref와 분석 텍스트만, 구 kind:image
 * 결과도 메타데이터 receipt만 반환한다. 그 외 결과는 기존 JSON 문자열을 유지한다.
 */
function toolResultContent(
  part: UIMessagePart,
): string | DirectLlmContentPart[] {
  if (part.state === "output-error") {
    return JSON.stringify({ error: part.errorText ?? "tool error" });
  }
  const output = part.output as
    | {
        kind?: string;
        ref?: string;
        path?: string;
        mimeType?: string;
        note?: string;
        text?: string;
      }
    | null
    | undefined;
  if (!output || typeof output !== "object") {
    return JSON.stringify(part.output ?? null);
  }
  if (output.kind === "image") {
    return JSON.stringify({
      kind: "image",
      path: output.path,
      mimeType: output.mimeType,
      note: output.note,
    });
  }
  if (output.kind === "vision") {
    return JSON.stringify({
      kind: "vision",
      ref: output.ref,
      path: output.path,
      mimeType: output.mimeType,
      text: output.text,
    });
  }
  return JSON.stringify(part.output ?? null);
}

export async function uiMessagesToDirectLlm(
  messages: UIMessage[],
  attachmentContentResolver: AttachmentContentResolver | undefined,
  signal?: AbortSignal,
): Promise<DirectLlmMessage[]> {
  const result: DirectLlmMessage[] = [];

  for (const message of messages) {
    const text = collectText(message.parts);

    if (message.role === "system") {
      if (text) result.push({ role: "system", content: text });
      continue;
    }
    if (message.role === "user") {
      // 첨부: resolver가 처리한 파트(오피스 문서 등)는 그 결과로, 나머지는
      // 기본 이미지 경로로 수집한다.
      const extras = await collectAttachmentParts(
        message,
        attachmentContentResolver,
        signal,
      );
      result.push({
        role: "user",
        content:
          extras.length > 0
            ? [...(text ? [{ type: "text" as const, text }] : []), ...extras]
            : text,
      });
      continue;
    }

    // assistant: AI SDK의 step 경계별로 assistant → tool 결과 순서를 보존한다.
    // 최종 text 라운드는 tool 결과 뒤 별도 assistant 메시지가 되어 다음 사용자
    // 질문이 기존 답변 바로 다음에 놓인다.
    for (const stepParts of splitAssistantSteps(message.parts)) {
      const stepText = collectText(stepParts);
      const completedToolParts = stepParts.filter(
        (part) =>
          isToolPart(part) &&
          (part.state === "output-available" || part.state === "output-error"),
      );

      if (completedToolParts.length > 0) {
        const toolCalls: DirectLlmToolCall[] = completedToolParts.map((part) => ({
          id: part.toolCallId ?? "",
          name: toolNameOf(part),
          arguments: JSON.stringify(part.input ?? {}),
        }));
        result.push({ role: "assistant", content: stepText, toolCalls });

        for (const part of completedToolParts) {
          result.push({
            role: "tool",
            content: toolResultContent(part),
            toolCallId: part.toolCallId ?? "",
            name: toolNameOf(part),
          });
        }
      } else if (stepText) {
        result.push({ role: "assistant", content: stepText });
      }
    }
  }

  return result;
}

function mapFinishReason(reason: string | undefined): FinishReason {
  switch (reason) {
    case "tool_calls":
      return "tool-calls";
    case "length":
    case "max_tokens":
      return "length";
    default:
      return "stop";
  }
}

function isContextOverflowError(error: unknown): boolean {
  return (
    error instanceof DirectLlmApiError &&
    error.code === "token_limit_exceeded"
  );
}

function callClientCallback<T>(callback: () => T): T {
  try {
    return callback();
  } catch {
    throw new DirectLlmApiError("client_callback_error");
  }
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export interface MisoChatTransportOptions {
  /**
   * The MISO target model. Accepts a resolver function so the caller can read
   * the latest selected model at send time (mirrors upstream's ref-based
   * `prepareSendMessagesRequest`) without recreating the transport on every
   * model switch.
   */
  targetModel: DirectLlmTargetModel | (() => DirectLlmTargetModel);
  systemPrompt?: string;
  contextWindow?:
    | MisoChatContextWindow
    | (() => MisoChatContextWindow | undefined);
  supportsVision?: boolean | (() => boolean);
  /** 전송 시점의 선택 모델 설정을 반영할 수 있도록 resolver도 허용한다. */
  modelParameters?:
    | Record<string, unknown>
    | (() => Record<string, unknown> | undefined);
  /**
   * Tools advertised to the model. Accepts a resolver so the set can vary per
   * send (e.g. local-folder tools appear only while a folder is connected)
   * without recreating the transport.
   */
  tools?: DirectLlmToolManifest[] | (() => DirectLlmToolManifest[]);
  /**
   * Optional app-defined attachment resolver, called for every user file part
   * during serialization. Return content parts to use them, or null to fall
   * back to the core image handling. Errors are the resolver's responsibility.
   */
  attachmentContentResolver?: AttachmentContentResolver;
  /** Optional app projection applied to a deep clone immediately before send. */
  prepareMessages?: (
    messages: UIMessage[],
    options: {
      forceCompaction: boolean;
      chatId: string;
      abortSignal: AbortSignal | undefined;
      requestContext: MisoChatRequestContext;
    },
  ) => Promise<UIMessage[]>;
  /** Called synchronously before the matching tool UI chunk is enqueued. */
  onToolRoundCall?: (call: {
    roundId: string;
    chatId: string;
    toolCallId: string;
    toolName: string;
    input: unknown;
    requestContext: MisoChatRequestContext;
  }) => void;
  /** Called once when a stream has registered tool calls and closes normally. */
  onToolRoundClosed?: (roundId: string) => void;
  /** Discards registrations when a stream fails before its round can close. */
  onToolRoundAborted?: (roundId: string) => void;
}

export interface MisoChatContextWindow {
  readonly contextSize?: number;
  readonly maxOutputTokens?: number;
}

export interface MisoChatRequestContext {
  readonly targetModel: DirectLlmTargetModel;
  readonly contextWindow: MisoChatContextWindow | undefined;
  readonly systemPrompt: string | undefined;
  readonly modelParameters: Record<string, unknown> | undefined;
  readonly tools: DirectLlmToolManifest[] | undefined;
  readonly supportsVision: boolean;
  readonly overheadTokens: number;
}

function freezeSnapshot<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    freezeSnapshot(child);
  }
  return Object.freeze(value);
}

export class MisoChatTransport implements ChatTransport<UIMessage> {
  private readonly resolveTargetModel: () => DirectLlmTargetModel;
  private readonly systemPrompt?: string;
  private readonly resolveContextWindow: () =>
    | MisoChatContextWindow
    | undefined;
  private readonly resolveSupportsVision: () => boolean;
  private readonly resolveModelParameters: () =>
    | Record<string, unknown>
    | undefined;
  private readonly resolveTools: () => DirectLlmToolManifest[] | undefined;
  private readonly attachmentContentResolver?: AttachmentContentResolver;
  private readonly prepareMessages?: MisoChatTransportOptions["prepareMessages"];
  private readonly onToolRoundCall?: MisoChatTransportOptions["onToolRoundCall"];
  private readonly onToolRoundClosed?: MisoChatTransportOptions["onToolRoundClosed"];
  private readonly onToolRoundAborted?: MisoChatTransportOptions["onToolRoundAborted"];
  private nextToolRoundSequence = 0;

  constructor(options: MisoChatTransportOptions) {
    this.resolveTargetModel =
      typeof options.targetModel === "function"
        ? options.targetModel
        : () => options.targetModel as DirectLlmTargetModel;
    this.systemPrompt = options.systemPrompt;
    const contextWindowOption = options.contextWindow;
    this.resolveContextWindow =
      typeof contextWindowOption === "function"
        ? contextWindowOption
        : () => contextWindowOption;
    const supportsVisionOption = options.supportsVision;
    this.resolveSupportsVision =
      typeof supportsVisionOption === "function"
        ? supportsVisionOption
        : () => supportsVisionOption === true;
    const modelParametersOption = options.modelParameters;
    this.resolveModelParameters =
      typeof modelParametersOption === "function"
        ? modelParametersOption
        : () => modelParametersOption;
    const toolsOption = options.tools;
    this.resolveTools =
      typeof toolsOption === "function" ? toolsOption : () => toolsOption;
    this.attachmentContentResolver = options.attachmentContentResolver;
    this.prepareMessages = options.prepareMessages;
    this.onToolRoundCall = options.onToolRoundCall;
    this.onToolRoundClosed = options.onToolRoundClosed;
    this.onToolRoundAborted = options.onToolRoundAborted;
  }

  async sendMessages(options: {
    trigger: "submit-message" | "regenerate-message";
    chatId: string;
    messageId: string | undefined;
    messages: UIMessage[];
    abortSignal: AbortSignal | undefined;
    headers?: Record<string, string> | Headers;
    body?: object;
    metadata?: unknown;
  }): Promise<ReadableStream<UIMessageChunk>> {
    const roundId = `tool-round-${this.nextToolRoundSequence++}`;
    const requestChatId = options.chatId;
    const { abortSignal, messageId } = options;
    abortSignal?.throwIfAborted();
    const targetModel = structuredClone(
      callClientCallback(this.resolveTargetModel),
    );
    const contextWindow = structuredClone(
      callClientCallback(this.resolveContextWindow),
    );
    const modelParameters = structuredClone(
      callClientCallback(this.resolveModelParameters),
    );
    const tools = structuredClone(callClientCallback(this.resolveTools));
    const supportsVision = callClientCallback(this.resolveSupportsVision);
    const overheadTokens = estimateDirectLlmRequestOverheadTokens({
      targetModel,
      systemPrompt: this.systemPrompt,
      modelParameters,
      tools,
    });
    const requestContext: MisoChatRequestContext = freezeSnapshot({
      targetModel,
      contextWindow,
      systemPrompt: this.systemPrompt,
      modelParameters,
      tools,
      supportsVision,
      overheadTokens,
    });
    const prepareForSend = async (forceCompaction: boolean) => {
      try {
        const messages = this.prepareMessages
          ? await this.prepareMessages(structuredClone(options.messages), {
              forceCompaction,
              chatId: requestChatId,
              abortSignal,
              requestContext,
            })
          : options.messages;
        abortSignal?.throwIfAborted();
        // 첨부 resolver가 비동기라 직렬화를 await 한다(resolver 캐시로 재전송은 즉시).
        return await uiMessagesToDirectLlm(
          messages,
          this.attachmentContentResolver,
          abortSignal,
        );
      } catch (error) {
        if (abortSignal?.aborted) {
          abortSignal.throwIfAborted();
        }
        if (error instanceof DirectLlmApiError) throw error;
        throw new DirectLlmApiError("client_callback_error");
      }
    };
    const misoMessages = await prepareForSend(false);
    abortSignal?.throwIfAborted();
    const onToolRoundCall = this.onToolRoundCall;
    const onToolRoundClosed = this.onToolRoundClosed;
    const onToolRoundAborted = this.onToolRoundAborted;
    const canForceCompaction = this.prepareMessages !== undefined;

    const stream = new ReadableStream<UIMessageChunk>({
      start(controller) {
        let counter = 0;
        let textId: string | null = null;
        let reasoningId: string | null = null;
        let finished = false;
        let failed = false;
        let toolCallsRegistered = false;
        let toolRoundClosed = false;
        let toolRoundAborted = false;
        let handle: DirectLlmStreamHandle | null = null;
        let handleAbortRequested = false;
        let handleAborted = false;
        let visibleOutput = false;
        let forceCompactionAttempted = false;
        let activeRequestSequence = 0;
        let retryPreparationPending = false;

        const nextId = (prefix: string) => `${prefix}-${counter++}`;
        const closeText = () => {
          if (textId) {
            controller.enqueue({ type: "text-end", id: textId });
            textId = null;
          }
        };
        const closeReasoning = () => {
          if (reasoningId) {
            controller.enqueue({ type: "reasoning-end", id: reasoningId });
            reasoningId = null;
          }
        };
        const errorMessage = (error: unknown) =>
          (
            error instanceof DirectLlmApiError
              ? error
              : new DirectLlmApiError("client_callback_error")
          ).message;
        const abortCurrentHandle = () => {
          if (!handle || handleAborted) {
            return;
          }
          handleAborted = true;
          handle.abort();
        };
        const abortHandle = () => {
          handleAbortRequested = true;
          abortCurrentHandle();
        };
        const abortToolRound = () => {
          if (!toolCallsRegistered || toolRoundClosed || toolRoundAborted) {
            return;
          }
          toolRoundAborted = true;
          onToolRoundAborted?.(roundId);
        };
        const failStream = (error: unknown) => {
          if (failed) {
            return;
          }
          failed = true;
          closeText();
          closeReasoning();
          let reportedError = error;
          try {
            abortHandle();
          } catch (abortError) {
            reportedError = abortError;
          }
          try {
            abortToolRound();
          } catch (abortError) {
            reportedError = abortError;
          }
          controller.enqueue({
            type: "error",
            errorText: errorMessage(reportedError),
          });
          controller.close();
        };
        const closeAbortedStream = () => {
          if (failed || finished) {
            return;
          }
          failed = true;
          closeText();
          closeReasoning();
          try {
            abortToolRound();
          } catch {
            // The user already cancelled. Closing the stream is the terminal action.
          }
          controller.enqueue({ type: "finish-step" });
          controller.enqueue({ type: "finish", finishReason: "stop" });
          controller.close();
        };
        const closeToolRound = () => {
          if (!toolCallsRegistered || toolRoundClosed) {
            return;
          }
          toolRoundClosed = true;
          onToolRoundClosed?.(roundId);
        };

        controller.enqueue({ type: "start", messageId });
        // step 경계: 툴 결과 후 자동 재전송 라운드가 같은 assistant 메시지에
        // 파트를 이어붙이므로, step-start 파트가 없으면 이전 라운드의 툴 파트가
        // "마지막 step"에 계속 포함되어 lastAssistantMessageIsCompleteWithToolCalls가
        // 영원히 true → 무한 재전송이 된다. 서버 streamText와 동일하게 라운드마다
        // start-step/finish-step을 감싼다.
        controller.enqueue({ type: "start-step" });

        const startRequest = (requestMessages: DirectLlmMessage[]) => {
          const requestSequence = ++activeRequestSequence;
          handleAborted = false;
          handle = streamMisoLLM(
            {
              messages: requestMessages,
              targetModel: requestContext.targetModel,
              systemPrompt: requestContext.systemPrompt,
              modelParameters: requestContext.modelParameters,
              tools:
                requestContext.tools && requestContext.tools.length > 0
                  ? requestContext.tools
                  : undefined,
            },
            {
              onEvent: (event) => {
                if (failed || requestSequence !== activeRequestSequence) {
                  return;
                }
                switch (event.event) {
                  case "text_chunk": {
                    const delta =
                      typeof event.answer === "string" ? event.answer : "";
                    if (!delta) break;
                    visibleOutput = true;
                    closeReasoning();
                    if (!textId) {
                      textId = nextId("text");
                      controller.enqueue({ type: "text-start", id: textId });
                    }
                    controller.enqueue({ type: "text-delta", id: textId, delta });
                    break;
                  }
                  case "message_replace": {
                    // MISO sends a full-answer replacement. We can't rewind
                    // already-emitted deltas, so we close the current text part
                    // and emit the entire replacement as one delta on a fresh
                    // part. Consumers should treat the last text part as final.
                    const answer =
                      typeof event.answer === "string" ? event.answer : "";
                    visibleOutput = true;
                    closeReasoning();
                    closeText();
                    textId = nextId("text");
                    controller.enqueue({ type: "text-start", id: textId });
                    controller.enqueue({
                      type: "text-delta",
                      id: textId,
                      delta: answer,
                    });
                    break;
                  }
                  case "reasoning":
                  case "reasoning_chunk": {
                    const delta =
                      typeof event.answer === "string"
                        ? event.answer
                        : typeof event.data?.text === "string"
                          ? event.data.text
                          : "";
                    if (!delta) break;
                    visibleOutput = true;
                    if (!reasoningId) {
                      reasoningId = nextId("reasoning");
                      controller.enqueue({
                        type: "reasoning-start",
                        id: reasoningId,
                      });
                    }
                    controller.enqueue({
                      type: "reasoning-delta",
                      id: reasoningId,
                      delta,
                    });
                    break;
                  }
                  case "tool_call": {
                    visibleOutput = true;
                    const data = event.data ?? {};
                    const toolCallId =
                      typeof data.id === "string" ? data.id : "";
                    const toolName =
                      typeof data.name === "string" ? data.name : "";
                    const argsStr =
                      typeof data.arguments === "string" ? data.arguments : "";
                    let input: unknown;
                    try {
                      input = argsStr ? JSON.parse(argsStr) : {};
                    } catch {
                      input = argsStr;
                    }
                    closeText();
                    closeReasoning();
                    try {
                      onToolRoundCall?.({
                        roundId,
                        chatId: requestChatId,
                        toolCallId,
                        toolName,
                        input,
                        requestContext,
                      });
                    } catch (error) {
                      failStream(error);
                      return;
                    }
                    toolCallsRegistered = true;
                    // dynamic 플래그 없이 emit → AbstractChat이 `tool-${toolName}`
                    // 타입드 파트를 만든다. upstream message.tsx가 타입드 파트
                    // (tool-createDocument 등)로 문서 카드를 렌더하므로 필수.
                    // onToolCall은 타입드/dynamic 모두에 대해 호출된다.
                    controller.enqueue({
                      type: "tool-input-available",
                      toolCallId,
                      toolName,
                      input,
                    });
                    break;
                  }
                  case "message_end": {
                    closeText();
                    closeReasoning();
                    const data = event.data ?? {};
                    const finishReason = mapFinishReason(
                      typeof data.finish_reason === "string"
                        ? data.finish_reason
                        : undefined,
                    );
                    controller.enqueue({ type: "finish-step" });
                    try {
                      closeToolRound();
                    } catch (error) {
                      failStream(error);
                      return;
                    }
                    controller.enqueue({
                      type: "finish",
                      finishReason,
                      messageMetadata: {
                        usage: data.usage,
                        model: data.model ?? data.selected_model,
                      },
                    });
                    finished = true;
                    break;
                  }
                }
              },
              onError: (err) => {
                if (failed || requestSequence !== activeRequestSequence) {
                  return;
                }
                if (
                  canForceCompaction &&
                  !forceCompactionAttempted &&
                  !visibleOutput &&
                  isContextOverflowError(err)
                ) {
                  forceCompactionAttempted = true;
                  retryPreparationPending = true;
                  // Ignore terminal callbacks emitted by aborting the failed
                  // request while the replacement payload is being prepared.
                  activeRequestSequence += 1;
                  try {
                    abortCurrentHandle();
                  } catch (abortError) {
                    failStream(abortError);
                    return;
                  }
                  handle = null;
                  void prepareForSend(true)
                    .then((retryMessages) => {
                      retryPreparationPending = false;
                      if (failed || handleAbortRequested) {
                        return;
                      }
                      startRequest(retryMessages);
                    })
                    .catch((error) => {
                      retryPreparationPending = false;
                      failStream(error);
                    });
                  return;
                }
                failStream(err);
              },
              onDone: () => {
                if (failed || requestSequence !== activeRequestSequence) {
                  return;
                }
                closeText();
                closeReasoning();
                if (!finished) {
                  controller.enqueue({ type: "finish-step" });
                  try {
                    abortToolRound();
                  } catch (error) {
                    failStream(error);
                    return;
                  }
                  controller.enqueue({ type: "finish", finishReason: "stop" });
                }
                controller.close();
              },
            },
          );
          if (handleAbortRequested) {
            abortCurrentHandle();
          }
        };

        startRequest(misoMessages);

        if (abortSignal) {
          const abort = () => {
            try {
              abortToolRound();
              if (retryPreparationPending && !handle) {
                handleAbortRequested = true;
                closeAbortedStream();
                return;
              }
              abortHandle();
            } catch (error) {
              failStream(error);
            }
          };
          if (abortSignal.aborted) abort();
          else abortSignal.addEventListener("abort", abort, { once: true });
        }
      },
    });

    return stream;
  }

  reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return Promise.resolve(null);
  }
}

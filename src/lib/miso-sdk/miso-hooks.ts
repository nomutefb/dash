/**
 * MISO Integration Hooks — DO NOT MODIFY THIS FILE
 *
 * Provides React hooks to interact with MISO Service API (/ext/v1).
 * All requests are proxied through /__api/* → Session Manager → Flask.
 * Authentication is injected automatically by the proxy.
 *
 * Service API endpoints used:
 * - POST /ext/v1/chat                    → useMisoChat / useMisoChatStream
 * - POST /ext/v1/chat/:taskId/stop       → useMisoStop
 * - POST /ext/v1/workflows/run           → useMisoWorkflow / useMisoWorkflowStream
 * - POST /ext/v1/workflows/tasks/:id/stop→ useMisoStop
 * - GET  /ext/v1/workflows/run/:id       → useMisoWorkflowRun
 * - GET  /ext/v1/messages                → useMisoMessages
 * - GET  /ext/v1/conversations           → useMisoConversations
 * - POST /ext/v1/datasets/:id/search     → useMisoKnowledge
 * - GET  /ext/v1/info                    → useMisoAppInfo
 * - POST /__api/tools/invoke         → useMisoTool (via SM internal proxy)
 */

import { useState, useCallback, useRef } from "react";
import { misoClient } from "./miso-client";
import type { MisoSSEEvent, MisoStreamHandle } from "./miso-client";

// ── Common Types ──────────────────────────────────────────────────

/**
 * File input for MISO chat/workflow APIs.
 *
 * Two transfer methods:
 * 1. remote_url — pass an external URL directly (no upload needed)
 * 2. local_file — browser-selected file uploaded first, then referenced by upload_file_id
 *
 * IMPORTANT:
 * - Do NOT use PocketBase file upload for MISO app file inputs.
 * - Upload browser files through the MISO Service API first, then pass
 *   the returned upload_file_id in inputs/files payloads.
 */
export interface MisoFileInput {
  /** File category: "image" | "document" | "audio" | "video" */
  type: string;
  /** How the file is provided */
  transfer_method: "local_file" | "remote_url";
  /** External URL (for remote_url) or empty string (for local_file) */
  url: string;
  /** Upload file ID (for local_file) or empty string (for remote_url) */
  upload_file_id: string;
}

export interface MisoUploadedFile {
  id: string;
  name?: string;
  size?: number;
  extension?: string;
  mime_type?: string;
  [key: string]: unknown;
}

/** SSE event handler callbacks for streaming hooks */
export interface StreamEventHandlers {
  /** Called for each incremental text chunk (event: "message", "agent_message", or "text_chunk") */
  onMessage?: (chunk: string, event: MisoSSEEvent) => void;
  /** Called when the full answer is replaced in-place (event: "message_replace") */
  onMessageReplace?: (answer: string, event: MisoSSEEvent) => void;
  /** Called when workflow starts */
  onWorkflowStarted?: (event: MisoSSEEvent) => void;
  /** Called when a workflow node starts */
  onNodeStarted?: (event: MisoSSEEvent) => void;
  /** Called when a workflow node finishes */
  onNodeFinished?: (event: MisoSSEEvent) => void;
  /** Called when the message is complete (event: "message_end") */
  onMessageEnd?: (event: MisoSSEEvent) => void;
  /** Called when workflow finishes */
  onWorkflowFinished?: (event: MisoSSEEvent) => void;
  /** Called on error (event: "error" or network error) */
  onError?: (error: Error) => void;
  /** Called when streaming completes (including abort) */
  onDone?: () => void;
}

interface UseMisoFileUploadReturn {
  upload: (
    file: File | Blob,
    options?: { filename?: string },
  ) => Promise<MisoUploadedFile>;
  data: MisoUploadedFile | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Upload a browser-selected file for later use with transfer_method="local_file".
 *
 * The SDK adds X-Miso-App automatically when appId is provided, so uploads work
 * in multi-app coder sandboxes without manual header wiring.
 */
export function useMisoFileUpload(appId?: string): UseMisoFileUploadReturn {
  const [data, setData] = useState<MisoUploadedFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (
      file: File | Blob,
      options?: { filename?: string },
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        const fallbackFilename =
          options?.filename ||
          (file instanceof File ? file.name : "upload.bin");
        formData.append("file", file, fallbackFilename);

        const result = await misoClient.upload<MisoUploadedFile>("/files/upload", {
          appId,
          body: formData,
        });
        setData(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "File upload failed";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [appId],
  );

  return { upload, data, isLoading, error };
}

// ── useMisoChat (blocking) ────────────────────────────────────────

interface ChatMessage {
  id: string;
  answer: string;
  conversation_id: string;
  created_at: number;
  [key: string]: unknown;
}

interface UseMisoChatReturn {
  send: (message: string, options?: {
    conversationId?: string;
    files?: MisoFileInput[];
    inputs?: Record<string, unknown>;
  }) => Promise<ChatMessage>;
  data: ChatMessage | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Send chat messages (blocking mode).
 *
 * @example
 * ```tsx
 * const { send, data, isLoading } = useMisoChat("app-uuid");
 * const reply = await send("Hello!");
 * await send("Tell me more", { conversationId: reply.conversation_id });
 * ```
 */
export function useMisoChat(appId?: string): UseMisoChatReturn {
  const [data, setData] = useState<ChatMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (message: string, options?: {
      conversationId?: string;
      files?: MisoFileInput[];
      inputs?: Record<string, unknown>;
    }) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await misoClient.post<ChatMessage>("/chat", {
          appId,
          body: {
            inputs: options?.inputs ?? {},
            query: message,
            response_mode: "blocking",
            mode: "blocking",
            ...(options?.conversationId && { conversation_id: options.conversationId }),
            ...(options?.files && { files: options.files }),
          },
        });
        setData(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Chat send failed";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [appId],
  );

  return { send, data, isLoading, error };
}

// ── useMisoChatStream (streaming) ─────────────────────────────────

interface UseMisoChatStreamReturn {
  send: (message: string, options?: {
    conversationId?: string;
    files?: MisoFileInput[];
    inputs?: Record<string, unknown>;
    handlers?: StreamEventHandlers;
  }) => void;
  /** Accumulated answer text so far */
  answer: string;
  /** task_id from the stream (needed for stop) */
  taskId: string | null;
  /** conversation_id from the stream */
  conversationId: string | null;
  isStreaming: boolean;
  error: string | null;
  /** Abort the current stream */
  abort: () => void;
}

/**
 * Chat with streaming (SSE). Yields text chunks in real time.
 *
 * @example
 * ```tsx
 * const { send, answer, isStreaming, abort } = useMisoChatStream("app-uuid");
 * send("What is AI?", {
 *   handlers: {
 *     onMessage: (chunk) => console.log("chunk:", chunk),
 *     onMessageReplace: (answer) => console.log("replace:", answer),
 *     onMessageEnd: (event) => console.log("done:", event),
 *   }
 * });
 * // answer stays normalized for agent streams as "agent_message" and "message_replace" events arrive
 * ```
 */
export function useMisoChatStream(appId?: string): UseMisoChatStreamReturn {
  const [answer, setAnswer] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<MisoStreamHandle | null>(null);

  const send = useCallback(
    (message: string, options?: {
      conversationId?: string;
      files?: MisoFileInput[];
      inputs?: Record<string, unknown>;
      handlers?: StreamEventHandlers;
    }) => {
      // Reset state
      setAnswer("");
      setTaskId(null);
      setConversationId(null);
      setError(null);
      setIsStreaming(true);

      handleRef.current = misoClient.stream("/chat", {
        appId,
        body: {
          inputs: options?.inputs ?? {},
          query: message,
          response_mode: "streaming",
          mode: "streaming",
          ...(options?.conversationId && { conversation_id: options.conversationId }),
          ...(options?.files && { files: options.files }),
        },
        onEvent: (event) => {
          if (event.task_id) setTaskId(event.task_id);
          if (event.conversation_id) setConversationId(event.conversation_id);

          switch (event.event) {
            case "message":
            case "agent_message":
            case "text_chunk": {
              const text =
                event.answer ??
                ((event.data as Record<string, unknown> | undefined)?.text as string | undefined);
              if (text) {
                setAnswer((prev) => prev + text);
                options?.handlers?.onMessage?.(text, event);
              }
              break;
            }
            case "message_replace":
              if (event.answer) {
                setAnswer(event.answer);
                options?.handlers?.onMessageReplace?.(event.answer, event);
              }
              break;
            case "message_end":
              if (event.answer) {
                setAnswer(event.answer);
              }
              options?.handlers?.onMessageEnd?.(event);
              break;
            case "workflow_started":
              options?.handlers?.onWorkflowStarted?.(event);
              break;
            case "node_started":
              options?.handlers?.onNodeStarted?.(event);
              break;
            case "node_finished":
              options?.handlers?.onNodeFinished?.(event);
              break;
            case "workflow_finished":
              options?.handlers?.onWorkflowFinished?.(event);
              break;
            case "error":
              setError(String(event.message || event.data?.message || "Stream error"));
              options?.handlers?.onError?.(new Error(String(event.message || "Stream error")));
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
      });
    },
    [appId],
  );

  const abort = useCallback(() => {
    handleRef.current?.abort();
    handleRef.current = null;
  }, []);

  return { send, answer, taskId, conversationId, isStreaming, error, abort };
}

// ── useMisoAgent ──────────────────────────────────────────────────

/** Alias for useMisoChat — agent apps use the same chat interface. */
export function useMisoAgent(appId?: string) {
  return useMisoChat(appId);
}

/** Alias for useMisoChatStream — agent apps use the same streaming interface. */
export function useMisoAgentStream(appId?: string) {
  return useMisoChatStream(appId);
}

// ── useMisoWorkflow (blocking) ────────────────────────────────────

interface WorkflowResult {
  workflow_run_id: string;
  task_id: string;
  data: {
    outputs: Record<string, unknown>;
    [key: string]: unknown;
  };
}

interface UseMisoWorkflowReturn {
  run: (inputs: Record<string, unknown>, options?: {
    files?: MisoFileInput[];
  }) => Promise<WorkflowResult>;
  data: WorkflowResult | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Run a MISO workflow (blocking mode).
 *
 * @example
 * ```tsx
 * const { run, data, isLoading } = useMisoWorkflow("workflow-uuid");
 * await run({ question: "What is AI?" });
 * ```
 */
export function useMisoWorkflow(workflowId?: string): UseMisoWorkflowReturn {
  const [data, setData] = useState<WorkflowResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (inputs: Record<string, unknown>, options?: { files?: unknown[] }) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await misoClient.post<WorkflowResult>("/workflows/run", {
          appId: workflowId,
          body: {
            inputs,
            response_mode: "blocking",
            mode: "blocking",
            ...(options?.files && { files: options.files }),
          },
        });
        setData(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Workflow run failed";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [workflowId],
  );

  return { run, data, isLoading, error };
}

// ── useMisoWorkflowStream (streaming) ─────────────────────────────

interface UseMisoWorkflowStreamReturn {
  run: (inputs: Record<string, unknown>, options?: {
    files?: MisoFileInput[];
    handlers?: StreamEventHandlers;
  }) => void;
  answer: string;
  taskId: string | null;
  workflowRunId: string | null;
  isStreaming: boolean;
  error: string | null;
  abort: () => void;
}

/**
 * Run a MISO workflow with streaming (SSE).
 *
 * @example
 * ```tsx
 * const { run, answer, isStreaming } = useMisoWorkflowStream("workflow-uuid");
 * run({ question: "Explain quantum computing" }, {
 *   handlers: {
 *     onNodeStarted: (e) => console.log("Node:", e.data?.title),
 *     onMessage: (chunk) => console.log(chunk),
 *   }
 * });
 * ```
 */
export function useMisoWorkflowStream(workflowId?: string): UseMisoWorkflowStreamReturn {
  const [answer, setAnswer] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<MisoStreamHandle | null>(null);

  const run = useCallback(
    (inputs: Record<string, unknown>, options?: {
      files?: MisoFileInput[];
      handlers?: StreamEventHandlers;
    }) => {
      setAnswer("");
      setTaskId(null);
      setWorkflowRunId(null);
      setError(null);
      setIsStreaming(true);

      handleRef.current = misoClient.stream("/workflows/run", {
        appId: workflowId,
        body: {
          inputs,
          response_mode: "streaming",
          mode: "streaming",
          ...(options?.files && { files: options.files }),
        },
        onEvent: (event) => {
          if (event.task_id) setTaskId(event.task_id);
          if (event.workflow_run_id) setWorkflowRunId(event.workflow_run_id);

          switch (event.event) {
            case "message":
            case "text_chunk": {
              const text =
                event.answer ??
                (event.data as Record<string, unknown> | undefined)?.text as string | undefined;
              if (text) {
                setAnswer((prev) => prev + text);
                options?.handlers?.onMessage?.(text, event);
              }
              break;
            }
            case "message_end":
              options?.handlers?.onMessageEnd?.(event);
              break;
            case "workflow_started":
              options?.handlers?.onWorkflowStarted?.(event);
              break;
            case "node_started":
              options?.handlers?.onNodeStarted?.(event);
              break;
            case "node_finished":
              options?.handlers?.onNodeFinished?.(event);
              break;
            case "workflow_finished":
              options?.handlers?.onWorkflowFinished?.(event);
              break;
            case "error":
              setError(String(event.message || "Stream error"));
              options?.handlers?.onError?.(new Error(String(event.message || "Stream error")));
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
      });
    },
    [workflowId],
  );

  const abort = useCallback(() => {
    handleRef.current?.abort();
    handleRef.current = null;
  }, []);

  return { run, answer, taskId, workflowRunId, isStreaming, error, abort };
}

// ── useMisoStop ───────────────────────────────────────────────────

interface UseMisoStopReturn {
  /** Stop a running chat/agent task */
  stopChat: (taskId: string) => Promise<void>;
  /** Stop a running workflow task */
  stopWorkflow: (taskId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Stop in-progress chat or workflow tasks.
 *
 * @example
 * ```tsx
 * const { stopChat } = useMisoStop("app-uuid");
 * const stream = useMisoChatStream("app-uuid");
 * // ... later
 * await stopChat(stream.taskId!);
 * stream.abort(); // also abort client-side
 * ```
 */
export function useMisoStop(appId?: string): UseMisoStopReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopChat = useCallback(
    async (taskId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await misoClient.post(`/chat/${taskId}/stop`, {
          appId,
          body: {},
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to stop chat";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [appId],
  );

  const stopWorkflow = useCallback(
    async (taskId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await misoClient.post(`/workflows/tasks/${taskId}/stop`, {
          appId,
          body: {},
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to stop workflow";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [appId],
  );

  return { stopChat, stopWorkflow, isLoading, error };
}

// ── useMisoMessages ───────────────────────────────────────────────

interface MessageItem {
  id: string;
  query: string;
  answer: string;
  created_at: number;
  feedback: unknown;
  [key: string]: unknown;
}

interface UseMisoMessagesReturn {
  fetch: (conversationId: string, options?: { firstId?: string; limit?: number }) => Promise<MessageItem[]>;
  messages: MessageItem[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetch message history for a conversation.
 *
 * @example
 * ```tsx
 * const { fetch, messages } = useMisoMessages();
 * await fetch("conversation-uuid");
 * ```
 */
export function useMisoMessages(appId?: string): UseMisoMessagesReturn {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(
    async (conversationId: string, options?: { firstId?: string; limit?: number }) => {
      setIsLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number> = {
          conversation_id: conversationId,
        };
        if (options?.firstId) params.first_id = options.firstId;
        if (options?.limit) params.limit = options.limit;

        const result = await misoClient.get<{ data: MessageItem[] }>("/messages", { params, appId });
        setMessages(result.data || []);
        return result.data || [];
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch messages";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [appId],
  );

  return { fetch: fetchMessages, messages, isLoading, error };
}

// ── useMisoConversations ──────────────────────────────────────────

interface ConversationItem {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  [key: string]: unknown;
}

interface UseMisoConversationsReturn {
  fetch: (options?: { lastId?: string; limit?: number }) => Promise<ConversationItem[]>;
  conversations: ConversationItem[];
  isLoading: boolean;
  error: string | null;
}

/**
 * List conversations.
 *
 * @example
 * ```tsx
 * const { fetch, conversations } = useMisoConversations("app-uuid");
 * await fetch({ limit: 10 });
 * ```
 */
export function useMisoConversations(appId?: string): UseMisoConversationsReturn {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(
    async (options?: { lastId?: string; limit?: number }) => {
      setIsLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number> = {
        };
        if (options?.lastId) params.last_id = options.lastId;
        if (options?.limit) params.limit = options.limit;

        const result = await misoClient.get<{ data: ConversationItem[] }>("/conversations", { params, appId });
        setConversations(result.data || []);
        return result.data || [];
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch conversations";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [appId],
  );

  return { fetch: fetchConversations, conversations, isLoading, error };
}

// ── useMisoKnowledge ──────────────────────────────────────────────

const KNOWLEDGE_SEARCH_TIMEOUT_MS = 200_000;

interface KnowledgeResult {
  query: { content: string };
  records: Array<{
    content?: string;
    segment?: { content?: string; [key: string]: unknown };
    score: number;
    [key: string]: unknown;
  }>;
}

interface UseMisoKnowledgeReturn {
  search: (query: string, options?: { topK?: number; scoreThreshold?: number }) => Promise<KnowledgeResult>;
  results: KnowledgeResult | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Search a MISO Knowledge Base (dataset).
 *
 * @example
 * ```tsx
 * const { search, results } = useMisoKnowledge("dataset-uuid");
 * await search("How to reset password?");
 * ```
 */
export function useMisoKnowledge(datasetId: string): UseMisoKnowledgeReturn {
  const [results, setResults] = useState<KnowledgeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (query: string, options?: { topK?: number; scoreThreshold?: number }) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await misoClient.post<KnowledgeResult>(
          `/datasets/${datasetId}/search`,
          {
            appId: datasetId,
            signal: AbortSignal.timeout(KNOWLEDGE_SEARCH_TIMEOUT_MS),
            body: {
              query,
                ...((options?.topK != null || options?.scoreThreshold != null) && {
                retrieval_model: {
                  ...(options?.topK != null && { top_k: options.topK }),
                  ...(options?.scoreThreshold != null && {
                    score_threshold_enabled: true,
                    score_threshold: options.scoreThreshold,
                  }),
                },
              }),
            },
          },
        );
        setResults(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Knowledge search failed";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [datasetId],
  );

  return { search, results, isLoading, error };
}

// ── useMisoWorkflowRun ───────────────────────────────────────────

interface WorkflowRunDetail {
  id: string;
  workflow_id: string;
  status: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown> | null;
  error: string | null;
  total_steps: number;
  total_tokens: number;
  created_at: string;
  finished_at: string | null;
  elapsed_time: number | null;
}

interface UseMisoWorkflowRunReturn {
  fetch: (runId: string) => Promise<WorkflowRunDetail>;
  data: WorkflowRunDetail | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Get details of a specific workflow run.
 *
 * @example
 * ```tsx
 * const { fetch, data } = useMisoWorkflowRun("workflow-app-uuid");
 * await fetch("run-uuid");
 * console.log(data?.status, data?.outputs);
 * ```
 */
export function useMisoWorkflowRun(appId?: string): UseMisoWorkflowRunReturn {
  const [data, setData] = useState<WorkflowRunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRun = useCallback(
    async (runId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await misoClient.get<WorkflowRunDetail>(
          `/workflows/run/${runId}`,
          { appId },
        );
        setData(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch workflow run";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [appId],
  );

  return { fetch: fetchRun, data, isLoading, error };
}

// ── useMisoAppInfo ────────────────────────────────────────────────

interface AppInfo {
  name: string;
  description: string;
  tags: string[];
  app_type: string;
  technical_specs: {
    limits: Record<string, number>;
    timeouts: Record<string, number>;
    model: unknown;
    all_models: unknown[];
  };
  [key: string]: unknown;
}

interface UseMisoAppInfoReturn {
  fetch: () => Promise<AppInfo>;
  info: AppInfo | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Get MISO app metadata (name, type, specs).
 *
 * @example
 * ```tsx
 * const { fetch, info } = useMisoAppInfo("app-uuid");
 * await fetch();
 * console.log(info?.app_type); // "advanced-chat"
 * ```
 */
export function useMisoAppInfo(appId?: string): UseMisoAppInfoReturn {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(
    async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await misoClient.get<AppInfo>("/info", { appId });
        setInfo(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch app info";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [appId],
  );

  return { fetch: fetchInfo, info, isLoading, error };
}

// ── useMisoAppParams ──────────────────────────────────────────────

/** A single input form field definition */
export interface MisoInputField {
  /** Field type key: "text-input", "paragraph", "select", "number" */
  type: string;
  label: string;
  variable: string;
  required: boolean;
  max_length?: number;
  default?: string | number;
  options?: string[];
  [key: string]: unknown;
}

interface AppParams {
  user_input_form: Array<Record<string, MisoInputField>>;
  opening_statement: string;
  suggested_questions: string[];
  file_upload: {
    enabled: boolean;
    allowed_file_types: string[];
    allowed_file_extensions: string[];
    number_limits: number;
    image: { enabled: boolean };
    [key: string]: unknown;
  };
  app_type: string;
  [key: string]: unknown;
}

interface UseMisoAppParamsReturn {
  fetch: () => Promise<AppParams>;
  params: AppParams | null;
  /** Parsed flat list of input fields for easy iteration */
  inputFields: MisoInputField[];
  isLoading: boolean;
  error: string | null;
}

export function getMisoFileInputFields(inputFields: MisoInputField[]): MisoInputField[] {
  return inputFields.filter((field) => field.type === "file" || field.type === "file-list");
}

/**
 * Get MISO app parameters (input form schema, file upload config, etc.).
 * Use this to dynamically build input forms based on the app's configuration.
 *
 * @example
 * ```tsx
 * const { fetch, inputFields, params } = useMisoAppParams("app-uuid");
 * await fetch();
 *
 * // Render input fields dynamically
 * inputFields.map(field => (
 *   <label key={field.variable}>
 *     {field.label}
 *     {field.type === "select"
 *       ? <select>{field.options?.map(o => <option key={o}>{o}</option>)}</select>
 *       : <input required={field.required} maxLength={field.max_length} />
 *     }
 *   </label>
 * ));
 *
 * // Runtime params are the source of truth for file inputs.
 * // If any field.type is "file" or "file-list", upload the file first and
 * // put the resulting object(s) into inputs under that variable name.
 *
 * // Pass values to chat/workflow
 * const { send } = useMisoChat("app-uuid");
 * await send("Hello", { inputs: { language: "한국어", question: "..." } });
 * ```
 */
// ── useMisoTool ──────────────────────────────────────────────────

interface ToolResult {
  result: string;
  metadata: {
    tool_name: string;
    provider_id: string;
    elapsed_time: number;
    error: boolean;
    /** True when execution may still have produced side effects; do not retry with a new key. */
    outcome_uncertain?: boolean;
  };
}

export interface MisoToolInvokeOptions {
  /** Stable key to reuse only when retrying the same logical invocation. */
  idempotencyKey?: string;
}

interface UseMisoToolReturn {
  invoke: (
    parameters: Record<string, unknown>,
    options?: MisoToolInvokeOptions,
  ) => Promise<ToolResult>;
  data: ToolResult | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Invoke a workspace tool directly.
 *
 * @param providerType - "builtin" | "api" | "workflow" | "mcp"
 * @param providerId - Tool provider identifier
 * @param toolName - Specific tool name within the provider
 * @param appId - (Optional) MISO app ID for multi-app token routing
 *
 * @example
 * ```tsx
 * const { invoke, data, isLoading, error } = useMisoTool("builtin", "google", "google_search", "app-uuid");
 *
 * const idempotencyKey = crypto.randomUUID();
 * const result = await invoke(
 *   { query: "latest AI news" },
 *   { idempotencyKey },
 * );
 * // Reuse idempotencyKey only when retrying this same logical invocation.
 * // result.result — tool execution output (text or JSON)
 * ```
 */
export function useMisoTool(
  providerType: string,
  providerId: string,
  toolName: string,
  appId?: string,
): UseMisoToolReturn {
  const [data, setData] = useState<ToolResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoke = useCallback(
    async (
      parameters: Record<string, unknown>,
      options?: MisoToolInvokeOptions,
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const idempotencyKey = options?.idempotencyKey?.trim();
        const result = await misoClient.post<ToolResult>("/tools/invoke", {
          appId,
          ...(idempotencyKey
            ? { headers: { "Idempotency-Key": idempotencyKey } }
            : {}),
          body: {
            provider_type: providerType,
            provider_id: providerId,
            tool_name: toolName,
            parameters,
          },
        });
        setData(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Tool invocation failed";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [providerType, providerId, toolName, appId],
  );

  return { invoke, data, isLoading, error };
}

export function useMisoAppParams(appId?: string): UseMisoAppParamsReturn {
  const [params, setParams] = useState<AppParams | null>(null);
  const [inputFields, setInputFields] = useState<MisoInputField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchParams = useCallback(
    async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await misoClient.get<AppParams>("/params", { appId });
        setParams(result);

        // Flatten user_input_form into a simple array
        const fields: MisoInputField[] = (result.user_input_form || []).map((item) => {
          const [type, def] = Object.entries(item)[0];
          return { ...def, type };
        });
        setInputFields(fields);

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch app params";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [appId],
  );

  return { fetch: fetchParams, params, inputFields, isLoading, error };
}

/// <reference types="vite/client" />

/**
 * MISO Direct LLM client-side tool orchestration.
 *
 * Builds on top of `streamMisoLLM` (miso-llm.ts) to run the tool-calling loop
 * entirely on the client:
 *   1. stream a completion with a tool manifest
 *   2. when `finish_reason === "tool_calls"`, execute each requested tool
 *   3. append the assistant tool-call message + tool result messages
 *   4. re-request until the model stops asking for tools
 *
 * Tool definitions accept either a Zod schema (auto-converted to JSON Schema
 * via `z.toJSONSchema`, with input validation on execute) or a raw JSON Schema
 * object.
 */

import { z } from "zod";
import {
  invokeMisoLLM,
  streamMisoLLM,
  type DirectLlmCompletionResponse,
  type DirectLlmMessage,
  type DirectLlmStreamHandle,
  type DirectLlmTargetModel,
  type DirectLlmToolCall,
  type DirectLlmToolManifest,
} from "./miso-llm";
import {
  DirectLlmApiError,
  normalizeDirectLlmClientError,
} from "./direct-llm-error";

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

/** A single Direct LLM client tool definition. */
export interface DirectLlmToolDefinition {
  description: string;
  /** A Zod schema (validated + auto JSON-Schema) or a raw JSON Schema object. */
  inputSchema: z.ZodType | Record<string, unknown>;
  execute: (input: unknown) => Promise<unknown> | unknown;
}

/** The compiled tool set: wire manifests + name-keyed executors. */
export interface DirectLlmToolSet {
  manifests: DirectLlmToolManifest[];
  executors: Record<string, (input: unknown) => Promise<unknown>>;
}

/**
 * A single tool invocation, structurally aligned with AI SDK tool parts so the
 * same shape can drive both this SDK and an AI-SDK `useChat` UI.
 */
export interface DirectLlmToolInvocation {
  toolCallId: string;
  toolName: string;
  state: "input-available" | "output-available" | "output-error";
  input: unknown;
  output?: unknown;
  errorText?: string;
}

function isZodSchema(
  schema: z.ZodType | Record<string, unknown>,
): schema is z.ZodType {
  return typeof (schema as { safeParse?: unknown }).safeParse === "function";
}

/**
 * Compile a record of tool definitions into a `DirectLlmToolSet`. Zod schemas are
 * converted to JSON Schema for the manifest and used to validate input before
 * `execute` runs; validation failures are returned to the model as an error
 * result rather than thrown.
 */
export function defineMisoLLMTools(
  defs: Record<string, DirectLlmToolDefinition>,
): DirectLlmToolSet {
  const manifests: DirectLlmToolManifest[] = [];
  const executors: Record<string, (input: unknown) => Promise<unknown>> = {};

  for (const [name, def] of Object.entries(defs)) {
    const zodSchema = isZodSchema(def.inputSchema) ? def.inputSchema : null;
    const inputSchema: Record<string, unknown> = zodSchema
      ? (z.toJSONSchema(zodSchema) as unknown as Record<string, unknown>)
      : (def.inputSchema as Record<string, unknown>);

    manifests.push({ name, description: def.description, input_schema: inputSchema });

    executors[name] = async (rawInput: unknown): Promise<unknown> => {
      let input = rawInput;
      if (zodSchema) {
        const parsed = zodSchema.safeParse(rawInput);
        if (!parsed.success) {
          return {
            error: "invalid_tool_input",
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path.map((segment) => String(segment)).join("."),
              message: issue.message,
            })),
          };
        }
        input = parsed.data;
      }
      return def.execute(input);
    };
  }

  return { manifests, executors };
}

function parseToolArguments(call: DirectLlmToolCall): unknown {
  try {
    return call.arguments ? JSON.parse(call.arguments) : {};
  } catch {
    return call.arguments;
  }
}

function invokeClientCallback<T>(
  callback: ((value: T) => void) | undefined,
  value: T,
): void {
  if (!callback) return;
  try {
    callback(value);
  } catch {
    throw new DirectLlmApiError("client_callback_error");
  }
}

async function executeToolCall(
  call: DirectLlmToolCall,
  tools: DirectLlmToolSet,
  onToolCall?: (call: DirectLlmToolInvocation) => void,
  onToolResult?: (result: DirectLlmToolInvocation) => void,
): Promise<{
  invocation: DirectLlmToolInvocation;
  message: DirectLlmMessage;
}> {
  const parsedArgs = parseToolArguments(call);
  const base: DirectLlmToolInvocation = {
    toolCallId: call.id,
    toolName: call.name,
    state: "input-available",
    input: parsedArgs,
  };
  invokeClientCallback(onToolCall, base);

  const executor = tools.executors[call.name];
  let result: DirectLlmToolInvocation;
  let resultContent: string;

  if (!executor) {
    const toolError = new DirectLlmApiError("tool_execution_error");
    const errorText = toolError.message;
    result = { ...base, state: "output-error", errorText };
    resultContent = JSON.stringify(toolError.toPayload());
  } else {
    try {
      const output = await executor(parsedArgs);
      result = { ...base, state: "output-available", output };
      // Never an empty string: JSON.stringify(x ?? null) is "null" at worst.
      resultContent = JSON.stringify(output ?? null);
    } catch (err) {
      const toolError = normalizeDirectLlmClientError(
        err,
        "tool_execution_error",
      );
      const errorText = toolError.message;
      result = { ...base, state: "output-error", errorText };
      resultContent = JSON.stringify(toolError.toPayload());
    }
  }

  invokeClientCallback(onToolResult, result);

  return {
    invocation: result,
    message: {
      role: "tool",
      content: resultContent,
      toolCallId: call.id,
      name: call.name,
    },
  };
}

// ---------------------------------------------------------------------------
// Non-streaming tool loop
// ---------------------------------------------------------------------------

export interface InvokeMisoLLMWithToolsRequest {
  messages: DirectLlmMessage[];
  targetModel: DirectLlmTargetModel;
  systemPrompt?: string;
  modelParameters?: Record<string, unknown>;
  tools: DirectLlmToolSet;
  /** Maximum number of model round-trips before giving up. Default: 8. */
  maxToolSteps?: number;
}

export interface InvokeMisoLLMWithToolsHandlers {
  onToolCall?: (call: DirectLlmToolInvocation) => void;
  onToolResult?: (result: DirectLlmToolInvocation) => void;
  onStepStart?: (step: number) => void;
}

export type InvokeMisoLLMWithToolsResponse = DirectLlmCompletionResponse & {
  toolInvocations: DirectLlmToolInvocation[];
  steps: number;
};

export async function invokeMisoLLMWithTools(
  request: InvokeMisoLLMWithToolsRequest,
  handlers: InvokeMisoLLMWithToolsHandlers = {},
): Promise<InvokeMisoLLMWithToolsResponse> {
  const maxToolSteps = request.maxToolSteps ?? 8;
  const workingMessages: DirectLlmMessage[] = [...request.messages];
  const invocations: DirectLlmToolInvocation[] = [];

  for (let step = 1; step <= maxToolSteps; step += 1) {
    invokeClientCallback(handlers.onStepStart, step);
    const response = await invokeMisoLLM({
      messages: workingMessages,
      targetModel: request.targetModel,
      systemPrompt: request.systemPrompt,
      modelParameters: request.modelParameters,
      tools: request.tools.manifests,
    });
    const toolCalls = response.tool_calls ?? [];

    if (toolCalls.length === 0) {
      return { ...response, toolInvocations: invocations, steps: step };
    }

    workingMessages.push({
      role: "assistant",
      content: response.answer,
      toolCalls,
    });

    for (const call of toolCalls) {
      const { invocation, message } = await executeToolCall(
        call,
        request.tools,
        handlers.onToolCall,
        handlers.onToolResult,
      );
      invocations.push(invocation);
      workingMessages.push(message);
    }
  }

  throw new DirectLlmApiError("tool_step_limit_exceeded");
}

// ---------------------------------------------------------------------------
// Streaming tool loop
// ---------------------------------------------------------------------------

export interface StreamMisoLLMWithToolsRequest {
  messages: DirectLlmMessage[];
  targetModel: DirectLlmTargetModel;
  systemPrompt?: string;
  modelParameters?: Record<string, unknown>;
  tools: DirectLlmToolSet;
  /** Maximum number of model round-trips before giving up. Default: 8. */
  maxToolSteps?: number;
  signal?: AbortSignal;
}

export interface StreamMisoLLMWithToolsHandlers {
  onText?: (chunk: string) => void;
  onReasoning?: (chunk: string) => void;
  onToolCall?: (call: DirectLlmToolInvocation) => void;
  onToolResult?: (result: DirectLlmToolInvocation) => void;
  onMessageReplace?: (answer: string) => void;
  onStepStart?: (step: number) => void;
  onDone?: (final: {
    text: string;
    steps: number;
    invocations: DirectLlmToolInvocation[];
  }) => void;
  onError?: (error: Error) => void;
}

export interface StreamMisoLLMWithToolsHandle {
  abort: () => void;
}

function extractReasoning(event: {
  answer?: string;
  data?: Record<string, unknown>;
}): string {
  if (typeof event.answer === "string") return event.answer;
  const text = event.data?.text;
  return typeof text === "string" ? text : "";
}

/**
 * Run the client-side tool-calling loop. A single `AbortController` chains the
 * caller's `signal` and aborts the in-flight stream on `abort()`.
 */
export function streamMisoLLMWithTools(
  request: StreamMisoLLMWithToolsRequest,
  handlers: StreamMisoLLMWithToolsHandlers = {},
): StreamMisoLLMWithToolsHandle {
  const maxToolSteps = request.maxToolSteps ?? 8;
  const controller = new AbortController();
  let abortCurrent: (() => void) | null = null;

  if (request.signal) {
    if (request.signal.aborted) controller.abort();
    else request.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  controller.signal.addEventListener("abort", () => abortCurrent?.());

  const workingMessages: DirectLlmMessage[] = [...request.messages];
  const invocations: DirectLlmToolInvocation[] = [];

  const runStep = async (step: number): Promise<void> => {
    if (controller.signal.aborted) return;
    if (step > maxToolSteps) {
      invokeClientCallback(
        handlers.onError,
        new DirectLlmApiError("tool_step_limit_exceeded"),
      );
      return;
    }
    invokeClientCallback(handlers.onStepStart, step);

    let stepText = "";
    let finishReason: string | undefined;
    let streamError: Error | null = null;
    const pendingToolCalls: DirectLlmToolCall[] = [];

    await new Promise<void>((resolve) => {
      const handle: DirectLlmStreamHandle = streamMisoLLM(
        {
          messages: workingMessages,
          targetModel: request.targetModel,
          systemPrompt: request.systemPrompt,
          modelParameters: request.modelParameters,
          tools: request.tools.manifests,
        },
        {
          onEvent: (event) => {
            switch (event.event) {
              case "text_chunk":
                if (typeof event.answer === "string" && event.answer) {
                  stepText += event.answer;
                  invokeClientCallback(handlers.onText, event.answer);
                }
                break;
              case "message_replace":
                if (typeof event.answer === "string") {
                  stepText = event.answer;
                  invokeClientCallback(handlers.onMessageReplace, event.answer);
                }
                break;
              case "reasoning":
              case "reasoning_chunk": {
                const chunk = extractReasoning(event);
                if (chunk) invokeClientCallback(handlers.onReasoning, chunk);
                break;
              }
              case "tool_call": {
                const data = event.data ?? {};
                pendingToolCalls.push({
                  id: typeof data.id === "string" ? data.id : "",
                  name: typeof data.name === "string" ? data.name : "",
                  arguments:
                    typeof data.arguments === "string" ? data.arguments : "",
                });
                break;
              }
              case "message_end": {
                const data = event.data ?? {};
                finishReason =
                  typeof data.finish_reason === "string"
                    ? data.finish_reason
                    : undefined;
                break;
              }
            }
          },
          onError: (err) => {
            streamError = err;
            resolve();
          },
          onDone: () => resolve(),
        },
      );
      abortCurrent = () => handle.abort();
      if (controller.signal.aborted) handle.abort();
    });

    abortCurrent = null;
    if (controller.signal.aborted) return;
    if (streamError) {
      invokeClientCallback(
        handlers.onError,
        normalizeDirectLlmClientError(streamError),
      );
      return;
    }

    if (finishReason !== "tool_calls" || pendingToolCalls.length === 0) {
      invokeClientCallback(handlers.onDone, {
        text: stepText,
        steps: step,
        invocations,
      });
      return;
    }

    workingMessages.push({
      role: "assistant",
      content: stepText,
      toolCalls: pendingToolCalls,
    });

    for (const call of pendingToolCalls) {
      if (controller.signal.aborted) return;

      const { invocation, message } = await executeToolCall(
        call,
        request.tools,
        handlers.onToolCall,
        handlers.onToolResult,
      );
      invocations.push(invocation);
      workingMessages.push(message);
    }

    await runStep(step + 1);
  };

  runStep(1).catch((err) => {
    invokeClientCallback(
      handlers.onError,
      normalizeDirectLlmClientError(err),
    );
  });

  return { abort: () => controller.abort() };
}

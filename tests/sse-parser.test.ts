import http from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

/**
 * Next.js Frontend sse.ts parser logic under test (ported from
 * soveriegn-brain-app/src/shared/lib/sse.ts to assert backend stream compatibility).
 */
const SSE_DATA_PREFIX = "data:";

function couldBecomeDataPrefix(text: string): boolean {
  const checkLen = Math.min(text.length, SSE_DATA_PREFIX.length);
  return text.slice(0, checkLen) === SSE_DATA_PREFIX.slice(0, checkLen);
}

export interface ToolConfirmation {
  executionId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  reason: string;
  status: "pending" | "approved" | "rejected";
}

export function mapToToolConfirmation(payload: Record<string, unknown>): ToolConfirmation {
  return {
    executionId: String(payload.execution_id || ""),
    toolName: String(payload.tool_name || "unknown_tool"),
    arguments: (payload.arguments as Record<string, unknown>) || {},
    reason: String(payload.reason || ""),
    status: "pending",
  };
}

export interface ParseStreamOptions {
  onToken?: (token: string) => void;
  onSession?: (sessionId: string, traceId?: string) => void;
  onConfirmation?: (confirmation: ToolConfirmation) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export async function parseStreamReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  options: ParseStreamOptions = {},
): Promise<string> {
  const { onToken, onSession, onConfirmation, onComplete, onError, signal } = options;

  let accumulated = "";
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let lastLineWasData = false;

  const processJsonData = (parsed: Record<string, unknown>, rawData: string) => {
    if (parsed.type === "session" && parsed.session_id) {
      onSession?.(String(parsed.session_id), parsed.trace_id ? String(parsed.trace_id) : undefined);
      return;
    }

    if (parsed.type === "confirmation_required") {
      const confirmation = mapToToolConfirmation(parsed);
      onConfirmation?.(confirmation);
      const notifyText = `⚠️ Confirmation Required: Sovereign Brain requested to execute '${confirmation.toolName}'. Please approve or reject this action.`;
      accumulated += notifyText;
      onToken?.(notifyText);
      return;
    }

    if (parsed.token !== undefined || parsed.content !== undefined || parsed.message !== undefined) {
      const token = String(parsed.token ?? parsed.content ?? parsed.message ?? "");
      if (token) {
        accumulated += token;
        onToken?.(token);
      }
      return;
    }

    // Unrecognized structured event: do not leak raw JSON into visible chat
    if (typeof parsed.type === "string") {
      return;
    }

    if (rawData && !rawData.trim().startsWith("{")) {
      accumulated += rawData;
      onToken?.(rawData);
    }
  };

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException("The user aborted a request.", "AbortError");
      }
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lastNewlineIndex = buffer.lastIndexOf("\n");
      if (lastNewlineIndex !== -1) {
        const completeSegment = buffer.slice(0, lastNewlineIndex);
        buffer = buffer.slice(lastNewlineIndex + 1);

        const lines = completeSegment.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            if (lastLineWasData) {
              lastLineWasData = false;
              continue;
            }
            accumulated += "\n";
            onToken?.("\n");
            continue;
          }

          if (trimmed.startsWith("data:")) {
            lastLineWasData = true;
            const dataContent = trimmed.slice(5).trim();
            if (dataContent === "[DONE]") {
              continue;
            }
            try {
              const parsed = JSON.parse(dataContent);
              processJsonData(parsed, dataContent);
            } catch {
              accumulated += line + "\n";
              onToken?.(line + "\n");
            }
          } else {
            lastLineWasData = false;
            accumulated += line + "\n";
            onToken?.(line + "\n");
          }
        }
      } else if (buffer.length > 0 && !couldBecomeDataPrefix(buffer)) {
        accumulated += buffer;
        onToken?.(buffer);
        buffer = "";
      }
    }

    if (buffer.length > 0) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data:")) {
        const dataContent = trimmed.slice(5).trim();
        if (dataContent !== "[DONE]") {
          try {
            const parsed = JSON.parse(dataContent);
            processJsonData(parsed, dataContent);
          } catch {
            accumulated += buffer;
            onToken?.(buffer);
          }
        }
      } else {
        accumulated += buffer;
        onToken?.(buffer);
      }
      buffer = "";
    }

    onComplete?.(accumulated);
    return accumulated;
  } catch (err: any) {
    if (err?.name === "AbortError" || signal?.aborted) {
      onComplete?.(accumulated);
      return accumulated;
    }
    const error = err instanceof Error ? err : new Error(String(err));
    onError?.(error);
    throw error;
  }
}

// Mock upstream Ollama
const mockOllama = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", async () => {
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    res.write(JSON.stringify({ message: { content: "Hello " }, done: false }) + "\n");
    res.write(JSON.stringify({ message: { content: "world" }, done: false }) + "\n");
    res.write(JSON.stringify({ message: { content: "!" }, done: true }) + "\n");
    res.end();
  });
});

let server: FastifyInstance;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((r) => mockOllama.listen(0, "127.0.0.1", r));
  const ollamaPort = (mockOllama.address() as AddressInfo).port;

  process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${ollamaPort}`;
  process.env.API_KEY = "test-key";
  process.env.NODE_ENV = "test";

  const { buildServer } = await import("../src/app.js");
  server = await buildServer();
  await server.listen({ port: 0, host: "127.0.0.1" });
  baseUrl = `http://127.0.0.1:${(server.server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await server?.close();
  await new Promise((r) => mockOllama.close(r));
});

describe("Next.js sse.ts parser stream integration (Issue #17)", () => {
  it("parses live Fastify /api/v1/chat/stream response into onSession and clean tokens", async () => {
    const res = await fetch(`${baseUrl}/api/v1/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-key",
      },
      body: JSON.stringify({ message: "Say hello" }),
    });

    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();

    let receivedSessionId = "";
    let receivedTraceId = "";
    const receivedTokens: string[] = [];
    let completedText = "";

    const reader = res.body!.getReader();
    const result = await parseStreamReader(reader, {
      onSession: (sessionId, traceId) => {
        receivedSessionId = sessionId;
        receivedTraceId = traceId || "";
      },
      onToken: (token) => {
        receivedTokens.push(token);
      },
      onComplete: (full) => {
        completedText = full;
      },
    });

    // 1. Session frame must be captured
    expect(receivedSessionId).toBeTruthy();
    expect(receivedSessionId.startsWith("sess_")).toBe(true);
    expect(receivedTraceId).toBeTruthy();

    // 2. Tokens must not contain any raw JSON, "data:", or session metadata
    const combinedTokens = receivedTokens.join("");
    expect(combinedTokens).toContain("Hello world!");
    expect(combinedTokens).not.toContain("data:");
    expect(combinedTokens).not.toContain("session_id");
    expect(combinedTokens).not.toContain('"type":"session"');

    // 3. Final accumulated text must match
    expect(completedText).toContain("Hello world!");
    expect(result).toBe(completedText);
  });

  it("handles confirmation_required frames correctly without leaking raw JSON", async () => {
    // Synthetic stream delivering session frame, confirmation_required, and final token
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            'data: {"type":"session","session_id":"sess_test_123","trace_id":"trace_456"}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"type":"confirmation_required","execution_id":"exec_1","tool_name":"write_file","arguments":{"path":"foo.txt"},"reason":"file write guard"}\n\n',
          ),
        );
        controller.close();
      },
    });

    let capturedConfirmation: ToolConfirmation | null = null;
    let notifyToken = "";

    await parseStreamReader(stream.getReader(), {
      onConfirmation: (conf) => {
        capturedConfirmation = conf;
      },
      onToken: (tok) => {
        notifyToken += tok;
      },
    });

    expect(capturedConfirmation).not.toBeNull();
    expect(capturedConfirmation!.executionId).toBe("exec_1");
    expect(capturedConfirmation!.toolName).toBe("write_file");
    expect(capturedConfirmation!.arguments).toEqual({ path: "foo.txt" });
    expect(capturedConfirmation!.reason).toBe("file write guard");
    expect(capturedConfirmation!.status).toBe("pending");

    expect(notifyToken).toContain("Confirmation Required");
    expect(notifyToken).toContain("write_file");
    expect(notifyToken).not.toContain('"execution_id"');
  });

  it("safely ignores unrecognized SSE event types without spilling raw JSON into tokens", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            'data: {"type":"unknown_telemetry_event","secret_field":"do_not_leak"}\n\n',
          ),
        );
        controller.enqueue(encoder.encode("Visible message text\n"));
        controller.close();
      },
    });

    let tokens = "";
    await parseStreamReader(stream.getReader(), {
      onToken: (tok) => {
        tokens += tok;
      },
    });

    expect(tokens).not.toContain("unknown_telemetry_event");
    expect(tokens).not.toContain("do_not_leak");
    expect(tokens).toContain("Visible message text");
  });

  it("resiliently parses SSE frames split across 2-byte chunk boundaries", async () => {
    const fullPayload =
      'data: {"type":"session","session_id":"sess_split","trace_id":"tr_1"}\n\nFirst line\nSecond line\n';
    const encoder = new TextEncoder();
    const bytes = encoder.encode(fullPayload);

    // Enqueue 2 bytes at a time
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 2) {
          controller.enqueue(bytes.slice(i, i + 2));
        }
        controller.close();
      },
    });

    let sessionId = "";
    let accumulatedText = "";

    await parseStreamReader(stream.getReader(), {
      onSession: (id) => {
        sessionId = id;
      },
      onToken: (tok) => {
        accumulatedText += tok;
      },
    });

    expect(sessionId).toBe("sess_split");
    expect(accumulatedText).toContain("First line\nSecond line");
    expect(accumulatedText).not.toContain("sess_split");
  });

  it("handles stream abort via AbortSignal cleanly", async () => {
    const abortController = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode("Token 1 "));
        abortController.abort();
        controller.enqueue(encoder.encode("Token 2 "));
        controller.close();
      },
    });

    let completed = "";
    const result = await parseStreamReader(stream.getReader(), {
      signal: abortController.signal,
      onComplete: (text) => {
        completed = text;
      },
    });

    expect(result).toBe(completed);
  });
});

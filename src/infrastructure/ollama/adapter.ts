import { config } from "../../core/config.js";
import { ChatMessage, LLMProvider } from "../../core/llm.js";

export type { ChatMessage };

/**
 * Generation options sent on every chat call - identical to Python's
 * app/infrastructure/ollama/adapter.py `_get_ollama_options()`.
 */
export function getOllamaOptions() {
  return {
    repeat_penalty: 1.15,
    repeat_last_n: 64,
    temperature: 0.7,
    num_ctx: config.ollama.numCtx,
  };
}

/** Raised when Ollama exceeds OLLAMA_REQUEST_TIMEOUT_MS / OLLAMA_STREAM_IDLE_TIMEOUT_MS. */
export class OllamaTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaTimeoutError";
  }
}

/** The caller's cancellation (client disconnect) combined with a timeout signal. */
function withTimeout(timeout: AbortSignal, signal?: AbortSignal): AbortSignal {
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export class OllamaAdapter implements LLMProvider {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || config.ollama.url;
  }

  async chat(
    messages: ChatMessage[],
    model: string = config.ollama.defaultChatModel,
    signal?: AbortSignal,
  ): Promise<string> {
    const timeoutMs = config.ollama.requestTimeoutMs;
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          keep_alive: config.ollama.keepAlive,
          options: getOllamaOptions(),
        }),
        signal: withTimeout(timeout, signal),
      });

      if (!res.ok) {
        throw new Error(`Ollama chat error: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as { message?: { content?: string } };
      return data.message?.content || "";
    } catch (err) {
      if (timeout.aborted) {
        throw new OllamaTimeoutError(`Ollama chat (${model}) did not finish within ${timeoutMs} ms`);
      }
      throw err;
    }
  }

  async *streamChat(
    messages: ChatMessage[],
    model: string = config.ollama.defaultChatModel,
    signal?: AbortSignal,
  ): AsyncGenerator<string, void, unknown> {
    // Idle timeout: the longest allowed gap between chunks, including the wait for the
    // first one. A long answer that keeps producing tokens is never cut off.
    const idleMs = config.ollama.streamIdleTimeoutMs;
    const idle = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const rearm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => idle.abort(), idleMs);
    };
    const combined = withTimeout(idle.signal, signal);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      rearm();
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          keep_alive: config.ollama.keepAlive,
          options: getOllamaOptions(),
        }),
        signal: combined,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Ollama stream error: ${res.status} ${res.statusText}`);
      }

      reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        if (combined.aborted) {
          reader.cancel().catch(() => {});
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;
        rearm();

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed) as { message?: { content?: string }; done?: boolean };
            if (parsed.message?.content) {
              yield parsed.message.content;
            }
            if (parsed.done) {
              return;
            }
          } catch {
            // Ignore partial/malformed JSON chunks in stream
          }
        }
      }
    } catch (err) {
      if (idle.signal.aborted && !signal?.aborted) {
        throw new OllamaTimeoutError(`Ollama stream (${model}) sent nothing for ${idleMs} ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
      reader?.releaseLock();
    }
  }

  async embed(text: string, model: string = config.ollama.embeddingModel, signal?: AbortSignal): Promise<number[]> {
    const timeoutMs = config.ollama.requestTimeoutMs;
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: text,
        }),
        signal: withTimeout(timeout, signal),
      });

      if (!res.ok) {
        throw new Error(`Ollama embed error: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as { embedding?: number[] };
      return data.embedding || [];
    } catch (err) {
      if (timeout.aborted) {
        throw new OllamaTimeoutError(`Ollama embedding (${model}) did not finish within ${timeoutMs} ms`);
      }
      throw err;
    }
  }
}

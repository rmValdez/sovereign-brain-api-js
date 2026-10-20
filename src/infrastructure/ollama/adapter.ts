import { config } from "../../core/config.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

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

export class OllamaAdapter {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || config.ollama.url;
  }

  async chat(
    messages: ChatMessage[],
    model: string = config.ollama.defaultChatModel,
    signal?: AbortSignal,
  ): Promise<string> {
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
      signal,
    });

    if (!res.ok) {
      throw new Error(`Ollama chat error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content || "";
  }

  async *streamChat(
    messages: ChatMessage[],
    model: string = config.ollama.defaultChatModel,
    signal?: AbortSignal,
  ): AsyncGenerator<string, void, unknown> {
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
      signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`Ollama stream error: ${res.status} ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        if (signal?.aborted) {
          reader.cancel().catch(() => {});
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

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
    } finally {
      reader.releaseLock();
    }
  }

  async embed(text: string, model: string = config.ollama.embeddingModel, signal?: AbortSignal): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: text,
      }),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Ollama embed error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { embedding?: number[] };
    return data.embedding || [];
  }
}

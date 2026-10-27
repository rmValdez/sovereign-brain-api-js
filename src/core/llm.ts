export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Provider-agnostic LLM contract (Python: app/modules/brain/interfaces.py `LLMProvider`).
 * Modules depend on this, never on a concrete adapter such as OllamaAdapter.
 */
export interface LLMProvider {
  chat(messages: ChatMessage[], model?: string, signal?: AbortSignal): Promise<string>;
  streamChat(messages: ChatMessage[], model?: string, signal?: AbortSignal): AsyncGenerator<string>;
  embed(text: string, model?: string, signal?: AbortSignal): Promise<number[]>;
}

import { OllamaAdapter, ChatMessage } from "../../infrastructure/ollama/adapter.js";
import { currentDateContextLine } from "./temporal.js";
import { ProcessRecorder } from "./process-track.js";

const DEFAULT_SYSTEM_PROMPT = `You are Sovereign Brain, a local, privacy-first cognitive AI assistant.
You provide thoughtful, accurate, and direct responses grounded in user data and privacy.`;

export class ContextEngine {
  private llm: OllamaAdapter;

  constructor(llm?: OllamaAdapter) {
    this.llm = llm || new OllamaAdapter();
  }

  isEditorContextRelevant(
    message: string,
    hasSelection: boolean,
    taskType: string,
  ): boolean {
    if (hasSelection) return true;
    const lower = message.toLowerCase();
    const codeTriggers = ["explain", "refactor", "fix", "debug", "this code", "this file", "lines"];
    return codeTriggers.some((t) => lower.includes(t));
  }

  async extractMemoryIfInstructed(
    sessionId: string,
    message: string,
    userId?: string | null,
    recorder?: ProcessRecorder,
  ): Promise<void> {
    const lower = message.toLowerCase().trim();
    const memoryTriggers = [
      "remember that ",
      "my preference is ",
      "we decided that ",
      "keep in mind ",
      "always remember ",
    ];

    const match = memoryTriggers.find((t) => lower.startsWith(t));
    if (match) {
      const memoryContent = message.slice(match.length).trim();
      // Future: persist to memories table via MemoryRepository
    }
  }

  async buildContext(
    sessionId: string,
    message: string,
    options: {
      userId?: string | null;
      userTimezone?: string | null;
      userCountry?: string | null;
      recorder?: ProcessRecorder;
      history?: ChatMessage[];
    } = {},
  ): Promise<ChatMessage[]> {
    let systemContent = DEFAULT_SYSTEM_PROMPT;
    systemContent += `\n\n${currentDateContextLine(options.userTimezone)}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemContent },
    ];

    if (options.history && options.history.length > 0) {
      messages.push(...options.history);
    }

    messages.push({ role: "user", content: message });
    return messages;
  }
}

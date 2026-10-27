import { ChatMessage, LLMProvider } from "../../core/llm.js";
import { TaskType } from "../../core/task-type.js";
import { OllamaAdapter } from "../../infrastructure/ollama/adapter.js";
import { currentDateContextLine } from "./temporal.js";
import { ProcessRecorder } from "./process-track.js";

const DEFAULT_SYSTEM_PROMPT = `You are Sovereign Brain, a local, privacy-first cognitive AI assistant.
You provide thoughtful, accurate, and direct responses grounded in user data and privacy.`;

export class ContextEngine {
  private llm: LLMProvider;

  constructor(llm?: LLMProvider) {
    this.llm = llm || new OllamaAdapter();
  }

  isEditorContextRelevant(
    message: string,
    hasSelection: boolean = false,
    taskType?: TaskType | null,
  ): boolean {
    const lower = message.trim().toLowerCase();
    const tokenMatches = lower.match(/\b[a-z0-9_]+\b/g) || [];
    const tokens = new Set(tokenMatches);

    // Explicit technical / code-related task types
    if (
      taskType === TaskType.CODING ||
      taskType === TaskType.DEBUGGING ||
      taskType === TaskType.COMPLEX_TASK
    ) {
      return true;
    }

    // Tool operations that operate on code or files
    const toolOps = [
      "write file",
      "save file",
      "create file",
      "read file",
      "delete file",
      "git status",
      "git diff",
      "git commit",
      "git log",
      "run test",
    ];
    if (toolOps.some((op) => lower.includes(op))) {
      return true;
    }

    // Multi-word deictic or code phrases
    const phrases = [
      "explain this",
      "what does this",
      "how does this",
      "fix this",
      "look at this",
      "review this",
      "check this",
      "my code",
      "this code",
      "this file",
      "this function",
      "this class",
      "this error",
      "this line",
      "in my workspace",
      "in this project",
      "in this repo",
      "in the file",
      "pull request",
      "unit test",
      "write a function",
      "add a feature",
    ];
    if (phrases.some((p) => lower.includes(p))) {
      return true;
    }

    // Single word development keywords matching full tokens (not substrings like 'api' in 'capital')
    const devTokens = new Set([
      "def",
      "class",
      "fn",
      "function",
      "functions",
      "refactor",
      "implement",
      "bug",
      "bugs",
      "syntax",
      "import",
      "imports",
      "package",
      "library",
      "compile",
      "compiler",
      "runtime",
      "traceback",
      "exception",
      "async",
      "await",
      "variable",
      "variables",
      "schema",
      "schemas",
      "endpoint",
      "endpoints",
      "api",
      "apis",
      "route",
      "routes",
      "database",
      "databases",
      "query",
      "queries",
      "sql",
      "prisma",
      "sqlalchemy",
      "postgres",
      "postgresql",
      "json",
      "yaml",
      "toml",
      "typescript",
      "javascript",
      "python",
      "rust",
      "golang",
      "html",
      "css",
      "component",
      "components",
      "hook",
      "hooks",
      "interface",
      "interfaces",
      "struct",
      "structs",
      "enum",
      "enums",
      "repo",
      "repository",
      "workspace",
      "git",
      "diff",
      "commit",
      "branch",
      "lint",
    ]);
    for (const t of tokens) {
      if (devTokens.has(t)) return true;
    }

    // Deictic single tokens when selection or code is present
    const deicticTokens = new Set(["this", "here", "above", "selection", "current", "explain"]);
    if (hasSelection) {
      for (const t of tokens) {
        if (deicticTokens.has(t)) return true;
      }
    }

    // Code snippets in backticks
    if (message.includes("```") || message.includes("`")) {
      return true;
    }

    return false;
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

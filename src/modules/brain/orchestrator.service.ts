import { LLMProvider } from "../../core/llm.js";
import { OllamaAdapter } from "../../infrastructure/ollama/adapter.js";
import { selectModel } from "../../infrastructure/ollama/router.js";
import { TaskType, classifyTaskExplained } from "./classifier.js";
import { ContextEngine } from "./context.service.js";
import { ProcessRecorder, ProcessStage, ProcessStatus } from "./process-track.js";

export interface ProcessMessageOptions {
  sessionId?: string | null;
  userId?: string | null;
  source?: string | null;
  workspaceRoot?: string | null;
  relativeFile?: string | null;
  language?: string | null;
  selectionText?: string | null;
  selectionStartLine?: number | null;
  selectionEndLine?: number | null;
  userTimezone?: string | null;
  userCountry?: string | null;
}

const MAX_SELECTION_CHARS = 4000;

export function buildEditorContextBlock(opts: ProcessMessageOptions): string {
  const lines: string[] = [];
  if (opts.workspaceRoot) lines.push(`Workspace: ${opts.workspaceRoot}`);
  if (opts.relativeFile) lines.push(`File: ${opts.relativeFile}`);
  if (opts.language) lines.push(`Language: ${opts.language}`);
  if (opts.selectionText) {
    let text = opts.selectionText;
    if (text.length > MAX_SELECTION_CHARS) {
      text = text.slice(0, MAX_SELECTION_CHARS) + "\n... [selection truncated]";
    }
    if (opts.selectionStartLine != null && opts.selectionEndLine != null) {
      lines.push(`Selection (lines ${opts.selectionStartLine}-${opts.selectionEndLine}):`);
    } else {
      lines.push("Selection:");
    }
    lines.push(`\`\`\`${opts.language || ""}\n${text}\n\`\`\``);
  }
  if (lines.length === 0) return "";
  return `[Editor context]\n${lines.join("\n")}\n\n[User message]\n`;
}

export class BrainOrchestrator {
  private llm: LLMProvider;
  private contextEngine: ContextEngine;

  constructor(llm?: LLMProvider, contextEngine?: ContextEngine) {
    this.llm = llm || new OllamaAdapter();
    this.contextEngine = contextEngine || new ContextEngine(this.llm);
  }

  buildEditorContextBlock(opts: ProcessMessageOptions): string {
    return buildEditorContextBlock(opts);
  }

  async processMessage(
    message: string,
    opts: ProcessMessageOptions = {},
  ): Promise<{ response: string; sessionId: string; confirmation: any | null; traceId: string }> {
    const sessionId = opts.sessionId || `sess_${Date.now()}`;
    const recorder = new ProcessRecorder("chat", sessionId, message);

    const hasSelection = Boolean(opts.selectionText && opts.selectionText.trim());
    const [baseTaskType] = classifyTaskExplained(message);

    const isRelevant = this.contextEngine.isEditorContextRelevant(message, hasSelection, baseTaskType);
    const editorBlock = isRelevant ? this.buildEditorContextBlock(opts) : "";
    const effectiveMessage = editorBlock + message;

    recorder.record(ProcessStage.PROMPT, ProcessStatus.SUCCESS, {
      input: { rawLength: message.length, hasEditorContext: Boolean(editorBlock) },
    });

    await this.contextEngine.extractMemoryIfInstructed(sessionId, message, opts.userId, recorder);

    const [taskType, signals] = classifyTaskExplained(effectiveMessage);
    recorder.record(ProcessStage.CLASSIFIER, ProcessStatus.SUCCESS, {
      output: { taskType, ...signals },
    });

    const targetModel = selectModel(taskType);
    const isToolTask = taskType === TaskType.COMPLEX_TASK || taskType === TaskType.TOOL_OPERATION;

    recorder.record(ProcessStage.ROUTING, ProcessStatus.SUCCESS, {
      output: {
        route: isToolTask ? "agent_loop_pending" : "direct_llm",
        targetModel,
      },
    });

    const messages = await this.contextEngine.buildContext(sessionId, effectiveMessage, {
      userId: opts.userId,
      userTimezone: opts.userTimezone,
      userCountry: opts.userCountry,
      recorder,
    });

    if (isToolTask) {
      // Honest transition behavior: notify model that tool execution is pending Phase 5
      messages.unshift({
        role: "system",
        content:
          "[Notice: Direct tool execution is being wired in Phase 5 of this TypeScript API. Answer directly using existing knowledge and clarify that external tool actions cannot run yet.]",
      });
    }

    const response = await this.llm.chat(messages, targetModel);

    recorder.finish(ProcessStatus.SUCCESS);
    return {
      response,
      sessionId,
      confirmation: null,
      traceId: recorder.track.trace_id,
    };
  }

  async *processMessageStream(
    message: string,
    opts: ProcessMessageOptions = {},
    signal?: AbortSignal,
  ): AsyncGenerator<string, void, unknown> {
    const sessionId = opts.sessionId || `sess_${Date.now()}`;
    const recorder = new ProcessRecorder("chat_stream", sessionId, message);

    // 1. Immediately emit session metadata frame
    const sessionFrame = {
      type: "session",
      session_id: sessionId,
      trace_id: recorder.track.trace_id,
    };
    yield `data: ${JSON.stringify(sessionFrame)}\n\n`;

    const hasSelection = Boolean(opts.selectionText && opts.selectionText.trim());
    const [baseTaskType] = classifyTaskExplained(message);

    const isRelevant = this.contextEngine.isEditorContextRelevant(message, hasSelection, baseTaskType);
    const editorBlock = isRelevant ? this.buildEditorContextBlock(opts) : "";
    const effectiveMessage = editorBlock + message;

    recorder.record(ProcessStage.PROMPT, ProcessStatus.SUCCESS, {
      input: { rawLength: message.length, hasEditorContext: Boolean(editorBlock) },
    });

    await this.contextEngine.extractMemoryIfInstructed(sessionId, message, opts.userId, recorder);

    const [taskType, signals] = classifyTaskExplained(effectiveMessage);
    recorder.record(ProcessStage.CLASSIFIER, ProcessStatus.SUCCESS, {
      output: { taskType, ...signals },
    });

    const targetModel = selectModel(taskType);
    const isToolTask = taskType === TaskType.COMPLEX_TASK || taskType === TaskType.TOOL_OPERATION;

    recorder.record(ProcessStage.ROUTING, ProcessStatus.SUCCESS, {
      output: {
        route: isToolTask ? "agent_loop_pending" : "direct_llm",
        targetModel,
      },
    });

    const messages = await this.contextEngine.buildContext(sessionId, effectiveMessage, {
      userId: opts.userId,
      userTimezone: opts.userTimezone,
      userCountry: opts.userCountry,
      recorder,
    });

    if (isToolTask) {
      messages.unshift({
        role: "system",
        content:
          "[Notice: Direct tool execution is being wired in Phase 5 of this TypeScript API. Answer directly using existing knowledge and clarify that external tool actions cannot run yet.]",
      });
    }

    try {
      for await (const token of this.llm.streamChat(messages, targetModel, signal)) {
        if (signal?.aborted) break;
        yield token;
      }
      recorder.finish(ProcessStatus.SUCCESS);
    } catch (err) {
      if (signal?.aborted) {
        recorder.finish(ProcessStatus.FAILED);
        return;
      }
      recorder.finish(ProcessStatus.FAILED);
      throw err;
    }
  }
}

import { describe, expect, it } from "vitest";
import { ChatMessage, LLMProvider } from "../src/core/llm.js";
import { TaskType } from "../src/core/task-type.js";
import { ContextEngine } from "../src/modules/brain/context.service.js";
import {
  BrainOrchestrator,
  buildEditorContextBlock,
  ProcessMessageOptions,
} from "../src/modules/brain/orchestrator.service.js";

class TestLLM implements LLMProvider {
  lastMessages: ChatMessage[] = [];
  lastModel?: string;

  async chat(messages: ChatMessage[], model?: string): Promise<string> {
    this.lastMessages = messages;
    this.lastModel = model;
    return "test response";
  }

  async *streamChat(): AsyncGenerator<string> {
    yield "test response";
  }

  async embed(): Promise<number[]> {
    return [];
  }
}

describe("Editor context block formatting (Python parity)", () => {
  it("returns empty string when no fields are provided", () => {
    expect(buildEditorContextBlock({})).toBe("");
  });

  it("formats file and language only", () => {
    const block = buildEditorContextBlock({
      relativeFile: "src/planner.py",
      language: "python",
    });
    expect(block).toContain("File: src/planner.py");
    expect(block).toContain("Language: python");
    expect(block).toContain("[User message]");
  });

  it("formats workspace only", () => {
    const block = buildEditorContextBlock({
      workspaceRoot: "/home/user/project",
    });
    expect(block).toContain("Workspace: /home/user/project");
    expect(block).toContain("[User message]");
  });

  it("returns empty string when relativeFile and selectionText are null", () => {
    expect(
      buildEditorContextBlock({ relativeFile: null, selectionText: null }),
    ).toBe("");
  });

  it("formats selection without file and includes line numbers", () => {
    const block = buildEditorContextBlock({
      selectionText: "def f(): pass",
      selectionStartLine: 1,
      selectionEndLine: 1,
    });
    expect(block).not.toContain("File:");
    expect(block).toContain("Selection (lines 1-1):");
    expect(block).toContain("def f(): pass");
  });

  it("formats selection without line numbers", () => {
    const block = buildEditorContextBlock({
      selectionText: "x = 1",
    });
    expect(block).toContain("Selection:\n```\nx = 1\n```");
  });

  it("truncates large selection exceeding 4000 characters", () => {
    const huge = "a".repeat(10_000);
    const block = buildEditorContextBlock({ selectionText: huge });
    expect(block).toContain("[selection truncated]");
    expect(block.length).toBeLessThan(huge.length);
  });
});

describe("ContextEngine.isEditorContextRelevant (Python parity)", () => {
  const engine = new ContextEngine();

  it("returns true for technical / code-related TaskTypes", () => {
    expect(engine.isEditorContextRelevant("check", false, TaskType.CODING)).toBe(true);
    expect(engine.isEditorContextRelevant("check", false, TaskType.DEBUGGING)).toBe(true);
    expect(engine.isEditorContextRelevant("check", false, TaskType.COMPLEX_TASK)).toBe(true);
  });

  it("returns true for tool operations on files or git", () => {
    expect(engine.isEditorContextRelevant("write file notes.txt")).toBe(true);
    expect(engine.isEditorContextRelevant("git diff HEAD~1")).toBe(true);
    expect(engine.isEditorContextRelevant("run test suite")).toBe(true);
  });

  it("returns true for multi-word deictic or code phrases", () => {
    expect(engine.isEditorContextRelevant("Explain this")).toBe(true);
    expect(engine.isEditorContextRelevant("what does this function do?")).toBe(true);
    expect(engine.isEditorContextRelevant("fix this error for me")).toBe(true);
    expect(engine.isEditorContextRelevant("How do I refactor this class?")).toBe(true);
    expect(engine.isEditorContextRelevant("look at this code")).toBe(true);
  });

  it("returns true for development tokens matching whole words", () => {
    expect(engine.isEditorContextRelevant("how does postgres indexing work")).toBe(true);
    expect(engine.isEditorContextRelevant("write a function for reverse string")).toBe(true);
    expect(engine.isEditorContextRelevant("add a typescript interface")).toBe(true);
  });

  it("does not trigger on substrings that happen to contain dev tokens (e.g. capital containing api)", () => {
    expect(engine.isEditorContextRelevant("What is the capital of France?", false, TaskType.QUESTION)).toBe(false);
  });

  it("suppresses editor context for general conversation", () => {
    expect(engine.isEditorContextRelevant("What should I cook tonight?", false, TaskType.CONVERSATION)).toBe(false);
    expect(engine.isEditorContextRelevant("hello how are you", false, TaskType.CONVERSATION)).toBe(false);
  });

  it("suppresses editor context for simple math", () => {
    expect(engine.isEditorContextRelevant("calculate 12 * 8", false, TaskType.TOOL_OPERATION)).toBe(false);
  });

  it("includes editor context when selection exists with deictic keywords", () => {
    expect(engine.isEditorContextRelevant("what is this", true)).toBe(true);
    expect(engine.isEditorContextRelevant("explain", true)).toBe(true);
  });

  it("suppresses editor context when selection exists but query is unrelated cooking question", () => {
    expect(engine.isEditorContextRelevant("What should I cook tonight?", true, TaskType.CONVERSATION)).toBe(false);
  });

  it("includes editor context when code snippets in backticks exist", () => {
    expect(engine.isEditorContextRelevant("look at `const x = 1`")).toBe(true);
  });
});

describe("BrainOrchestrator editor context integration (Python parity)", () => {
  it("injects editor context into prompt for code questions", async () => {
    const llm = new TestLLM();
    const orchestrator = new BrainOrchestrator(llm);

    const result = await orchestrator.processMessage("How do I refactor this class?", {
      workspaceRoot: "/home/user/project",
      relativeFile: "src/user.py",
      language: "python",
    });

    expect(result.response).toBe("test response");
    const userMsg = llm.lastMessages.find((m) => m.role === "user");
    expect(userMsg).toBeDefined();
    expect(userMsg!.content).toContain("[Editor context]");
    expect(userMsg!.content).toContain("File: src/user.py");
    expect(userMsg!.content).toContain("How do I refactor this class?");
  });

  it("suppresses editor context for general conversation", async () => {
    const llm = new TestLLM();
    const orchestrator = new BrainOrchestrator(llm);

    await orchestrator.processMessage("What should I cook tonight?", {
      workspaceRoot: "/home/user/project",
      relativeFile: "src/main.rs",
      language: "rust",
    });

    const userMsg = llm.lastMessages.find((m) => m.role === "user");
    expect(userMsg).toBeDefined();
    expect(userMsg!.content).not.toContain("[Editor context]");
    expect(userMsg!.content).not.toContain("src/main.rs");
    expect(userMsg!.content).toBe("What should I cook tonight?");
  });

  it("does not trigger freshness routing from 'File: ...' label", async () => {
    const llm = new TestLLM();
    const orchestrator = new BrainOrchestrator(llm);

    await orchestrator.processMessage("Explain this", {
      workspaceRoot: "/home/user/project",
      relativeFile: "src/planner.py",
      language: "python",
    });

    // Model target should stay default chat model, NOT route to tool/planner due to 'File:' label
    expect(llm.lastModel).toBe("qwen3:8b");
    const userMsg = llm.lastMessages.find((m) => m.role === "user");
    expect(userMsg!.content).toContain("[Editor context]");
    expect(userMsg!.content).toContain("File: src/planner.py");
  });

  it("preserves identical behavior when no editor options are passed", async () => {
    const llm = new TestLLM();
    const orchestrator = new BrainOrchestrator(llm);

    await orchestrator.processMessage("Explain recursion");

    const userMsg = llm.lastMessages.find((m) => m.role === "user");
    expect(userMsg).toBeDefined();
    expect(userMsg!.content).toBe("Explain recursion");
    expect(userMsg!.content).not.toContain("[Editor context]");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrainOrchestrator } from "../src/modules/brain/orchestrator.service.js";
import { OllamaAdapter } from "../src/infrastructure/ollama/adapter.js";

const HONEST_TOOL_NOTICE =
  "[Notice: Direct tool execution is being wired in Phase 5 of this TypeScript API. Answer directly using existing knowledge and clarify that external tool actions cannot run yet.]";

describe("Honest tool fallback (Issue #8 / row 1.7)", () => {
  let orchestrator: BrainOrchestrator;
  let chatSpy: any;
  let streamChatSpy: any;

  beforeEach(() => {
    orchestrator = new BrainOrchestrator();
    chatSpy = vi.spyOn(OllamaAdapter.prototype, "chat").mockResolvedValue("Direct answer without tools");
    streamChatSpy = vi
      .spyOn(OllamaAdapter.prototype, "streamChat")
      .mockImplementation(async function* () {
        yield "Direct ";
        yield "stream ";
        yield "reply";
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("injects honest system notice and never emits fake [AgentLoop] placeholder on processMessage", async () => {
    // A tool operation request (e.g. write file)
    const result = await orchestrator.processMessage("write file notes.txt and save it");

    expect(chatSpy).toHaveBeenCalledTimes(1);
    const [messages] = chatSpy.mock.calls[0];

    // Verify system notice is injected at the beginning
    const systemNotice = messages.find((m: any) => m.role === "system" && m.content.includes(HONEST_TOOL_NOTICE));
    expect(systemNotice).toBeDefined();

    // Verify no fake [AgentLoop] placeholder string is emitted
    expect(result.response).not.toContain("[AgentLoop]");
    expect(result.response).not.toContain("Mock response");
    expect(result.response).toBe("Direct answer without tools");
  });

  it("injects honest system notice on processMessageStream for tool operations", async () => {
    const tokens: string[] = [];
    const stream = orchestrator.processMessageStream("create directory src/components");

    for await (const chunk of stream) {
      tokens.push(chunk);
    }

    expect(streamChatSpy).toHaveBeenCalledTimes(1);
    const [messages] = streamChatSpy.mock.calls[0];

    const systemNotice = messages.find((m: any) => m.role === "system" && m.content.includes(HONEST_TOOL_NOTICE));
    expect(systemNotice).toBeDefined();

    const fullStreamText = tokens.join("");
    expect(fullStreamText).not.toContain("[AgentLoop]");
    expect(fullStreamText).not.toContain("Mock response");
    expect(fullStreamText).toContain("Direct stream reply");
  });

  it("does not inject honest tool notice on standard conversational or question tasks", async () => {
    await orchestrator.processMessage("What is the capital of France?");

    expect(chatSpy).toHaveBeenCalledTimes(1);
    const [messages] = chatSpy.mock.calls[0];

    const systemNotice = messages.find((m: any) => m.role === "system" && m.content.includes(HONEST_TOOL_NOTICE));
    expect(systemNotice).toBeUndefined();
  });
});

import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config } from "../src/core/config.js";
import { ChatMessage, LLMProvider } from "../src/core/llm.js";
import { BrainOrchestrator } from "../src/modules/brain/orchestrator.service.js";

class FakeLLM implements LLMProvider {
  calls: ChatMessage[][] = [];

  async chat(messages: ChatMessage[]): Promise<string> {
    this.calls.push(messages);
    return "fake reply";
  }

  async *streamChat(): AsyncGenerator<string> {
    yield "fake";
  }

  async embed(): Promise<number[]> {
    return [];
  }
}

describe("buildServer dependency injection", () => {
  let server: FastifyInstance;
  const originalKeys = [...config.security.allowedApiKeys];

  beforeEach(() => {
    config.security.allowedApiKeys = ["test-key"];
  });

  afterEach(async () => {
    config.security.allowedApiKeys = [...originalKeys];
    await server.close();
  });

  it("routes /api/v1/chat through an injected orchestrator and LLM provider", async () => {
    const llm = new FakeLLM();
    const { buildServer } = await import("../src/app.js");
    server = await buildServer({ orchestrator: new BrainOrchestrator(llm) });

    const res = await server.inject({
      method: "POST",
      url: "/api/v1/chat",
      headers: { "content-type": "application/json", "x-api-key": "test-key" },
      payload: { message: "hello there" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().response).toBe("fake reply");
    expect(llm.calls).toHaveLength(1);
  });
});

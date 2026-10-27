import Fastify, { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../src/core/config.js";
import { globalErrorHandler } from "../src/core/error-handler.js";
import { BrainOrchestrator } from "../src/modules/brain/orchestrator.service.js";

describe("Global error sanitization (globalErrorHandler)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    app.setErrorHandler(globalErrorHandler);

    app.get("/sensitive-error", async () => {
      const err: any = new Error(
        "connection to server at 'db-internal.local' (10.0.4.12), port 5434 failed: password authentication failed for user 'postgres'",
      );
      throw err;
    });

    app.get("/client-error", async () => {
      const err: any = new Error("Resource not found");
      err.statusCode = 404;
      throw err;
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("masks internal database errors and IPs in 500 responses", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/sensitive-error",
    });

    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body).toEqual({
      detail: "An internal error occurred while processing the chat request.",
    });

    // Verify sensitive infrastructure strings are completely absent from the response
    expect(res.body).not.toContain("db-internal.local");
    expect(res.body).not.toContain("10.0.4.12");
    expect(res.body).not.toContain("password");
    expect(res.body).not.toContain("postgres");
    expect(res.body).not.toContain("5434");
    expect(res.body).not.toContain("stack");
  });

  it("preserves 4xx status codes and client-facing error messages", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/client-error",
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      detail: "Resource not found",
    });
  });
});

describe("POST /api/v1/chat error sanitization (Python test_chat.py parity)", () => {
  let server: FastifyInstance;
  const originalKeys = [...config.security.allowedApiKeys];

  beforeEach(async () => {
    config.security.allowedApiKeys = ["test-key"];
    process.env.API_KEY = "test-key";
    process.env.NODE_ENV = "test";

    const { buildServer } = await import("../src/app.js");
    server = await buildServer();
    await server.ready();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    config.security.allowedApiKeys = [...originalKeys];
    await server.close();
  });

  it("does not leak internal exception text on /api/v1/chat", async () => {
    // Parity with Python test_chat.py::test_chat_endpoint_does_not_leak_internal_exception_text
    vi.spyOn(BrainOrchestrator.prototype, "processMessage").mockRejectedValue(
      new Error("connection to server at 'db-internal.local' (10.0.4.12), port 5432 failed"),
    );

    const res = await server.inject({
      method: "POST",
      url: "/api/v1/chat",
      headers: {
        "content-type": "application/json",
        "x-api-key": "test-key",
      },
      payload: {
        message: "Hi",
      },
    });

    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.detail).toBe("An internal error occurred while processing the chat request.");
    expect(res.body).not.toContain("db-internal.local");
    expect(res.body).not.toContain("10.0.4.12");
    expect(res.body).not.toContain("5432");
  });
});

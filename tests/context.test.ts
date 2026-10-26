import { describe, expect, it } from "vitest";
import { extractRequestContext } from "../src/core/context.js";

describe("extractRequestContext", () => {
  it("extracts all standard context headers correctly", () => {
    const headers = {
      "x-user-id": "user-123",
      "x-client-type": "web",
      "x-conversation-id": "conv-456",
      "x-session-id": "sess-789",
      "x-correlation-id": "corr-abc",
    };

    const ctx = extractRequestContext(headers);

    expect(ctx).toEqual({
      userId: "user-123",
      clientType: "web",
      conversationId: "conv-456",
      sessionId: "sess-789",
      correlationId: "corr-abc",
    });
  });

  it("handles case-insensitive header names", () => {
    const headers = {
      "X-User-Id": "user-case",
      "X-Client-Type": "extension",
      "X-Conversation-Id": "conv-case",
      "X-Session-Id": "sess-case",
      "X-Correlation-Id": "corr-case",
    };

    const ctx = extractRequestContext(headers);

    expect(ctx.userId).toBe("user-case");
    expect(ctx.clientType).toBe("extension");
    expect(ctx.conversationId).toBe("conv-case");
    expect(ctx.sessionId).toBe("sess-case");
    expect(ctx.correlationId).toBe("corr-case");
  });

  it("falls back to X-Request-Id when X-Correlation-Id is missing", () => {
    const headers = {
      "x-request-id": "req-fallback-id",
    };

    const ctx = extractRequestContext(headers);

    expect(ctx.correlationId).toBe("req-fallback-id");
  });

  it("prioritizes X-Correlation-Id over X-Request-Id when both are present", () => {
    const headers = {
      "x-correlation-id": "primary-corr-id",
      "x-request-id": "secondary-req-id",
    };

    const ctx = extractRequestContext(headers);

    expect(ctx.correlationId).toBe("primary-corr-id");
  });

  it("handles array-valued headers by taking the first entry", () => {
    const headers = {
      "x-user-id": ["first-user", "second-user"],
      "x-client-type": ["cli", "web"],
      "x-correlation-id": ["first-corr", "second-corr"],
    };

    const ctx = extractRequestContext(headers);

    expect(ctx.userId).toBe("first-user");
    expect(ctx.clientType).toBe("cli");
    expect(ctx.correlationId).toBe("first-corr");
  });

  it("handles empty array or empty string in array gracefully", () => {
    const headers = {
      "x-user-id": [""],
      "x-session-id": [],
    };

    const ctx = extractRequestContext(headers as any);

    expect(ctx.userId).toBeNull();
    expect(ctx.sessionId).toBeNull();
  });

  it("returns null fields and 'unknown' clientType when headers are empty", () => {
    const ctx = extractRequestContext({});

    expect(ctx).toEqual({
      userId: null,
      clientType: "unknown",
      conversationId: null,
      sessionId: null,
      correlationId: null,
    });
  });

  it("maps recognized client types accurately and case-insensitively", () => {
    for (const valid of ["web", "extension", "cli"] as const) {
      const ctx = extractRequestContext({ "x-client-type": valid });
      expect(ctx.clientType).toBe(valid);
    }

    expect(extractRequestContext({ "x-client-type": "WEB" }).clientType).toBe("web");
    expect(extractRequestContext({ "x-client-type": " Extension " }).clientType).toBe("extension");
  });

  it("maps unrecognized or invalid client types to 'unknown'", () => {
    for (const invalid of ["mobile", "desktop", "random-bot", ""]) {
      const ctx = extractRequestContext({ "x-client-type": invalid });
      expect(ctx.clientType).toBe("unknown");
    }
  });
});

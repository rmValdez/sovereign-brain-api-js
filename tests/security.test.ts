import Fastify, { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config } from "../src/core/config.js";
import { isValidApiKey, verifyApiKey } from "../src/core/security.js";

describe("API key verification middleware (verifyApiKey)", () => {
  let app: FastifyInstance;
  const originalAllowedKeys = [...config.security.allowedApiKeys];

  beforeEach(async () => {
    app = Fastify();
    app.get("/protected", { preHandler: verifyApiKey }, async () => {
      return { status: "authorized" };
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    config.security.allowedApiKeys = [...originalAllowedKeys];
  });

  it("authorizes request via X-API-Key header", async () => {
    config.security.allowedApiKeys = ["secret-key-123"];

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        "x-api-key": "secret-key-123",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "authorized" });
  });

  it("authorizes request via Authorization: Bearer <key> header", async () => {
    config.security.allowedApiKeys = ["secret-key-123"];

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        authorization: "Bearer secret-key-123",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "authorized" });
  });

  it("authorizes request via ?api_key=<key> query parameter", async () => {
    config.security.allowedApiKeys = ["secret-key-123"];

    const res = await app.inject({
      method: "GET",
      url: "/protected?api_key=secret-key-123",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "authorized" });
  });

  it("authorizes any valid key when multiple allowed keys are configured", async () => {
    config.security.allowedApiKeys = ["key-alpha", "key-beta", "key-gamma"];

    for (const validKey of ["key-alpha", "key-beta", "key-gamma"]) {
      const res = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          "x-api-key": validKey,
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "authorized" });
    }

    const badRes = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        "x-api-key": "key-delta",
      },
    });
    expect(badRes.statusCode).toBe(401);
    expect(badRes.json()).toEqual({ detail: "Invalid or missing API key" });
  });

  it("rejects request when API key is missing with 401", async () => {
    config.security.allowedApiKeys = ["secret-key-123"];

    const res = await app.inject({
      method: "GET",
      url: "/protected",
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ detail: "Invalid or missing API key" });
  });

  it("rejects request when API key is wrong with 401", async () => {
    config.security.allowedApiKeys = ["secret-key-123"];

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        "x-api-key": "wrong-key",
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ detail: "Invalid or missing API key" });
  });

  it("fails with 500 when server has no API key configured", async () => {
    config.security.allowedApiKeys = [];

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        "x-api-key": "any-key",
      },
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ detail: "Server API key is not configured" });
  });
});

describe("isValidApiKey", () => {
  const originalAllowedKeys = [...config.security.allowedApiKeys];

  afterEach(() => {
    config.security.allowedApiKeys = [...originalAllowedKeys];
  });

  it("returns false for null, undefined, or empty string", () => {
    config.security.allowedApiKeys = ["valid-key"];
    expect(isValidApiKey(null)).toBe(false);
    expect(isValidApiKey(undefined)).toBe(false);
    expect(isValidApiKey("")).toBe(false);
    expect(isValidApiKey("   ")).toBe(false);
  });

  it("returns false when length does not match allowed key length", () => {
    config.security.allowedApiKeys = ["secret123"];
    expect(isValidApiKey("short")).toBe(false);
    expect(isValidApiKey("longersecret123")).toBe(false);
  });

  it("returns true for matching key (ignoring surrounding whitespace)", () => {
    config.security.allowedApiKeys = ["secret123"];
    expect(isValidApiKey("secret123")).toBe(true);
    expect(isValidApiKey("  secret123  ")).toBe(true);
  });
});

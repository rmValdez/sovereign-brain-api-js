import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Python parity: app/core/config.py settings.allowed_api_keys
const KEY_VARS = ["API_KEY", "API_KEYS", "BRAIN_API_KEY", "ALLOWED_API_KEYS"] as const;

async function loadAllowedKeys(env: Partial<Record<(typeof KEY_VARS)[number], string>>) {
  // Set every key variable explicitly (empty when unused) so a local .env cannot leak in:
  // dotenv never overrides a variable that is already defined.
  for (const name of KEY_VARS) process.env[name] = env[name] ?? "";
  vi.resetModules();
  const { config } = await import("../src/core/config.js");
  return config.security.allowedApiKeys;
}

describe("API key configuration", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => KEY_VARS.forEach((n) => (saved[n] = process.env[n])));
  afterEach(() =>
    KEY_VARS.forEach((n) => (saved[n] === undefined ? delete process.env[n] : (process.env[n] = saved[n]))),
  );

  it("has no default key when nothing is configured", async () => {
    expect(await loadAllowedKeys({})).toEqual([]);
  });

  it("accepts API_KEY, BRAIN_API_KEY and comma-separated API_KEYS together", async () => {
    const keys = await loadAllowedKeys({ API_KEY: "a", BRAIN_API_KEY: "b", API_KEYS: " c , d ,," });
    expect(keys.sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("deduplicates keys configured in more than one variable", async () => {
    expect(await loadAllowedKeys({ API_KEY: "same", BRAIN_API_KEY: "same" })).toEqual(["same"]);
  });
});

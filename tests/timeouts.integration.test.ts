import http from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

// Fake Ollama whose behavior is picked by the user message:
//   "hang"  - accepts the request and never answers
//   "stall" - streams one token, then goes silent
//   "slow"  - streams SLOW_TOKENS tokens SLOW_GAP_MS apart (each gap under the idle timeout)
const REQUEST_TIMEOUT_MS = 400;
const IDLE_TIMEOUT_MS = 300;
const SLOW_TOKENS = 10;
const SLOW_GAP_MS = 100; // 10 x 100 ms = 1 s total: longer than the idle timeout, never idle that long

const upstreamClosed = new Map<string, Promise<void>>();

const mockOllama = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", async () => {
    const payload = JSON.parse(raw || "{}");
    const mode: string = payload.messages?.at(-1)?.content ?? "";
    upstreamClosed.set(mode, new Promise((resolve) => res.on("close", () => resolve())));

    if (mode === "hang") return; // never respond
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    const token = (t: string) => res.write(JSON.stringify({ message: { content: t }, done: false }) + "\n");

    if (mode === "stall") {
      token("first ");
      return; // then silence
    }
    if (mode === "slow") {
      for (let i = 0; i < SLOW_TOKENS && !res.destroyed; i++) {
        token(`s${i} `);
        await new Promise((r) => setTimeout(r, SLOW_GAP_MS));
      }
      res.end(JSON.stringify({ message: { content: "" }, done: true }) + "\n");
    }
  });
});

let server: FastifyInstance;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((r) => mockOllama.listen(0, "127.0.0.1", r));
  const ollamaPort = (mockOllama.address() as AddressInfo).port;

  // config.ts reads the environment once at import time, so set it before importing the app
  process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${ollamaPort}`;
  process.env.OLLAMA_REQUEST_TIMEOUT_MS = String(REQUEST_TIMEOUT_MS);
  process.env.OLLAMA_STREAM_IDLE_TIMEOUT_MS = String(IDLE_TIMEOUT_MS);
  process.env.API_KEY = "test-key";
  process.env.NODE_ENV = "test";

  const { buildServer } = await import("../src/app.js");
  server = await buildServer();
  await server.listen({ port: 0, host: "127.0.0.1" });
  baseUrl = `http://127.0.0.1:${(server.server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await server?.close();
  mockOllama.closeAllConnections();
  await new Promise((r) => mockOllama.close(r));
});

function post(path: string, message: string) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": "test-key" },
    body: JSON.stringify({ message }),
  });
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = Date.now();
  const result = await fn();
  return [result, Date.now() - start];
}

describe("Ollama timeouts (against a fake Ollama)", () => {
  it("fails /chat with the generic 500 when Ollama never answers, and closes the upstream request", async () => {
    const [res, ms] = await timed(() => post("/chat", "hang"));
    expect(res.status).toBe(500);
    expect((await res.json()).detail).toBe("An internal error occurred while processing the chat request.");
    expect(ms).toBeGreaterThanOrEqual(REQUEST_TIMEOUT_MS - 50);
    expect(ms).toBeLessThan(REQUEST_TIMEOUT_MS + 1500);
    await upstreamClosed.get("hang");
  });

  it("ends the stream when Ollama never sends a first token", async () => {
    const [body, ms] = await timed(async () => (await post("/chat/stream", "hang")).text());
    expect(body.startsWith("data: ")).toBe(true); // session frame was sent
    expect(body.split("\n\n").filter(Boolean)).toHaveLength(1); // and nothing else
    expect(ms).toBeLessThan(IDLE_TIMEOUT_MS + 1500);
    await upstreamClosed.get("hang");
  });

  it("ends the stream when Ollama goes silent mid-answer, keeping what was sent", async () => {
    const [body, ms] = await timed(async () => (await post("/chat/stream", "stall")).text());
    expect(body).toContain("first ");
    expect(ms).toBeGreaterThanOrEqual(IDLE_TIMEOUT_MS - 50);
    expect(ms).toBeLessThan(IDLE_TIMEOUT_MS + 1500);
    await upstreamClosed.get("stall");
  });

  it("does not cut off a slow stream that keeps producing tokens", async () => {
    const [body, ms] = await timed(async () => (await post("/chat/stream", "slow")).text());
    for (let i = 0; i < SLOW_TOKENS; i++) expect(body).toContain(`s${i} `);
    expect(ms).toBeGreaterThan(IDLE_TIMEOUT_MS); // ran longer than the idle limit overall
  });
});

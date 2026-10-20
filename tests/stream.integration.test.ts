import http from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

// Fake Ollama /api/chat. With `stream: false` it returns one JSON message, like the
// real API; otherwise it streams TOTAL_TOKENS NDJSON tokens, TOKEN_DELAY_MS apart, and
// records how many it sent before the connection closed. Every request body is kept.
const TOTAL_TOKENS = 30;
const TOKEN_DELAY_MS = 50;
const upstream = {
  tokensSent: 0,
  closed: Promise.resolve(),
  requests: [] as Array<Record<string, any>>,
};

const mockOllama = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", async () => {
    const payload = JSON.parse(raw || "{}");
    upstream.requests.push(payload);
    if (payload.stream === false) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: { role: "assistant", content: "non-stream reply" }, done: true }));
      return;
    }

    upstream.tokensSent = 0;
    let markClosed!: () => void;
    upstream.closed = new Promise((r) => (markClosed = r));
    res.on("close", markClosed);

    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    while (upstream.tokensSent < TOTAL_TOKENS && !res.destroyed) {
      res.write(JSON.stringify({ message: { content: `t${upstream.tokensSent} ` }, done: false }) + "\n");
      upstream.tokensSent++;
      await new Promise((r) => setTimeout(r, TOKEN_DELAY_MS));
    }
    if (!res.destroyed) res.end(JSON.stringify({ message: { content: "" }, done: true }) + "\n");
  });
});

// Python parity: app/core/config.py (ollama_keep_alive, ollama_num_ctx) and
// app/infrastructure/ollama/adapter.py `_get_ollama_options()`
const PYTHON_GENERATION_SETTINGS = {
  keep_alive: "5m",
  options: { repeat_penalty: 1.15, repeat_last_n: 64, temperature: 0.7, num_ctx: 8192 },
};

// Requests from earlier tests can still arrive (e.g. a cancelled stream), so find the
// one whose last message is this test's own text rather than assuming a count.
function requestFor(message: string) {
  const matches = upstream.requests.filter((r) => r.messages?.at(-1)?.content === message);
  expect(matches).toHaveLength(1);
  return matches[0];
}

let server: FastifyInstance;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((r) => mockOllama.listen(0, "127.0.0.1", r));
  const ollamaPort = (mockOllama.address() as AddressInfo).port;

  // config.ts reads the environment once at import time, so set it before importing the app
  process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${ollamaPort}`;
  delete process.env.OLLAMA_NUM_CTX; // exercise the defaults, which must match Python's
  delete process.env.OLLAMA_KEEP_ALIVE;
  process.env.API_KEY = "test-key";
  process.env.NODE_ENV = "test";
  process.env.CORS_ALLOWED_ORIGINS = "https://app.example";

  const { buildServer } = await import("../src/app.js");
  server = await buildServer();
  await server.listen({ port: 0, host: "127.0.0.1" });
  baseUrl = `http://127.0.0.1:${(server.server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await server?.close();
  await new Promise((r) => mockOllama.close(r));
});

function postStream(headers: Record<string, string> = {}, signal?: AbortSignal, message = "hey how's it going") {
  return fetch(`${baseUrl}/api/v1/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": "test-key", ...headers },
    body: JSON.stringify({ message }),
    signal,
  });
}

describe("POST /api/v1/chat/stream (against a fake Ollama)", () => {
  it("rejects requests without an API key", async () => {
    const res = await postStream({ "X-API-Key": "" });
    expect(res.status).toBe(401);
  });

  it("emits the session frame first, then the model tokens", async () => {
    const res = await postStream();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");

    const body = await res.text();
    const firstFrame = body.split("\n\n")[0];
    expect(firstFrame.startsWith("data: ")).toBe(true);
    const session = JSON.parse(firstFrame.slice("data: ".length));
    expect(session.type).toBe("session");
    expect(session.session_id).toBeTruthy();
    expect(session.trace_id).toBeTruthy();
    expect(body).toContain("t0 t1 t2 ");
    expect(body).toContain(`t${TOTAL_TOKENS - 1} `);
  });

  it("echoes an allowed origin instead of a wildcard", async () => {
    const res = await postStream({ Origin: "https://app.example" });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example");
    await res.body?.cancel();
  });

  it("omits CORS headers for a disallowed origin without failing the request", async () => {
    const res = await postStream({ Origin: "https://evil.example" });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    await res.body?.cancel();
  });

  it("sends Python's generation options on the streaming path", async () => {
    const message = "options check (stream)";
    const res = await postStream({}, undefined, message);
    await res.text();

    expect(requestFor(message)).toMatchObject({ stream: true, ...PYTHON_GENERATION_SETTINGS });
  });

  it("sends Python's generation options on the non-streaming /chat path", async () => {
    const message = "options check (non-stream)";
    const res = await fetch(`${baseUrl}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": "test-key" },
      body: JSON.stringify({ message }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).response).toBe("non-stream reply");

    expect(requestFor(message)).toMatchObject({ stream: false, ...PYTHON_GENERATION_SETTINGS });
  });

  it("cancels the upstream Ollama generation when the client disconnects", async () => {
    const client = new AbortController();
    const res = await postStream({}, client.signal);
    const reader = res.body!.getReader();
    await reader.read(); // session frame
    await reader.read(); // first token(s)
    client.abort();

    await upstream.closed;
    expect(upstream.tokensSent).toBeLessThan(TOTAL_TOKENS / 2);
  });
});

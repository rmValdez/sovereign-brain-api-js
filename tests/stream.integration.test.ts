import http from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

// Fake Ollama /api/chat: streams TOTAL_TOKENS NDJSON tokens, TOKEN_DELAY_MS apart,
// and records how many it sent before the connection closed.
const TOTAL_TOKENS = 30;
const TOKEN_DELAY_MS = 50;
const upstream = { tokensSent: 0, closed: Promise.resolve() };

const mockOllama = http.createServer((req, res) => {
  req.resume();
  req.on("end", async () => {
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

let server: FastifyInstance;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((r) => mockOllama.listen(0, "127.0.0.1", r));
  const ollamaPort = (mockOllama.address() as AddressInfo).port;

  // config.ts reads the environment once at import time, so set it before importing the app
  process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${ollamaPort}`;
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

function postStream(headers: Record<string, string> = {}, signal?: AbortSignal) {
  return fetch(`${baseUrl}/api/v1/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": "test-key", ...headers },
    body: JSON.stringify({ message: "hey how's it going" }),
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

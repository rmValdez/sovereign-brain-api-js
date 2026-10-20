# TURNING POINT CHECKPOINT 1: Hardened Baseline & Honest Parity Tracking

> **STATUS**: CHECKPOINT 1 — SECURITY + STREAMING HARDENED, TESTED AGAINST A FAKE OLLAMA, TRACKER CORRECTED
> **TIMESTAMP**: 2026-10-21
> **GIT**: Repository initialized on `master`, **no commits yet** — everything below is uncommitted
> **REFERENCE BACKEND**: `soveriegn-brain-api-py` (FastAPI, port `3009`) — the behavioral ground truth

---

## 1. Executive Summary

`sovereign-brain-api-js` is the TypeScript/Fastify port of the Python brain API. The goal is one Next.js
frontend, two independent backends, a side-by-side comparison, then a written keep/replace decision
(see [docs/SOVEREIGN_ARCHITECTURE_AND_PARITY_PLAN.md](docs/SOVEREIGN_ARCHITECTURE_AND_PARITY_PLAN.md)).

This checkpoint marks the point where the scaffold stopped being a demo:

- The fake `[AgentLoop] Processed tool plan…` reply is gone; every request gets a real model answer.
- API-key auth, CORS and the streaming lifecycle now match Python, and each fix has a test that
  **fails against the old code** (verified by temporarily restoring it).
- The parity tracker was corrected to show only what has evidence. Earlier versions marked items
  Parity-Verified that were demonstrably broken.

## 2. Verification Status

| Check | Result | Command |
|---|---|---|
| TypeScript | ✅ 0 errors | `npx tsc --noEmit` |
| Classifier (Python's own tests, ported verbatim) | ✅ 17 / 17 | `pnpm test` |
| Config / API-key handling | ✅ 3 / 3 | `tests/config.test.ts` |
| Stream integration vs fake Ollama | ✅ 5 / 5 | `tests/stream.integration.test.ts` |
| **Total** | ✅ **25 / 25** | |
| Against a real Ollama + Postgres | ⚪ Not run | — |
| Parity vs Python with identical payloads | ⚪ Classifier only | Milestone 5 harness not built |

## 3. What Changed in This Turning Point

### A. Security (Python parity)
- **No default API key.** `API_KEY` defaults to `""`; with no key set, protected routes refuse every
  request (Python `config.py` behavior). Previously a published default key was accepted.
- **All of Python's key variables.** Allowed keys = union of `API_KEY`, `BRAIN_API_KEY`, comma-separated
  `API_KEYS` (+ JS-only alias `ALLOWED_API_KEYS`), deduplicated.
- **Constant-time key check** from `X-API-Key`, `Authorization: Bearer`, or `?api_key=`, same order as Python.
- **CORS allowlist.** Localhost trusted outside production, `CORS_ALLOWED_ORIGINS` otherwise. Blocked
  origins get no CORS headers (`cb(null, false)`), matching Python's `CORSMiddleware` — not a 500.
- **Sanitized 500s** via a global error handler.

### B. Streaming lifecycle
- **`reply.hijack()`** on `/api/v1/chat/stream`; the CORS plugin's headers are copied onto the raw
  response. The hard-coded `Access-Control-Allow-Origin: *` is gone.
- **Client disconnect now cancels Ollama.** The abort listens on `reply.raw` "close".
  `request.raw` "close" fires as soon as the body is read on Node ≥ 16 (confirmed on Node 24), so the
  old listener never signalled a real disconnect.
- **Session frame first**: `data: {"type":"session", …}` precedes model tokens.

### C. Brain routing
- Model routing matches Python `router.py`: CODING/DEBUGGING → coding model, COMPLEX_TASK →
  `hermes3:8b`, everything else (including TOOL_OPERATION) → `qwen3:8b`.
- Tool requests go to the model with a "tools are not wired yet" notice instead of a fake completion.
- Classifier keyword sets and freshness rules match Python, including Python's behavior of classifying
  with the editor block attached (kept deliberately — see the Python Bug Rule in the tracker).

### D. Structure
- Server setup moved to `buildServer()` in [src/app.ts](src/app.ts); [src/index.ts](src/index.ts) only listens.
  Tests start the real server on a random port.
- Env names aligned with Python (`OLLAMA_BASE_URL`, `OLLAMA_GENERAL_MODEL`, …; old names still work).

## 4. Configuration Facts

| Item | Value | Source |
|---|---|---|
| Python port | `3009` | `docker-compose.yml`, `uvicorn --port 3009` |
| TypeScript port | `8001` | `PORT` in `.env` — must differ for side-by-side runs |
| Database | `postgresql://…@localhost:5434/sovereign_brain` | Python `.env.example` |
| Schema owner | Alembic (Python) only | Drizzle here is read-only |
| Vectors | pgvector, 768 dims (`nomic-embed-text`) | `memories`, `document_chunks` |
| Search distance cutoffs | `0.5` memory / `0.5` knowledge | Python `config.py:108-109` |
| Graph tables | None exist | 10 Alembic migrations checked |
| Auth in this API | Shared API key only | Better Auth lives in the Next app, not in Python |

## 5. Work In Progress at This Checkpoint

- **2.7 Ollama generation options — implemented, not yet tested.** `OLLAMA_NUM_CTX` (8192) and
  `OLLAMA_KEEP_ALIVE` (`5m`) are in `config.ts`, and [adapter.ts](src/infrastructure/ollama/adapter.ts)
  now sends `keep_alive` and `options.num_ctx` from both `chat()` and `streamChat()`, as Python does
  (`app/infrastructure/ollama/adapter.py`). No test asserts the request body yet.

## 6. Next Steps (in order)

1. **Commit this checkpoint** on a task branch (per `AGENTS.md`), e.g. `fix/hardening-baseline`.
2. Verify **2.7**: extend the fake Ollama in `tests/stream.integration.test.ts` to record the request
   body and assert `keep_alive` and `options.num_ctx` arrive.
3. **2.4** Configurable Ollama timeouts.
4. **2.6** Record what Python actually emits when a stream fails mid-way (it has no error frame — only
   `session` and `confirmation` frames), then match it.
5. **2.5** Record golden Python responses (streaming and non-streaming) as fixtures.
6. Fill test gaps: Bearer and `?api_key=` keys, the "key not configured" 500, router, error sanitizing.
7. Then **Milestone 3** — persistence (Drizzle reading the existing schema, sessions, history, memory, RAG).

Optional doc cleanup still pending a decision: drop the "(Phase N)" labels from the milestone headings in
`docs/IMPLEMENTATION_PLAN.md`, since the architecture doc numbers its phases differently.

## 7. Rules That Hold From Here

- Python is the reference: fix TS to match it, or record the difference in the tracker.
- Tick a box only with evidence — a test for **Verified**, an identical-payload comparison with Python
  for **Parity-Verified**.
- No Qdrant, Neo4j or backend Redis before the retrieval-improvement milestone.
- Never run Drizzle migrations against the shared database.

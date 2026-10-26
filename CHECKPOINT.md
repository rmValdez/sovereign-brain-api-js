# TURNING POINT CHECKPOINT 2: Staging Workflow, Timeouts & Generation Parity

> **STATUS**: CHECKPOINT 2 — MILESTONE 2 IN PROGRESS (2.4 + 2.7 DONE), STAGING WORKFLOW ADOPTED
> **TIMESTAMP**: 2026-10-21
> **GIT**: Work lands on `staging`; `main` only receives a sync when the owner decides.
> `staging` is ahead of `main` with 2.7 (PR #50), staging rules (#51), 2.4 (#52) and this checkpoint.
> **TRACKING**: GitHub project [sovereign-mind](https://github.com/users/rmValdez/projects/2) — 57 issues
> **REFERENCE BACKEND**: `soveriegn-brain-api-py` (FastAPI, port `3009`) — the behavioral ground truth

---

## 0. Resume Here

```bash
cd sovereign-brain-api-js
git fetch origin && git log --oneline origin/main..origin/staging   # what main is still missing
git checkout staging && git pull
pnpm install && npx tsc --noEmit && pnpm test                        # expect 31 passed
git checkout -b feat/<next-task>                                      # always from staging
```

Next task: **[api-js] 2.6 — mid-stream failure behavior** (board: Milestone 2, P0, Ready). See section 6.

## 1. Executive Summary

`sovereign-brain-api-js` is the TypeScript/Fastify port of the Python brain API. The goal is one Next.js
frontend, two independent backends, a side-by-side comparison, then a written keep/replace decision
(see [docs/SOVEREIGN_ARCHITECTURE_AND_PARITY_PLAN.md](docs/SOVEREIGN_ARCHITECTURE_AND_PARITY_PLAN.md)).

- **Checkpoint 1** (PR #1, on `main`): the scaffold stopped being a demo — real model answers, API-key
  auth, CORS and streaming lifecycle matching Python, each fix guarded by a test that fails on the old code.
- **Checkpoint 2** (on `staging`): Python's full generation settings, Ollama timeouts, and the continuous
  staging workflow across every Sovereign and template repo.

## 2. Verification Status

| Check | Result | Command / file |
|---|---|---|
| TypeScript | ✅ 0 errors | `npx tsc --noEmit` |
| Classifier (Python's own tests, ported verbatim) | ✅ 17 / 17 | `tests/classifier.test.ts` |
| Config / API-key handling | ✅ 3 / 3 | `tests/config.test.ts` |
| Security middleware (Python test_security.py parity) | ✅ 10 / 10 | `tests/security.test.ts` |
| Request context extraction (Python context.py parity) | ✅ 9 / 9 | `tests/context.test.ts` |
| Error sanitization (Python test_chat.py parity) | ✅ 3 / 3 | `tests/error-handler.test.ts` |
| Model routing (Python test_model_router.py parity) | ✅ 5 / 5 | `tests/router.test.ts` |
| Stream integration vs fake Ollama | ✅ 8 / 8 | `tests/stream.integration.test.ts` |
| Timeouts vs fake Ollama | ✅ 4 / 4 | `tests/timeouts.integration.test.ts` |
| **Total** | ✅ **59 / 59** | `pnpm test` |
| Against a real Ollama + Postgres | ⚪ Not run | — |
| Parity vs Python with identical payloads | ⚪ Classifier only | Milestone 5 harness not built |

Other Sovereign repos on `staging` (2026-10-21): api-py **533 passed, 4 skipped**; app type check clean,
**107/125** — the 18 failures are Postgres/Redis-backed tests that time out because Docker was not running.
Re-run the app suite with Docker up before the next `staging` → `main` sync.

## 3. What Changed

### Checkpoint 1 (on `main`, PR #1)
- **Security:** no default API key; keys = union of `API_KEY`, `BRAIN_API_KEY`, `API_KEYS`
  (+ alias `ALLOWED_API_KEYS`); constant-time check from `X-API-Key`, `Bearer`, `?api_key=`; CORS
  allowlist (blocked origins get no CORS headers, not a 500); sanitized 500s.
- **Streaming:** `reply.hijack()` with the CORS plugin's headers copied to the raw response; disconnect
  aborts Ollama via `reply.raw` "close" (`request.raw` fires once the body is read on Node ≥ 16);
  session frame first.
- **Routing:** matches Python `router.py`; tool requests get a real answer with a "tools not wired yet"
  notice instead of a fake completion.
- **Structure:** `buildServer()` in [src/app.ts](src/app.ts) so tests run the real server.

### Checkpoint 2 (on `staging`)
- **2.7 Generation options (PR #50).** Python sends `temperature 0.7`, `repeat_penalty 1.15`,
  `repeat_last_n 64`, `num_ctx 8192` and `keep_alive 5m` on every call; TS sent only `num_ctx`.
  `getOllamaOptions()` now mirrors Python on `chat()` and `streamChat()`; tests assert the full body.
- **2.4 Timeouts (PR #52).** `OLLAMA_REQUEST_TIMEOUT_MS` (300 s, total for `chat`/`embed`) and
  `OLLAMA_STREAM_IDLE_TIMEOUT_MS` (120 s, longest gap between streamed chunks, incl. the first). A timeout
  returns the generic 500 on `/chat` or ends the stream, and closes the upstream request. **Deliberate
  difference from Python**, whose Ollama client has no timeout.
- **Workflow (PR #51).** Continuous staging rules added to `AGENTS.md` (see section 8).

## 4. Configuration Facts

| Item | Value | Source |
|---|---|---|
| Python port | `3009` | `docker-compose.yml`, `uvicorn --port 3009` |
| TypeScript port | `8001` | `PORT` in `.env` — must differ for side-by-side runs |
| Database | `postgresql://…@localhost:5434/sovereign_brain` | Python `.env.example` |
| Schema owner | Alembic (Python) only | Drizzle here is read-only |
| Vectors | pgvector, 768 dims (`nomic-embed-text`) | `memories`, `document_chunks` |
| Search distance cutoffs | `0.5` memory / `0.5` knowledge | Python `config.py:108-109` |
| Ollama generation | temp 0.7, repeat_penalty 1.15, repeat_last_n 64, num_ctx 8192, keep_alive 5m | Python `adapter.py` |
| Ollama timeouts (TS only) | 300 s request / 120 s stream idle | `config.ts` |
| Graph tables | None exist | 10 Alembic migrations checked |
| Auth in this API | Shared API key only | Better Auth lives in the Next app, not in Python |

## 5. Board State

| Issue | Status | Note |
|---|---|---|
| [api-js] 2.7 Ollama options (#13) | In review | In `staging`; closes at the next `staging` → `main` sync |
| [api-js] 2.4 Timeouts (#14) | In review | Same |
| [api-js] 2.6, 2.5, revised plan doc | Ready | Next up |

Convention: **In review** = merged into `staging`, waiting for delivery to `main`.

## 6. Next Steps (in order)

1. **2.6 Mid-stream failure behavior.** Record what Python actually emits when a stream fails part-way
   (it has no error frame — only `session` and `confirmation` frames, `orchestrator.py:300/387`), then
   match it in TS. Today TS just closes the connection.
2. **2.5 Golden Python SSE fixtures.** Record representative Python `/chat` and `/chat/stream` responses
   (needs api-py running on `:3009`) and compare TS frame types, order and shape against them.
3. **Docs:** replace `docs/IMPLEMENTATION_PLAN.md` with the revised Milestone 1-6 plan, with the agreed
   corrections (2.7 status, table names `memories`/`document_chunks`, no Postgres graph data, known facts,
   drop the "(Phase N)" heading labels).
4. Fill test gaps: Bearer and `?api_key=` keys, the "key not configured" 500, router, error sanitizing.
5. Then **Milestone 3** — persistence (Drizzle reading the existing schema, sessions, history, memory, RAG).
6. When the owner decides: one PR `staging` → `main` (after re-running every suite, app with Docker up).

## 7. Work Tracking

All Sovereign work is on the GitHub project [sovereign-mind](https://github.com/users/rmValdez/projects/2):

- Kanban tabs: **All**, **api-js**, **api-py**, **app**, **extension**, **cross-repo**.
- Fields: Status, Priority (P0-P2), Size (XS-XL), Area.
- 57 issues labeled `sovereign-brain`, titles prefixed by repo (`[api-js]`, `[app]`, `[cross-repo]`).
- Milestone parents with sub-issues: api-js #2 (M1), #12 (M2), #20 (M3), #28 (M4), #38 (M5);
  project-sovereign #3 (M6). Current focus: api-js Milestone 2.
- All 5 Sovereign repos are linked to the project. Templates have their own board:
  [templates](https://github.com/users/rmValdez/projects/1).
- This file and `docs/IMPLEMENTATION_PLAN.md` record the evidence; the board tracks the work.

## 8. Rules That Hold From Here

- **Git:** task branches start from the latest `staging`; every finished task is a PR into `staging`;
  `staging` → `main` only when the owner decides, after validating the combined changes. When a task is
  done, ask the owner whether it is all good. Never bypass commit hooks. (Full text: `AGENTS.md`.)
- Python is the reference: fix TS to match it, or record the difference in the tracker.
- Tick a box only with evidence — a test for **Verified**, an identical-payload comparison with Python
  for **Parity-Verified**.
- No Qdrant, Neo4j or backend Redis before the retrieval-improvement milestone.
- Never run Drizzle migrations against the shared database.

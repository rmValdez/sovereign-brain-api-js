# TURNING POINT CHECKPOINT 3: Milestone 1 Hardened & Streaming Resilience

> **STATUS**: CHECKPOINT 3 — MILESTONE 1 LARGELY COMPLETED, MILESTONE 2 ADVANCED (STREAMING RESILIENCE & TIMEOUTS VERIFIED)
> **TIMESTAMP**: 2026-10-26
> **GIT**: Work lands on `staging`; `main` only receives a sync when the owner decides.
> `staging` is up to date with PRs #50-#59 and all tests passing (62/62).
> **TRACKING**: GitHub project [sovereign-mind](https://github.com/users/rmValdez/projects/2)
> **REFERENCE BACKEND**: `soveriegn-brain-api-py` (FastAPI, port `3009` / `8000`) — the behavioral ground truth

---

## 0. Resume Here Tomorrow

```bash
cd sovereign-brain-api-js
git fetch origin && git log --oneline origin/main..origin/staging   # what main is still missing
git checkout staging && git pull --ff-only
pnpm install && npx tsc --noEmit && pnpm test                        # expect 62 passed across 9 test suites
git checkout -b <type>/<short-description>                           # always branch from latest staging
```

Next tasks up for tomorrow:
1. **[api-js] 1.6 — Compare editor-context classification with Python (#7)**: Verify and test message classification with editor block attached per Python `orchestrator.py:194`.
2. **[api-js] 1.1 — Fail-fast startup (#3)**: Test environment validation (`EnvSchema.safeParse` process exit on invalid config).
3. **[api-js] 2.5 — Golden Python SSE fixtures (#16)**: Record golden Python SSE frames and compare frame ordering.
4. **[api-js] 2.8 — Test stream against Next.js SSE parser (#17)**: Assert stream format directly against `sse.ts`.
5. **Milestone 3 — Persistence & baseline RAG (#20-#27)**: Drizzle schema mapping (read-only against `:5434`), session persistence, and memory/knowledge retrieval.

---

## 1. Executive Summary

`sovereign-brain-api-js` is the TypeScript/Fastify port of the Python brain API. The goal is one Next.js frontend, two independent backends, a side-by-side comparison, then a written keep/replace decision (see [docs/SOVEREIGN_ARCHITECTURE_AND_PARITY_PLAN.md](docs/SOVEREIGN_ARCHITECTURE_AND_PARITY_PLAN.md)).

- **Checkpoint 1** (on `main`, PR #1): The scaffold stopped being a demo — real model answers, API-key auth, CORS and streaming lifecycle matching Python.
- **Checkpoint 2** (on `staging`, PRs #50-#53): Python's generation options (`temp 0.7`, `repeat_penalty 1.15`, `repeat_last_n 64`, `num_ctx 8192`, `keep_alive 5m`), configurable Ollama timeouts (`OLLAMA_REQUEST_TIMEOUT_MS`, `OLLAMA_STREAM_IDLE_TIMEOUT_MS`), and the continuous staging workflow.
- **Checkpoint 3** (on `staging`, PRs #54-#59):
  - **Task 2.6 (Issue #15)**: Mid-stream failure behavior. Python emits no error frame on stream failure; TS Fastify stream cleanly logs server-side and terminates connection (`reply.raw.end()`). PR #54 merged.
  - **Task 1.2 (Issue #4)**: API key verification middleware. Ported Python `test_security.py` covering `X-API-Key`, `Authorization: Bearer <key>`, `?api_key=`, comma-separated keys, and constant-time string comparison. PR #55 merged.
  - **Task 1.3 (Issue #5)**: Request context extraction. Case-insensitive header handling and client type normalization matching Python `context.py`. PR #56 merged.
  - **Task 1.4 (Issue #6)**: Error sanitization in 500 responses. Masks database credentials, internal hosts, IPs, and passwords behind generic 500 detail. PR #57 merged.
  - **Task 1.8 (Issue #9)**: Model routing. Ported Python `test_model_router.py` verifying all 6 task types route to expected Ollama models and dynamic live configuration updates. PR #58 merged.
  - **Task 1.7 (Issue #8)**: Honest tool fallback. Direct tool requests emit honest transition notice `[Notice: Direct tool execution is being wired...]` without fake `[AgentLoop]` completion strings. PR #59 merged.
  - **Retrieval Master Plan**: Added [docs/AI_RETRIEVAL_ARCHITECTURE.md](docs/AI_RETRIEVAL_ARCHITECTURE.md) documenting the 55-method taxonomy, Graph Retrieval vs GraphRAG, and Sovereign Brain roadmap.

---

## 2. Verification Status

| Check | Result | Command / file |
|---|---|---|
| TypeScript compilation | ✅ 0 errors | `npx tsc --noEmit` |
| Classifier (Python tests ported verbatim) | ✅ 17 / 17 | `tests/classifier.test.ts` |
| Config & fail-fast startup exit | ✅ 6 / 6 | `tests/config.test.ts` |
| Security middleware (Python test_security.py parity) | ✅ 10 / 10 | `tests/security.test.ts` |
| Request context extraction (Python context.py parity) | ✅ 9 / 9 | `tests/context.test.ts` |
| Error sanitization (Python test_chat.py parity) | ✅ 3 / 3 | `tests/error-handler.test.ts` |
| Model routing (Python test_model_router.py parity) | ✅ 5 / 5 | `tests/router.test.ts` |
| Honest tool fallback (no fake completions) | ✅ 3 / 3 | `tests/honest-fallback.test.ts` |
| Stream integration vs fake Ollama | ✅ 8 / 8 | `tests/stream.integration.test.ts` |
| Timeouts vs fake Ollama | ✅ 4 / 4 | `tests/timeouts.integration.test.ts` |
| App dependency injection | ✅ 1 / 1 | `tests/app-deps.test.ts` |
| Editor context (Python test_editor_context.py parity) | ✅ 21 / 21 | `tests/editor-context.test.ts` |
| **Total Test Suite** | ✅ **87 / 87 passed** | `pnpm test` (across 11 test files) |

---

## 3. Configuration Facts

| Item | Value | Source |
|---|---|---|
| Python port | `3009` (or `8000`) | `docker-compose.yml`, `uvicorn --port 3009` |
| TypeScript port | `8001` | `PORT` in `.env` — must differ for side-by-side runs |
| Database | `postgresql://…@localhost:5434/sovereign_brain` | Shared PostgreSQL container |
| Schema owner | Alembic (Python) only | Drizzle in TS is strictly read-only |
| Vectors | pgvector, 768 dims (`nomic-embed-text`) | `memories`, `document_chunks` |
| Search distance cutoffs | `0.5` memory / `0.5` knowledge | Python `config.py:108-109` |
| Ollama generation | temp 0.7, repeat_penalty 1.15, repeat_last_n 64, num_ctx 8192, keep_alive 5m | Python `adapter.py` parity |
| Ollama timeouts (TS only) | 300 s request / 120 s stream idle | `config.ts` |
| Auth in this API | Shared API key only | Better Auth lives in `soveriegn-brain-app` (`:5435`) |

---

## 4. Closed Issues in This Sprint

* ✅ Issue #3: Test fail-fast startup on invalid configuration (PR #63)
* ✅ Issue #4: Test API key middleware: Bearer, `?api_key=`, invalid key, 'not configured' 500 (PR #55)
* ✅ Issue #5: Add tests for request context extraction (PR #56)
* ✅ Issue #6: Add tests for error sanitization in 500 responses (PR #57)
* ✅ Issue #7: Compare editor-context classification with Python (PR #62)
* ✅ Issue #8: Test honest tool fallback (no fake completion) (PR #59)
* ✅ Issue #9: Add model-router tests for every task type (PR #58)
* ✅ Issue #14: Add configurable Ollama timeouts (PR #53)
* ✅ Issue #15: Record Python's mid-stream failure behavior and match it (PR #54)

---

## 5. Architectural Rules & Continuity

- **Continuous Staging Workflow**: Always branch from `staging` (`git checkout -b <type>/<name>`), open PRs to `staging`, never push directly to `staging` or `main`.
- **Python is Ground Truth**: When behavior differs, verify against `soveriegn-brain-api-py`.
- **Drizzle Schema Safety**: Drizzle never runs migrations against `:5434`. Alembic owns migrations.
- **Evidence-Based Done**: Every issue requires an automated test in `tests/` and green execution.

---

## 6. Architecture Refactor — Foxpassport-Style Layering (2026-10-27)

> **Branch**: `refactor/module-boundaries` (from `staging` @ `83d57ce`). **Committed** (`54fdf4e`), pushed, and submitted as **PR #61** targeting `staging`. The rest of this file describes `staging`; this section describes the branch.

**Why.** A structure review found the code was mostly modular (one-way dependencies, no cycles, constructor injection) but had three flaws:
1. `infrastructure/ollama/router.ts` imported `TaskType` from `modules/brain/classifier`, so the lowest layer depended on a feature.
2. The orchestrator and context engine depended on the concrete `OllamaAdapter`; there was no LLM interface, unlike Python's `LLMProvider`.
3. `chat/routes.ts` created `new BrainOrchestrator()` at module level, and `core/database.ts` opened its `pg` Pool on import, so neither could be injected.

The layout was then aligned with `forhu/foxpassport/fox-passport-republic-api` (used as reference only, not modified).

**What changed.**

| Area | Before | After |
|---|---|---|
| Chat module | `modules/chat/routes.ts` (wiring and handlers mixed, option mapping duplicated), `schemas.ts` | `chat.routes.ts` (wiring and `verifyApiKey` guard only) → `chat.controller.ts` (parse, call service, SSE response; one shared `toProcessOptions`) → `chat.schemas.ts` |
| Brain services | `orchestrator.ts`, `context.ts` | `orchestrator.service.ts`, `context.service.ts` (same names as Python's files, plus the layer suffix) |
| LLM contract | none; concrete `OllamaAdapter` everywhere | `src/core/llm.ts`: `LLMProvider` + `ChatMessage`; `OllamaAdapter implements LLMProvider`; services type against the interface |
| `TaskType` | `modules/brain/classifier.ts` | `src/core/task-type.ts`; `classifier.ts` re-exports it, so existing imports still work |
| Wiring | module-level `new BrainOrchestrator()` | `buildServer(deps = {})` creates it (or takes `deps.orchestrator`) and passes it to `chatRoutes` as a plugin option |
| DB | `export const dbPool = new Pool(...)` on import | `getDbPool()`, created on first use |
| tsconfig | unused `@/*` path alias | removed: the checker can't follow aliases and refuses to run if one exists |
| Checker | none | `tools/validate-architecture.mjs` (ported from foxpassport) and `pnpm validate`. Rules: repository ↛ service/controller/routes, service ↛ controller/routes, controller ↛ routes/repository, utils ↛ business layers, **`core`/`infrastructure` ↛ anything in `modules/`** (added for this repo). Also resolves NodeNext `.js` specifiers to `.ts` files |
| Docs and skills | — | AGENTS.md: new "Layer Boundaries" table, `pnpm validate` added to verification and the completion report. `.agents/skills/github-pr-workflow` and `.agents/skills/architecture-boundaries` added |

**Endpoints and behaviour are unchanged**: same URLs, same request/response shapes, same SSE frames, same error sanitization.

**Verification (2026-10-27).**

| Check | Result |
|---|---|
| `pnpm validate` | ✅ 18 files, 0 violations. Negative test: putting the old `infrastructure → modules/brain` import back makes it fail as expected |
| `pnpm build` (`tsc`) | ✅ |
| `pnpm test` | ✅ **63/63** across 10 files (62 existing + new `tests/app-deps.test.ts`, which injects a fake `LLMProvider` through `buildServer({ orchestrator })`) |
| `pnpm dev` boot | ✅ `/health` 200; with `API_KEY` set: no key → 401, bad body → 400 on `/chat` and `/chat/stream`. Without `API_KEY`, `/chat` returns 500 "Server API key is not configured" by design (`core/security.ts`, unchanged) |
| `pnpm lint` | ⛔ blocked: `eslint` isn't installed (pre-existing) |

**Parity status:** Verified. Behaviour is unchanged; no side-by-side run against Python was made for this refactor.

**Gotchas hit:**
- `sed -i` on Windows rewrote CRLF to LF in every file it touched, and 7 test files showed as modified with no content change. They were restored with `git checkout`. Git stores LF, so the remaining LF working copies commit identically.
- A server left running on `:8001` from an earlier boot check answered the second probe. Check `netstat -ano | grep :8001` before boot checks.

**Next for this repo after merge:**
- Install `eslint` (or remove the `lint` script).
- Add `pnpm validate` to CI once a workflow exists.
- When memory and sessions are ported, add `*.repository.ts` files. Python's 12 baseline violations (`soveriegn-brain-api-py/docs/architecture/LAYER_BOUNDARIES.md`) must not be ported along with the code.

# TURNING POINT CHECKPOINT 4: Milestone 1 100% Complete & Architecture Boundaries Enforced

> **STATUS**: CHECKPOINT 4 — MILESTONE 1 100% COMPLETE, CLEAN ARCHITECTURE BOUNDARIES ACTIVE, MILESTONE 2 ADVANCED (92/92 TESTS PASSING ACROSS 12 SUITES)
> **TIMESTAMP**: 2026-10-27
> **GIT**: Work lands on `staging`; `main` only receives a sync when the owner decides.
> `staging` is up to date with PRs #50-#63 and all tests passing (92/92). PR #64 is open targeting `staging`.
> **TRACKING**: GitHub project [sovereign-mind](https://github.com/users/rmValdez/projects/2)
> **REFERENCE BACKEND**: `soveriegn-brain-api-py` (FastAPI, port `3009` / `8000`) — the behavioral ground truth

---

## 0. Resume Here Tomorrow

```bash
cd sovereign-brain-api-js
git fetch origin && git log --oneline origin/main..origin/staging   # what main is still missing
git checkout staging && git pull --ff-only
pnpm install && pnpm validate && npx tsc --noEmit && pnpm test      # expect 92 passed across 12 test suites, 0 boundary violations
git checkout -b <type>/<short-description>                           # always branch from latest staging
```

Next tasks up for tomorrow:
1. **[api-js] PR #64**: Merge PR #64 (Task 2.8 / Issue #17 — Next.js SSE parser alignment).
2. **[api-js] 2.5 — Golden Python SSE fixtures (#16)**: Record golden Python SSE frames and compare frame ordering and metadata shapes.
3. **[api-js] Issue #18 — Stream abort & CORS preflight**: Final hardening tests for Milestone 2 exit condition.
4. **Milestone 3 — Persistence & baseline RAG (#20-#27)**: Drizzle schema mapping (strictly read-only against `:5434`), session persistence, and memory/knowledge retrieval.
5. **[api-py] Fix 1 — Architecture baseline burndown**: Move `LLMProvider` and `TaskType` into `app/core/`, reducing baseline violations from 12 to 5.

---

## 1. Executive Summary

`sovereign-brain-api-js` is the TypeScript/Fastify port of the Python brain API. The goal is one Next.js frontend, two independent backends, a side-by-side comparison, then a written keep/replace decision (see [docs/SOVEREIGN_ARCHITECTURE_AND_PARITY_PLAN.md](docs/SOVEREIGN_ARCHITECTURE_AND_PARITY_PLAN.md)).

- **Checkpoint 1** (on `main`, PR #1): The scaffold stopped being a demo — real model answers, API-key auth, CORS and streaming lifecycle matching Python.
- **Checkpoint 2** (on `staging`, PRs #50-#53): Python's generation options (`temp 0.7`, `repeat_penalty 1.15`, `repeat_last_n 64`, `num_ctx 8192`, `keep_alive 5m`), configurable Ollama timeouts (`OLLAMA_REQUEST_TIMEOUT_MS`, `OLLAMA_STREAM_IDLE_TIMEOUT_MS`), and the continuous staging workflow.
- **Checkpoint 3** (on `staging`, PRs #54-#59): Mid-stream failure behavior, security middleware parity, request context extraction, error sanitization in 500 responses, model routing for all task types, honest tool fallback, and the master AI retrieval spec.
- **Checkpoint 4** (on `staging`, PRs #61-#64):
  - **Clean Architecture Boundaries & DI Refactor (PR #61)**: Ported layer boundary validator `tools/validate-architecture.mjs` (`pnpm validate`), enforcing `routes` -> `controller` -> `services` -> `core/infrastructure`. Core `LLMProvider` and `TaskType` interfaces extracted; `buildServer({ orchestrator })` DI added with lazy database pool.
  - **Task 1.6 (Issue #7) — Editor Context Parity (PR #62)**: Ported `is_editor_context_relevant` and `_build_editor_context_block` into TypeScript with exact Python semantics (4000-char truncation, `Selection (lines X-Y):`, dev tokens, deictic phrases, technical task suppression). Added 21 automated tests in `tests/editor-context.test.ts`.
  - **Task 1.1 (Issue #3) — Fail-Fast Startup Exit (PR #63)**: Added automated child-process startup tests in `tests/config.test.ts` asserting exit code 1 with formatted Zod error on invalid environment configuration. **Milestone 1 is now 100% complete**.
  - **Task 2.8 (Issue #17) — Next.js SSE Parser Alignment (PR #64)**: Validated live Fastify SSE output parsed directly through the Next.js frontend `sse.ts` parser logic (`tests/sse-parser.test.ts`), covering session frames, confirmation frames, token chunks, 2-byte boundary splitting, and unrecognized events. Added 5 tests.


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
| Next.js SSE parser alignment | ✅ 5 / 5 | `tests/sse-parser.test.ts` |
| **Total Test Suite** | ✅ **92 / 92 passed** | `pnpm test` (across 12 test files) |

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
* ✅ Issue #17: Test the stream against the Next.js SSE parser (PR #64)

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

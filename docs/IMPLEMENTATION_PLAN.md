# Sovereign Brain API (JavaScript/TypeScript) — Implementation Plan & Parity Tracker

> **Target Repository**: `sovereign-brain-api-js`  
> **Source Reference**: `soveriegn-brain-api-py` (Python FastAPI backend as behavioral ground truth)  
> **Stack**: Node.js (>=20), TypeScript (ES2022 / NodeNext), Fastify, Drizzle ORM, PostgreSQL with `pgvector`, Zod, Ollama, Vitest.  
> **Primary Rule**: Match Python behavior and security first. No premature features (e.g. GraphRAG) until parity is demonstrated.

---

## 1. Migration Governance & Operating Rules

1. **Three-Tier Verification Standard**:
   - `[Implemented]`: Code is written and types check cleanly (`pnpm build`).
   - `[Verified]`: Unit and integration test suites pass in TypeScript.
   - `[Parity-Verified]`: Output compared against Python reference with identical payloads.
2. **Database Migration Ownership**:
   - **Python (Alembic) is the sole owner of the database schema** until full production cutover.
   - Drizzle in TypeScript acts as a schema consumer (`drizzle-kit introspect` / schema definitions). It will **never** run independent migrations on `:5434` to prevent drift.
3. **Identity & Security Model**:
   - The Next.js BFF (`soveriegn-brain-app`) forwards `X-User-Id`, `X-Client-Type`, and `X-Correlation-Id`.
   - Fastify trusts `X-User-Id` **only after** verifying the API key (`X-API-Key` or `Authorization: Bearer <key>`), matching Python's security contract.
4. **Python Bug Rule**:
   - If a behavioral bug is discovered in Python (e.g. freshness collision on editor context labels), fix it in both or explicitly record the documented delta here so comparison tests do not flag intentional improvements as regressions.
5. **No Fake Responses (Honest Fallback)**:
   - Until Phase 4 (Tools & Agent Loop) is fully implemented, tool requests must not emit fake completion placeholders (`[AgentLoop] completed plan`). They must route honestly to the model with a clear system notice that tools are being wired, or return a structured `tools_unavailable` notice.
6. **Retrieval Staging (No Premature GraphRAG)**:
   - Baseline: Vector search with distance threshold and keyword fallback.
   - Step 2: Hybrid RAG (PostgreSQL FTS + pgvector + RRF).
   - Step 3: Local Reranker (`bge-reranker`).
   - Step 4: GraphRAG / DRIFT only when multi-document synthesis justifies indexing overhead.

---

## 2. Milestone Tracking

### Milestone 1: Hardening & Core Cognitive Routing (Phases 1 & 2 Combined)
*Goal: Secure the service, validate runtime config, port Python classifier tests word-for-word, isolate editor context, and stream real responses without fake placeholders.*

| Task | Implemented | Verified | Parity-Verified | Notes |
|---|:---:|:---:|:---:|---|
| **1.1 Strict Zod Config Validation** (`src/core/config.ts`) | [x] | [x] | [ ] | Fails fast on invalid env. API keys: union of `API_KEY`, `BRAIN_API_KEY`, `API_KEYS` (+ JS alias `ALLOWED_API_KEYS`), **no default key** — matches Python `config.py` by code review. Key handling tested in `tests/config.test.ts`; fail-fast exit not yet tested |
| **1.2 API Key Verification Middleware** (`src/core/security.ts`) | [x] | [ ] | [ ] | Constant-time comparison, ported from Python `verify_api_key`. Only the missing-key 401 is tested; Bearer, `?api_key=` and the "not configured" 500 are untested |
| **1.3 Request Context Extraction** (`src/core/context.ts`) | [x] | [ ] | [ ] | Extracts `X-User-Id`, `X-Correlation-Id`, `X-Client-Type`. No tests |
| **1.4 Exception Sanitization** (`src/core/error-handler.ts`) | [x] | [ ] | [ ] | Generic 500 body; full error logged server-side. No tests |
| **1.5 Port Python Classifier Tests Word-for-Word** (`tests/classifier.test.ts`) | [x] | [x] | [x] | Python's own test cases, ported verbatim (17 tests) — the only payload-level parity evidence so far |
| **1.6 Editor-Context Classification** | [x] | [ ] | [ ] | Classifies the message *with* the editor block attached, as Python does (`orchestrator.py:194`). Deliberately not changed (Python Bug Rule) |
| **1.7 Replace Fake Agent Completions with Honest Route** | [x] | [ ] | — | Mock `[AgentLoop]` string removed; tool tasks go to the model with a "tools not wired yet" notice. Parity N/A until Milestone 4 (Python runs real tools) |
| **1.8 Model Routing** (`src/infrastructure/ollama/router.ts`) | [x] | [ ] | [ ] | CODING/DEBUGGING → coding model, COMPLEX_TASK → `hermes3:8b`, everything else → `qwen3:8b`. Matches Python `router.py` by code review; no tests |

*Exit Condition for Milestone 1*: Invalid config exits immediately, missing API key returns 401, all classifier tests pass matching Python, and queries stream from real Ollama models with no fake placeholder text. (**Partially met**: 401, classifier parity and streaming verified — streaming only against a fake Ollama; fail-fast exit untested.)

---

### Milestone 2: Dependable Streaming & Response Lifecycle (Phase 3)
*Goal: Match Fastify streaming response lifecycle to Next.js SSE expectations, including disconnect aborts and error frames.*

| Task | Implemented | Verified | Parity-Verified | Notes |
|---|:---:|:---:|:---:|---|
| **2.1 Immediate Session Control Frame** | [x] | [x] | [ ] | `data: {"type":"session", ...}\n\n` before token generation. Tested in `tests/stream.integration.test.ts`; parity needs 2.5 |
| **2.2 Upstream Abort on Client Disconnect** | [x] | [x] | [ ] | Listens on `reply.raw` "close" — `request.raw` fires "close" once the body is read (Node ≥ 16), so it never signalled a real disconnect. Test asserts the fake Ollama stops early |
| **2.3 Stream Lifecycle & CORS** | [x] | [x] | [ ] | `reply.hijack()` + CORS plugin headers copied to the raw response (no hard-coded `*`); disallowed origins get no CORS headers instead of a 500, like Python's `CORSMiddleware`. Tested |
| **2.4 Configurable Timeout Guard** | [x] | [x] | — | `OLLAMA_REQUEST_TIMEOUT_MS` (300 s, total for `chat`/`embed`) and `OLLAMA_STREAM_IDLE_TIMEOUT_MS` (120 s, longest gap between streamed chunks incl. the first). A timeout returns the generic 500 on `/chat` and ends the stream, and the upstream request is closed. Tested in `tests/timeouts.integration.test.ts` (hang, stall, slow-but-progressing). **Deliberate difference from Python**, whose Ollama client has no timeout — parity N/A |
| **2.5 Port Golden SSE Fixtures from Python** | [ ] | [ ] | [ ] | Compare recorded Python stream lines against TypeScript |
| **2.6 Mid-Stream Failure Behavior** | [x] | [x] | [x] | Python parity verified: Python has no dedicated error frame (only `session` and `confirmation` frames; generator exception terminates connection via Starlette). TS logs error server-side and terminates the stream cleanly with whatever was flushed, tested in `tests/stream.integration.test.ts` |
| **2.7 Ollama Generation Options** | [x] | [x] | [ ] | Same as Python on both `chat` and `streamChat`: `keep_alive: 5m` and `options` = `repeat_penalty 1.15`, `repeat_last_n 64`, `temperature 0.7`, `num_ctx 8192` (`adapter.py` `_get_ollama_options()`). The three non-ctx options were missing until now. Tested against the fake Ollama; parity needs a side-by-side run |

*Exit Condition for Milestone 2*: Streams cleanly handle tokens, errors, client aborts, and match Next.js `sse.ts` parser requirements.

---

### Milestone 3: Persistent Intelligence & Baseline RAG (Phase 4)
*Goal: Connect to PostgreSQL `:5434`, map Drizzle schemas to existing tables, and restore sessions, memory, and knowledge RAG.*

| Task | Implemented | Verified | Parity-Verified | Notes |
|---|:---:|:---:|:---:|---|
| **3.1 Drizzle Schema Mirroring** (`src/db/schema/`) | [ ] | [ ] | [ ] | `sessions`, `messages`, `memories`, `documents`, `document_chunks`, `process_traces` |
| **3.2 Session & Message Persistence** | [ ] | [ ] | [ ] | Adopts client conversation ID; saves raw user/assistant messages |
| **3.3 Long-Term Memory Extraction & Search** | [ ] | [ ] | [ ] | Hybrid cosine + ILIKE with distance cutoff (`0.5`, Python `MEMORY_SEARCH_MAX_DISTANCE`) |
| **3.4 Baseline Knowledge RAG** | [ ] | [ ] | [ ] | Cosine distance search with max cutoff (`0.5`, Python `KNOWLEDGE_SEARCH_MAX_DISTANCE`) + ILIKE fallback |
| **3.5 Context Engine Prompt Assembly** | [ ] | [ ] | [ ] | Temporal anchor, memories, knowledge, tool provenance, history |

*Exit Condition for Milestone 3*: Messages and sessions persist in DB, history reloads properly, and knowledge retrieval returns identical chunk rankings to Python.

---

### Milestone 4: Agent Loop, Planner & Tool Execution (Phase 5)
*Goal: Wire Hermes multi-step planning, dual validation gates, tool registry, and confirmation pauses.*

| Task | Implemented | Verified | Parity-Verified | Notes |
|---|:---:|:---:|:---:|---|
| **4.1 Hermes Plan Generation** | [ ] | [ ] | [ ] | Structured JSON plan drafting from per-tool schemas |
| **4.2 Gate 1: Tool Compatibility Gate** | [ ] | [ ] | [ ] | Intent check (e.g. rejecting folder tool for file intent) |
| **4.3 Gate 2: Tool Argument Gate** | [ ] | [ ] | [ ] | Schema validation before dispatch |
| **4.4 Tool Registry & Workspace Safety Guard** | [ ] | [ ] | [ ] | Path traversal check, file tools, git, calculator, time |
| **4.5 Confirmation Pause & Resume API** | [ ] | [ ] | [ ] | Dangerous tool pause; `/confirmations/:id/approve` |
| **4.6 Process Track Repository & Persistence** | [ ] | [ ] | [ ] | Sanitized timeline saved to `process_traces` |

*Exit Condition for Milestone 4*: Multi-step tasks plan with Hermes, pass both gates, execute tools safely, and log truthful Process Track timelines.

---

### Milestone 5: Parity Verification & Frontend Switch (Phase 6)
*Goal: Automated side-by-side comparison harness, golden dataset validation, and Next.js frontend cutover.*

| Task | Implemented | Verified | Parity-Verified | Notes |
|---|:---:|:---:|:---:|---|
| **5.1 Golden Request/Response Harness** | [ ] | [ ] | [ ] | Automated runner sending identical payloads to Python (`:8000`) and TypeScript (`:8001`) |
| **5.2 SSE Stream Alignment Verification** | [ ] | [ ] | [ ] | Token latency, frame demuxing, error formatting |
| **5.3 Retrieval Recall & Ranking Benchmark** | [ ] | [ ] | [ ] | Assert identical chunk IDs retrieved for standard queries |
| **5.4 Next.js Frontend Live Verification** | [ ] | [ ] | [ ] | Point `soveriegn-brain-app` to TS backend with zero code changes |

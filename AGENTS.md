# Agent Guidelines & Repository Rules (`sovereign-brain-api-js`)

> This file is read automatically by Antigravity, Claude, and agentic coding tools. It is the single source of truth for repository constraints, workflows, and standards.

---

## 1. Git Workflow & Branch Safety

### Inspect Before Editing
- Before changing files, always run:
  ```bash
  git status --short --branch
  git branch --show-current
  git diff
  ```
- Check for uncommitted changes and determine whether they belong to the current task.
- Never discard, reset, clean, stash, or silently relocate existing work without explicit user consent.

### Dedicated Task Branches Are Mandatory
- Never develop directly on `main`, `master`, or a shared integration branch.
- Create or switch to a dedicated task branch using conventional naming:
  - `feat/<short-description>` — new features
  - `fix/<short-description>` — bug fixes
  - `perf/<short-description>` — performance improvements
  - `refactor/<short-description>` — refactoring
  - `docs/<short-description>` — documentation
  - `test/<short-description>` — tests
  - `chore/<short-description>` — maintenance & dependencies
- Check whether the branch exists locally or remotely before creating it. Never force-reset an existing branch.

### Staging & Commits
- Stage only intended files. Never use blanket `git add .` or `git add -A` without inspecting the staged diff (`git diff --cached`).
- Never commit `.env`, credentials, local database dumps, or build artifacts (`dist/`).
- Use Conventional Commits (`feat(auth): ...`, `fix(classifier): ...`, `test(stream): ...`).
- Only push or create pull requests when authorized.

---

## 2. Core Architecture & Migration Invariants

### Python (`soveriegn-brain-api-py`) is the Behavioral Reference
- This repo is a 1-to-1 port of the Python Sovereign Brain API into TypeScript/Node.js.
- **Do not invent new features or redesign architectures** (e.g., do not add GraphRAG or custom identity protocols) until behavioral parity with Python is proven.
- Track every task under the **Three-Tier Verification Standard**:
  - `Implemented`: Code exists and types compile cleanly (`pnpm build`).
  - `Verified`: Unit/integration tests pass in Vitest (`pnpm test`).
  - `Parity-Verified`: Output matches Python output on identical request payloads.

### Database Ownership & Drizzle Rule
- **Python (Alembic) is the sole owner of database schema migrations** on `:5434`.
- Drizzle ORM in this repository is a **schema consumer only** (`drizzle-kit introspect` / schema definitions).
- Never run independent schema migrations from Drizzle against the shared database.

### Cognitive Architecture Invariants
1. **Zero-LLM Classifier**: `classifyTaskExplained()` must remain deterministic, instant, and cheap (zero LLM calls).
2. **Model Router**:
   - `hermes3:8b`: Solely for agent planning and JSON plan construction. Never executes tools directly.
   - `qwen3:8b`: For general chat, questions, reasoning, and final answer synthesis.
3. **Immediate Session Frame**: The chat stream endpoint must emit `data: {"type": "session", "session_id": ..., "trace_id": ...}\n\n` *before* LLM token generation begins so the frontend URL updates instantly.
4. **No Fake Responses**: Tool requests must not emit placeholder completions claiming work was done. Route them honestly with a notice until the AgentLoop is fully wired.

---

## 3. Security & Boundary Standards

- **BFF Trust Boundary**: Next.js (`soveriegn-brain-app`) authenticates users and proxies requests to this service.
- **API Key Required**: All requests must be validated against `X-API-Key` or `Authorization: Bearer <key>` using constant-time comparison (`crypto.timingSafeEqual`).
- **Identity Extraction**: Only trust `X-User-Id` and `X-Correlation-Id` **after** the API key check passes.
- **Exception Sanitization**: Never leak raw internal exception details (SQLAlchemy/Drizzle errors, database IP addresses, internal paths) in 500 error responses. Return generic messages and log details server-side.

---

## 4. Verification Requirements

Before declaring any task or milestone complete, run the required verification checks:

```bash
# 1. Type check
pnpm build

# 2. Run unit and regression tests
pnpm test

# 3. Development server boot check
pnpm dev
```

Classify every check in the final completion report:
- **Passed**: Executed successfully with proof.
- **Failed**: Investigate and fix before declaring completion.
- **Skipped / Blocked**: Explicitly explain why with environment or dependency constraints.

---

## 5. Mandatory Task Completion Report

At the conclusion of every milestone or task, output the structured completion report:

- **Branch**: `<current-branch>`
- **Changes**: Summary of what was implemented or resolved.
- **Files**: Modified, created, or deleted files.
- **Verification**: Exact check results (`pnpm build`, `pnpm test`).
- **Git status**: Clean / uncommitted status and commit hash if committed.
- **Parity Status**: `Implemented` / `Verified` / `Parity-Verified`.
- **Risks & Next Steps**: Immediate follow-up tasks.

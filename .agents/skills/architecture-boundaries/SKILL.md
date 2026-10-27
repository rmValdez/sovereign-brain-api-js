---
name: architecture-boundaries
description: Keep code inside each Sovereign repo's layer boundaries and burn down known violations. Use when adding or moving files, changing imports between modules or layers, fixing an entry in a repo's architecture baseline, or when a repo's architecture check (pnpm validate / tools/validate_architecture.py) fails.
---

# Architecture Boundaries

Every Sovereign repo has layer rules. Three of the four have a checker that enforces them. This skill says which rules apply where, how to run the check, and how to clear known violations without hiding new ones.

## 1. Identify the Repo and Its Check

| Repo | Stack | Check | Rules live in |
|---|---|---|---|
| `soveriegn-brain-api-py` | Python 3.13 / FastAPI / uv | `uv run python tools/validate_architecture.py` (also runs in CI) | `AGENTS.md` §2, `tools/architecture_baseline.txt` |
| `sovereign-brain-api-js` | TypeScript / Fastify / pnpm | `pnpm validate` | `AGENTS.md` §2 "Layer Boundaries" |
| `soveriegn-brain-app` | Next.js App Router / pnpm | `pnpm validate` | `.agents/rules/architecture.md` |
| `sovereign-brain-extension` | VS Code extension / npm | none yet (4 files; covered by review) | `AGENTS.md` §2 |

Run the check **before** you change anything, so you know what was already failing, and again after.

## 2. The Rules, by Stack

**Backends (Python and JS), lowest layer first:**

- `core/`, `infrastructure/`: shared plumbing (config, DB, security, LLM adapter). They may **not** import anything from `modules/`.
- repository: DB access only. It may not import a service, controller, or router.
- service: business logic. It may not import a controller or router.
- controller (JS only): parses the request, calls a service, shapes the response. It may not import routes or repositories.
- router / routes: HTTP wiring and guards. In Python, only `app/main.py` may import a router.
- Python: modules may not import each other in a cycle.
- File naming: Python uses `repository.py`, `service.py`, `router.py` inside `app/modules/<feature>/`. JS puts the layer in the file name: `chat.controller.ts`, `orchestrator.service.ts`.

When two modules need the same thing, such as an interface (`LLMProvider`), an enum (`TaskType`), or an auth helper, move it **down** into `core/`. Never import it sideways from another module.

**Next.js app (FAOS):** `app/` composes pages only. A `features/<x>` may not import another feature. `shared/` may not import `features/` or `app/`. Every feature that calls the backend needs a Zod contract in `features/<x>/contracts/`.

**Extension:** only `api.ts` calls `fetch`. `context.ts` and `api.ts` never import `chat.ts` or `extension.ts`.

## 3. Adding New Code

1. Decide the layer first, then name the file after it.
2. Import only downward. If you need something from a sibling module, move the shared piece into `core/` (backend) or `shared/` (app).
3. Pass dependencies in through constructor arguments, `buildServer({ ... })` in JS, or FastAPI `Depends` in Python. Don't create singletons at module level.
4. Run the check. A new violation is a design problem to fix, not something to work around.

## 4. Clearing a Baseline Violation (Python)

`tools/architecture_baseline.txt` lists violations that existed when the checker was added. It is debt to burn down, not a list of exemptions.

1. Branch from the latest `staging` (see `github-pr-workflow`). Use one branch per fix, e.g. `refactor/llm-provider-to-core`.
2. Run the check and pick related lines. One move often clears several lines; moving `brain/interfaces.py` to `core/`, for example, clears an infrastructure line and several cycle lines.
3. Make the fix. Moving code is preferred to rewriting it. Keep a re-export at the old location only if many callers depend on it, and remove it in the same PR if you can.
4. Run the check. It prints `[FIXED] <line>` for each cleared entry and **fails until you delete those lines** from the baseline. Delete exactly the lines it names.
5. Run the repo's full checklist (`ruff check`, `pytest`), not just the architecture check. Moved code breaks imports and `patch()` / `mock` target strings: search the tests for the old dotted path.
6. In the PR, list which baseline lines were removed.

**Never** add a line to the baseline to make a check pass. If a change cannot avoid a new violation, stop and ask the owner. The fix belongs in the design, or in an ADR.

## 5. Changing a Checker

- Checkers only resolve relative imports (JS) or `app.*` imports (Python). Path aliases make imports invisible to them, which is why the JS checker refuses to run if `tsconfig.json` has `paths`.
- After changing a rule, prove it works: temporarily add a known-bad import, confirm the check fails, then revert.
- Keep the rule table in the repo's AGENTS.md in sync with the checker.

## 6. Report

In the completion report, include the architecture check result, and for baseline work list the lines removed and how many remain. Example: `validate_architecture: passed, baseline 12 → 9`.

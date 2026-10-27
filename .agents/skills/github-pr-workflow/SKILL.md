---
name: github-pr-workflow
description: Follow a safe, consistent Git and GitHub Pull Request workflow for every coding task, including branch management, commits, verification, pushing, PR creation, and completion reporting. Use whenever implementing repository changes or preparing, updating, reviewing, or merging a pull request.
---

# GitHub Pull Request Workflow

## 1. Core Principles

- Preserve existing work. Never discard, overwrite, reset, clean, or silently relocate changes.
- Work on dedicated task branches. Never implement changes directly on `main`, `master`, or a protected/shared integration branch.
- Keep pull requests focused, reviewable, and limited to the requested scope.
- Verify changes before claiming they work.
- Never fabricate test results, commit hashes, PR URLs, review approvals, or merge status.
- Do not expose secrets, credentials, tokens, private keys, environment files, or sensitive user data in commits, logs, or PR descriptions.
- Do not merge, force-push, delete branches, or modify repository settings without explicit authorization.
- Follow the repository's existing instructions, branch protections, CI requirements, and contribution conventions. These take precedence over generic workflow preferences where they do not conflict with safety requirements.

## 2. Inspect Before Editing

Before changing files, inspect:

1. `git status --short --branch`
2. `git branch --show-current`
3. `git diff`
4. `git diff --cached`
5. Recent commit history with `git log -5 --oneline`
6. Applicable repository instructions, such as `AGENTS.md`, `CONTRIBUTING.md`, `.github/`, and existing project-specific agent skills.

Determine:

- The current branch and its upstream, if any.
- Whether the working tree contains uncommitted or staged changes.
- Whether those changes belong to the requested task.
- The base branch used for integration.
- Required tests, linting, type checks, builds, and formatting.
- Whether the task depends on external services, credentials, or environment configuration.

Do not assume `main` is the base branch. Verify the repository's actual conventions.

### Existing changes

- Preserve unrelated modifications and untracked files.
- Do not automatically commit, stash, reset, clean, or amend existing work.
- If task changes overlap with existing modifications, inspect carefully and ask for clarification if ownership or intent is uncertain.
- Do not stage the entire repository with `git add .` or `git add -A` without first understanding every affected file.
- Stage only the intended files and inspect the staged diff before committing.

## 3. Create or Select a Task Branch

Use a descriptive branch name:

- `feat/<description>` — feature
- `fix/<description>` — bug fix
- `perf/<description>` — performance improvement
- `refactor/<description>` — refactoring
- `docs/<description>` — documentation
- `test/<description>` — tests
- `chore/<description>` — maintenance and tooling

Before creating a branch:

1. Check whether the intended branch already exists locally or remotely.
2. Inspect its status, commits, and relationship to the intended base.
3. Determine whether existing uncommitted work can safely remain associated with the task.
4. Never reset or overwrite an existing branch to make it match the expected starting point.

If the current branch is a protected or shared branch, switch to a dedicated task branch using a safe workflow that preserves existing work. If switching could carry unrelated changes or cause conflicts, stop and resolve the ambiguity before proceeding.

Report the branch used in the final summary.

## 4. Plan the Change

Before implementation:

- Identify the expected behavior and acceptance criteria.
- Inspect relevant existing code and tests.
- Identify likely affected files, interfaces, database schemas, API contracts, and dependencies.
- Prefer the smallest complete solution over unnecessary abstractions or unrelated refactors.
- Identify security, data migration, compatibility, and rollback implications.
- Determine which verification commands are appropriate for the scope.

For larger tasks, divide the work into small, reviewable milestones. Do not silently expand the task.

## 5. Implement and Review Locally

During implementation:

- Follow existing architecture, naming conventions, formatting, and error-handling patterns.
- Update tests and documentation when behavior or public interfaces change.
- Avoid unrelated formatting changes, generated-file churn, and unnecessary dependency updates.
- Do not weaken tests, remove safeguards, or suppress errors simply to obtain a passing result.
- Do not commit credentials, local databases, build artifacts, or machine-specific configuration.
- Respect repository-specific rules for authentication, authorization, caching, database migrations, and framework versions.

Before committing, inspect:

```bash
git status --short
git diff --check
git diff
```

After staging, inspect the exact staged changes:

```bash
git diff --cached --check
git diff --cached
```

Verify that the staged changes contain only the intended task. Pay particular attention to `.env` files, credentials, generated files, lockfiles, migrations, and unrelated user changes.

## 6. Verification Requirements

Run the project's prescribed checks. Prefer existing package scripts and documented commands over inventing new ones.

Select checks according to the change:

- Formatting and whitespace checks.
- Linting and static analysis.
- Type checking or compilation.
- Unit and integration tests.
- Architecture or dependency-boundary validation.
- Production build.
- API contract and frontend integration tests.
- Database migration and schema checks where applicable.
- Security-sensitive tests for authentication, authorization, file access, and tool execution.

For substantial changes, run all mandatory project checks. For localized changes, run the relevant targeted checks and document what was not run.

Classify each check accurately:

- **Passed:** Executed successfully.
- **Failed — Changes:** Failed because of the current changes; investigate and fix before declaring readiness.
- **Pre-existing Failure:** Demonstrably unrelated to the current changes.
- **Skipped:** Intentionally not run, with a reason.
- **Blocked:** Could not run because of an environment, permission, credential, or external-service limitation.

Do not label an unknown failure as pre-existing without evidence. Do not claim a build or test passed based solely on code inspection.

If a check fails, inspect the failure before deciding whether to fix it, report it, or request help. Do not conceal failures.

## 7. Commit Standards

Use clear, action-oriented commit messages. Follow the repository's established commit conventions where present.

Preferred Conventional Commit examples:

- `feat(auth): add session validation`
- `fix(retrieval): correct freshness-based routing`
- `test(knowledge): cover vector search fallback`
- `docs(workflow): document pull request process`
- `refactor(api): isolate request validation`

Guidelines:

- One commit should represent a coherent change.
- Avoid vague messages such as `updates`, `fix`, `changes`, or `work`.
- Do not include unrelated files or changes in a commit.
- Never amend or rewrite an existing commit unless explicitly authorized.
- Do not commit unless the task or project workflow authorizes committing. If authorization is unclear, prepare the changes and report that the commit remains pending.

After a commit, verify its contents and inspect the resulting working-tree status.

## 8. Push Safely

Before pushing:

1. Confirm the branch name and remote.
2. Inspect the commits that will be pushed.
3. Check whether the remote branch already exists and whether it contains work not present locally.
4. Verify that no unrelated commits or sensitive files are included.
5. Confirm that pushing is authorized by the user or established workflow.

Use a normal push when safe. Never force-push, force-update a shared branch, or overwrite remote work without explicit authorization.

If the remote has diverged, inspect the history and resolve the situation safely. Do not automatically reset the local or remote branch.

A successful local commit does not prove that a push succeeded. Report the actual result.

## 9. Create a Professional Pull Request

Only create or update a PR when explicitly requested or authorized by the repository's established workflow.

Before creating it:

- Confirm the source branch and intended base branch.
- Review the complete change set against the base, not just the latest commit.
- Confirm the branch has been pushed.
- Run the required checks, or clearly disclose remaining checks.
- Ensure the PR does not include unrelated changes or secrets.
- Check for an existing PR for the same branch before opening a duplicate.

Use the repository's PR template if one exists. Otherwise, use this structure:

### Title

Use a concise, specific title that describes the outcome.

Examples:

- `fix(knowledge): correct freshness-based task routing`
- `feat(memory): persist long-term memory entries`
- `docs: add GitHub pull request workflow skill`

### Description

**Summary**
- Explain what changed.
- Explain why the change is needed.

**Implementation**
- Describe the important technical decisions.
- Identify API, schema, configuration, or dependency changes.

**Verification**
- List checks that actually ran and their results.
- Identify failures, skipped checks, and blockers.

**Risk and compatibility**
- Describe behavior changes, migration requirements, security implications, and rollback considerations where relevant.

**Related work**
- Link related issues or PRs only when the relationship is verified.
- Reference issue numbers only when they are known.

The PR description must be factual, concise, and useful to a reviewer. Do not claim that a bug is fixed unless evidence supports that claim.

If screenshots, API examples, or test evidence are useful, include them when available. Never invent evidence.

After opening the PR, verify its actual title, base, source branch, URL, and reported status. Report the verified URL rather than guessing it.

## 10. Respond to Review Feedback

When addressing review comments:

1. Read the full comment and relevant code.
2. Determine whether the requested change is correct and consistent with project requirements.
3. Make the smallest appropriate change.
4. Add or update tests when necessary.
5. Run the affected checks.
6. Push the update only when authorized.
7. Reply to the review comment accurately, summarizing the change or explaining a justified disagreement.

Do not dismiss review feedback without analysis. Do not claim a comment has been resolved until the corresponding change has been verified.

Do not approve your own PR or bypass required reviewers, CI checks, branch protections, or other repository controls.

## 11. Merge and Cleanup Rules

- Opening a PR does not authorize merging it.
- Do not merge unless explicitly authorized or permitted by a clearly established workflow.
- Do not bypass required approvals or failing required checks.
- Do not delete local or remote branches, even after merge, unless explicitly instructed.
- Preserve commit history and recovery options.
- If a migration or release requires additional deployment steps, state them clearly.

## 12. Mandatory Completion Report

At the end of every task, provide a concise, factual report.

**Branch:** Branch used.

**Changes:** What was implemented or fixed.

**Files:** Key files created, modified, or removed.

**Verification:** Each relevant check and its exact status.

**Git status:** Commit hash if committed, push status if attempted, and whether the working tree is clean or still contains changes.

**Pull request:** Verified URL and status if created; otherwise state that it was not created.

**Risks and remaining work:** Known issues, skipped checks, blockers, migrations, and follow-up tasks.

Never state that a task, commit, push, or PR is complete unless the corresponding operation actually succeeded. Distinguish clearly between local changes, committed changes, pushed changes, and a created or merged PR.

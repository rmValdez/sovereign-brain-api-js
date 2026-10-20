# Claude & Antigravity Instructions — `sovereign-brain-api-js`

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Run development server on port 8001 (tsx watch)
pnpm build            # Compile TypeScript to dist/ (tsc)
pnpm start            # Run compiled server (node dist/index.js)
pnpm test             # Run Vitest test suites
pnpm test:watch       # Run Vitest in watch mode
```

## Architectural Guidelines

- **Port & API**: Runs on port `8001` (Python keeps `3009`). Endpoints must strictly match `soveriegn-brain-api-py` (`/api/v1/chat`, `/api/v1/chat/stream`, `/health`, etc.).
- **Reference Standard**: Python (`soveriegn-brain-api-py`) is the ground truth. Never introduce new ungrounded features (e.g. GraphRAG) until full parity is demonstrated.
- **Drizzle Database Rule**: Python (Alembic) owns all schema migrations on port `5434`. Drizzle in this repo is a schema consumer only.
- **Model Allocation**:
  - `hermes3:8b`: Structured agent planning only.
  - `qwen3:8b`: Conversational reasoning and synthesis.
- **Classifier Rule**: `classifyTaskExplained()` is zero-LLM, instant, and deterministic. Never introduce model latency into request classification.
- **Security Rule**: API key verification (`X-API-Key`) is mandatory. Sanitize all 500 error responses so internal DB connection strings or IPs are never leaked.

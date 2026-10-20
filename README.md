# sovereign-brain-api-js

TypeScript / Node.js implementation of the **Sovereign Brain Cognitive Orchestrator API**, ported directly from `soveriegn-brain-api-py`.

## Tech Stack
- **Runtime**: Node.js (>= 20) with TypeScript (ES2022 / NodeNext)
- **HTTP Server**: [Fastify](https://fastify.dev/) (High performance, native streaming)
- **Validation**: [Zod](https://zod.dev/)
- **Database**: PostgreSQL with `pgvector`
- **Local AI**: [Ollama](https://ollama.com/) (`qwen3:8b`, `hermes3:8b`, `nomic-embed-text`)
- **Testing**: [Vitest](https://vitest.dev/)

## Project Structure
```text
sovereign-brain-api-js/
├── src/
│   ├── core/                  # Configuration, database pool, request context
│   │   ├── config.ts
│   │   ├── context.ts
│   │   └── database.ts
│   ├── infrastructure/
│   │   └── ollama/            # Ollama client & task-based model router
│   │       ├── adapter.ts
│   │       └── router.ts
│   ├── modules/
│   │   ├── brain/             # Orchestrator, Zero-LLM Classifier, ProcessTrack
│   │   │   ├── classifier.ts
│   │   │   ├── context.ts
│   │   │   ├── orchestrator.ts
│   │   │   ├── process-track.ts
│   │   │   └── temporal.ts
│   │   └── chat/              # Chat API routes & Zod request/response schemas
│   │       ├── routes.ts
│   │       └── schemas.ts
│   └── index.ts               # Fastify server entry point
├── tests/                     # Unit & integration tests
├── .env.example
├── package.json
└── tsconfig.json
```

## Getting Started

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
pnpm dev
```
The server will start on `http://localhost:8001`. The Python backend keeps `:3009`, so both can run side by side; point `soveriegn-brain-app`'s `FASTAPI_INTERNAL_URL` at `:8001` to use this one.

### 4. Run Tests
```bash
pnpm test
```

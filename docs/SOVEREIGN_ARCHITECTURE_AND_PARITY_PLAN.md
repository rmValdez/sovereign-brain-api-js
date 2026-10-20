# Sovereign Architecture and Backend Parity Plan

## 1. Objective

Maintain one frontend and two independently implemented backends during the evaluation phase:

- **Python backend:** The existing FastAPI implementation and reference baseline.
- **TypeScript backend:** The new implementation, which must achieve functional parity with Python.
- **Frontend:** One Next.js application that can switch between backends through environment configuration.
- **Evaluation:** A repeatable test suite that compares correctness, behavior, reliability, and performance.

The goal is to determine whether the TypeScript backend can reliably replace the Python implementation without introducing unrelated architectural changes.

---

## 2. Database and Infrastructure Architecture

### PostgreSQL + pgvector — Primary Database

Keep PostgreSQL with `pgvector` as the shared database technology for both implementations during the parity phase.

It remains the authoritative store for structured application data, conversation history, sessions, memories, documents, and embeddings (768-dimension `nomic-embed-text` vectors in `memories` and `document_chunks`). The current schema has no knowledge-graph tables.

The TypeScript backend must use the same database schema and migration definitions as Python. Alembic remains the migration authority.

Do not migrate vector storage to another service during the initial comparison.

### Redis — Existing Frontend Infrastructure

Redis is currently used by the Next.js application for login rate limiting. Do not introduce Redis into the TypeScript backend simply for parity. Add backend Redis functionality only if a separately justified requirement emerges.

### Optional Future Infrastructure

- **Qdrant:** Evaluate as an alternative vector engine only after pgvector retrieval has been matched and benchmarked.
- **Neo4j:** No graph storage exists today, so graph retrieval is new work whichever store is used. Evaluate it when multi-hop questions justify it, comparing PostgreSQL graph tables against Neo4j.
- **GraphRAG:** Consider as a future retrieval approach after the baseline retrieval pipeline is verified. It is not a database and does not require Neo4j in every implementation.

---

## 3. Fair Comparison and Data Isolation

Both backends must use equivalent database schemas, migrations, seed data, embedding models, model versions, prompts, generation parameters, and test inputs.

For repeatable comparison runs:

1. Create separate Python and TypeScript test databases from the same migration version.
2. Seed both databases with equivalent datasets.
3. Ensure each backend writes only to its assigned database during evaluation.
4. Prevent conversation history, memories, documents, or generated embeddings from leaking between test environments.
5. Reset or reseed test data when necessary to ensure reproducibility.

Use a common database schema and migration authority, but separate writable test environments. Do not let both backends modify the same comparison dataset.

---

## 4. Frontend and Backend Selection

Keep the existing Next.js frontend. Backend selection should be configuration-driven, without duplicating frontend implementations.

Introduce a neutral backend URL variable such as `BRAIN_API_URL`, retaining the existing `FASTAPI_INTERNAL_URL` as a compatibility alias during migration if necessary.

Example configuration:

- **Python**: `BRAIN_API_URL=http://localhost:3009`
- **TypeScript**: `BRAIN_API_URL=http://localhost:8001`

These are each repository's defaults (Python: `docker-compose.yml` and `uvicorn --port 3009`; TypeScript: `PORT` in `.env`). They must differ so both backends can run side by side.

For direct comparisons, create a separate evaluation script that submits identical requests to both APIs. This is more repeatable than adding comparison logic to the frontend.

---

## 5. Implementation Roadmap

### Phase 1 — Record the Existing Python Baseline
The initial audit has already covered areas including authentication, CORS, routing, classification, and configuration. Record the verified findings rather than repeating the audit from scratch.

Document the existing behavior for:
- API endpoints and request/response contracts
- Authentication and authorization
- Chat orchestration and model configuration
- Session and conversation persistence
- Memory and knowledge retrieval
- Document processing
- Tool execution and agent workflows
- Streaming, cancellation, and error handling
- Database schema and migrations

### Phase 2 — Complete TypeScript Functional Parity
Replace placeholders and implement the missing behavior needed to match the Python baseline.

Explicitly track these known issues:
- Client-disconnect handling for streamed responses
- Correct CORS headers on streaming routes
- Correct error responses for blocked origins
- Removal of the insecure `changeme` default API key
- Consistent handling of `API_KEYS` and `BRAIN_API_KEY`
- API key enforcement and configuration validation
- Session, conversation, memory, and document persistence
- Removal of fake agent and tool responses
- Reliable streaming errors, cancellation, and timeouts
- Consistent model generation parameters, including Python's `num_ctx: 8192` and `keep_alive` settings

### Phase 3 — Verify Database and Infrastructure Compatibility
Confirm that both implementations work against the same schema and equivalent datasets.

Validate:
- Schema and migration compatibility
- Distance calculations (dimensions are fixed at 768 by the shared schema)
- Embedding generation and storage
- Conversation and memory persistence
- Update and deletion behavior
- Authentication and data access boundaries
- Recovery from failed requests and interrupted streams

*Do not add Qdrant, Neo4j, or new backend Redis dependencies during this phase.*

### Phase 4 — Establish Automated Parity Tests
Create a shared evaluation suite that calls both backends directly.

Use the same prompts, model settings, test data, and expected behavior. Compare:
- Response content and correctness
- API status codes and response schemas
- Streaming events and completion behavior
- Database side effects
- Conversation and memory behavior
- Error handling and security
- Latency and resource consumption

Run sequential tests first to reduce GPU contention, then conduct separate concurrent-load tests.

### Phase 5 — Make the Backend Decision
After the TypeScript implementation reaches verified parity, decide whether to:
1. **Replace Python with TypeScript** and retire the Python backend after a controlled transition; or
2. **Keep both backends** for a clearly documented reason, such as separate workloads, research, or continued experimentation.

Do not maintain two production implementations indefinitely without an explicit purpose, ownership plan, and maintenance budget.

### Phase 6 — Evaluate Retrieval and Graph Improvements
Only after baseline parity has been established:
1. Improve the existing pgvector semantic retrieval and PostgreSQL keyword-search fallback.
2. Evaluate hybrid retrieval using vector search and full-text search, with Reciprocal Rank Fusion (RRF) where appropriate.
3. Benchmark retrieval quality and latency against the current implementation.
4. Evaluate Qdrant as an alternative vector store if measurements justify it.
5. Evaluate GraphRAG and Neo4j only when graph-based retrieval offers measurable benefits.

Measure each architectural change independently so that performance or answer-quality improvements can be attributed to the correct cause.

---

## 6. Completion Status

Track each feature with three separate statuses:
- **Implemented:** The code exists.
- **Verified:** The feature passes its own tests.
- **Parity Verified:** The feature behaves equivalently to the Python baseline.

*Compilation, type-checking, or a successful HTTP response alone does not establish parity.*

---

## Final Direction

The immediate priority is not adding more databases or redesigning retrieval. It is making the TypeScript backend a secure, reliable, and behaviorally equivalent implementation of the existing Python backend.

Maintain one frontend, two independent implementations during evaluation, PostgreSQL + pgvector as the baseline, isolated comparison databases, and a shared automated test suite.

After parity is demonstrated, choose the long-term backend strategy and evaluate Qdrant, hybrid retrieval, GraphRAG, or Neo4j as independent improvements backed by measurable results.

# Sovereign Brain — AI Retrieval Architecture & Strategy

> **Status:** Architectural Reference & Roadmap Specification  
> **Canonical Document:** [project-sovereign/docs/AI_RETRIEVAL_ARCHITECTURE.md](file:///c:/Users/My%20PC/Documents/Github/personal/project-sovereign/docs/AI_RETRIEVAL_ARCHITECTURE.md)  
> **Last Updated:** October 2026  

See the canonical specification at [docs/AI_RETRIEVAL_ARCHITECTURE.md](file:///c:/Users/My%20PC/Documents/Github/personal/project-sovereign/docs/AI_RETRIEVAL_ARCHITECTURE.md) in the project root.

---

## Quick Summary for `sovereign-brain-api-js`

* **Milestone 3 (Current Baseline):**
  * Drizzle read-only client targeting `:5434` PostgreSQL.
  * `pgvector` semantic retrieval (`knowledge_retriever.ts`) + keyword fallback.
  * Scoped metadata filtering (`project_id`, `user_id`, `session_id`).
  * Explicit preference extraction into `memories`.

* **Milestone 4/5 (RRF & Reranking):**
  * Reciprocal Rank Fusion (RRF) combining `pgvector` with PostgreSQL `tsvector` full-text search.
  * Local cross-encoder reranker for high-precision top-5 chunk selection.

* **Graph Retrieval vs GraphRAG:**
  * **Graph Retrieval:** Deterministic multi-repo dependency traversal using PostgreSQL `WITH RECURSIVE` queries over an `entity_relations` adjacency table.
  * **GraphRAG:** LLM-generated community summaries and multi-hop global search over connected documents.

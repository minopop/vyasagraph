# VyasaGraph — Architecture Documentation

**Status:** Production-ready  
**Database:** SurrealDB embedded (RocksDB engine)  
**Purpose:** Persistent knowledge graph + semantic memory for AI agents

---

## What VyasaGraph IS

**A production knowledge graph database** that:
- Stores entities (people, places, organizations, concepts) with observations
- Links entities via typed relations (works_at, reports_to, owns, etc.)
- Supports semantic vector search (1536-dimension embeddings)
- Provides full ACID transactions
- Runs embedded (no external server needed)
- Persists to local RocksDB file

**Built to replace `@modelcontextprotocol/server-memory`** with:
- ✅ Faster queries (native SurrealDB vs. JSON file)
- ✅ True graph operations (traverse relations natively)
- ✅ Vector search with HNSW index
- ✅ Better transaction safety (ACID compliance)
- ✅ Scalable (handles 1000s of entities without slowdown)

---

## What VyasaGraph IS NOT

**Not a general-purpose database** — It is specialized for:
- Knowledge graph operations (entity-relation modeling)
- Memory/context storage for AI agents
- Semantic search over structured data

**NOT suitable for:**
- ❌ Transactional business data (use PostgreSQL)
- ❌ Time-series data (use InfluxDB)
- ❌ Document storage (use MongoDB)
- ❌ Full-text search over unstructured docs (use Elasticsearch)

---

## Two-Layer Memory Architecture

VyasaGraph is the **long-term memory layer** (hard drive). For a complete agent memory system, pair it with a **SESSION-STATE file** (RAM layer).

```
┌─────────────────────────────────────────────────────────┐
│                   AGENT MEMORY STACK                    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │           SESSION-STATE.md  (RAM)               │    │
│  │  • Current conversation context                 │    │
│  │  • Hot decisions and pending tasks              │    │
│  │  • Survives context compaction                  │    │
│  │  • Written BEFORE responding                    │    │
│  │  • Cleared at session end                       │    │
│  └─────────────────────────────────────────────────┘    │
│                        ↕ sync                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │           VyasaGraph (Hard Drive)               │    │
│  │  • Permanent entity + relation storage          │    │
│  │  • Semantic vector search                       │    │
│  │  • Cross-session knowledge                      │    │
│  │  • Project + task management (v3)               │    │
│  │  • Error tracking (v4 verrors)                  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Why two layers?**
- VyasaGraph queries take ~100ms. SESSION-STATE reads are instant.
- Context compaction silently drops tool outputs. SESSION-STATE is a plain file — always readable.
- Different write patterns: SESSION-STATE = write-ahead log; VyasaGraph = permanent record.

See `SESSION-STATE-TEMPLATE.md` and `INSTALL.md` for setup.

---

## File Structure

```
vyasagraph/
├── src/
│   ├── index.js            # Main API exports
│   ├── db.js               # SurrealDB connection & schema
│   ├── entities.js         # Entity CRUD operations
│   ├── relations.js        # Relation CRUD operations
│   ├── search.js           # Vector + text search
│   ├── smart-search.js     # Combined semantic search
│   ├── embeddings.js       # OpenAI embedding generation
│   ├── regenerate.js       # Embedding regeneration utilities
│   ├── project-queries.js  # Project/task management (v3)
│   ├── verrors.js          # Error tracking (v4)
│   └── cli.js              # CLI interface
├── tests/
│   ├── test-basic.js       # CRUD tests
│   └── test-vector.js      # Vector search tests
├── SESSION-STATE-TEMPLATE.md  # Copy to workspace root
├── INSTALL.md              # Setup guide for new agents
├── ARCHITECTURE.md         # This file
├── README.md               # User documentation
└── package.json
```

---

## Technology Stack

**Core Database:**
- **SurrealDB** — Modern graph database
  - Embedded mode (no server process)
  - RocksDB storage engine
  - Native graph relations (`->relates_to->`)
  - Vector search with HNSW index

**Dependencies:**
```json
{
  "surrealdb": "^2.0.1",
  "@surrealdb/node": "^3.0.2",
  "openai": "^4.x"
}
```

---

## Database Schema

### Entity Table

```sql
DEFINE TABLE entity SCHEMALESS;
DEFINE FIELD name ON entity TYPE string;
DEFINE FIELD entityType ON entity TYPE string DEFAULT 'unknown';
DEFINE FIELD observations ON entity TYPE array DEFAULT [];
DEFINE FIELD embedding ON entity TYPE option<array<float>>;
DEFINE FIELD createdAt ON entity TYPE datetime DEFAULT time::now();
DEFINE FIELD updatedAt ON entity TYPE datetime DEFAULT time::now();
DEFINE INDEX entity_name ON entity FIELDS name UNIQUE;
DEFINE INDEX entity_vector ON entity FIELDS embedding HNSW DIMENSION 1536 DIST COSINE;
```

**Fields:**
- `name` (string, unique): Entity identifier
- `entityType` (string): Category (Person, Project, Document, etc.)
- `observations` (array<string>): Facts about the entity
- `embedding` (array<float>, optional): 1536-dim vector for semantic search
- `metadata` (object, optional): Structured data for projects/tasks/errors

### Relation Table

```sql
DEFINE TABLE relates_to SCHEMAFULL TYPE RELATION;
DEFINE FIELD relationType ON relates_to TYPE string DEFAULT 'related_to';
DEFINE FIELD createdAt ON relates_to TYPE datetime DEFAULT time::now();
```

---

## API Reference

See `README.md` for full API documentation with examples.

Key exports from `src/index.js`:
- `init(dbPath)` / `close()` — connection management
- `createEntities()` / `addObservations()` / `updateEntity()` / `deleteEntities()` — entity CRUD
- `createRelations()` / `deleteRelations()` / `getRelations()` — graph edges
- `smartSearch(query, limit)` — **primary search method** (vector + name boosting)
- `searchText(query, limit)` — text fallback search
- `searchProjects(filters)` / `formatAsVtasks()` — project management (v3)
- `createVerror()` / `resolveVerror()` / `getUnresolvedVerrors()` — error tracking (v4)
- `getStats()` — entity and relation counts

---

## Naming Conventions

### Entity Names
```
[Primary Name] ([aliases, relationships, context])
```

Examples:
- Person: `Alice Johnson (Alice, Head of Engineering, reports to Bob)`
- Project: `Project Atlas (owner: Alice, active)`
- Document: `Q1 Strategy (authored by Alice, 2025-Q1)`

### Entity Types
Always specify `entityType`:
- `Person` — individuals
- `Project` — tracked work
- `Document` — written artefacts
- `Analysis` — analytical outputs
- `Communication` — messages, threads
- `Error` — verrors (auto-managed)

---

## Embedding System

**Coverage goal:** 100% of entities should have embeddings.

- `createEntities()` — auto-generates embeddings if `OPENAI_API_KEY` set
- `addObservations()` — does NOT regenerate (for speed)
- `addObservationsWithRegeneration()` — regenerates after adding
- `regenerateAllEmbeddings()` — full rebuild (use weekly or monthly)

**Why embeddings matter:**
- Text search: finds exact keywords
- Vector search: finds semantic meaning ("competition" → finds rivals, strategies, market analysis)

---

## verrors — Error Tracking (v4)

Errors are stored as entities in VyasaGraph (entityType: `Error`).

```javascript
await vg.createVerror({
  subsystem: 'cron_daily_summary',
  errorType: 'timeout',
  errorMessage: 'Daily summary timed out after 30s',
  impact: 'Morning briefing not sent'
});
```

Entity name format: `ERR-{id} ({subsystem} {type}, {date})`

Passive enforcement: call `detectAndLogError(toolResult)` after tool calls to auto-log failures.

---

## Performance

| Operation | Typical time |
|-----------|-------------|
| Entity lookup by name | <5ms |
| Text search | ~20ms |
| Vector search (top 10) | ~100ms |
| Entity creation (with embedding) | ~500ms (API call) |
| Entity creation (no embedding) | <10ms |
| Full graph export | ~200ms |

Scales to ~10,000 entities without tuning.

---

## Error Handling

**Connection failed:** Use `rocksdb://filename.db` format (not `surrealkv://`)

**Duplicate entity:** Use `updateEntity()` or `addObservations()` instead of `createEntities()`

**Embedding failed:** Set `OPENAI_API_KEY` or use text search only

**Slow queries (>1s):** Rebuild indexes:
```javascript
await db.query('REBUILD INDEX entity_name ON TABLE entity');
await db.query('REBUILD INDEX entity_vector ON TABLE entity');
```

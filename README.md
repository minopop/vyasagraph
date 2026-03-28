# VyasaGraph

Most AI agents are amnesiac by design — every conversation starts from zero. VyasaGraph changes that. It's an embedded knowledge graph that lets your agent remember people, decisions, and relationships, then find them later by *meaning* — not just keywords. No server to run, no infrastructure to maintain. Just drop it in and your agent goes from stateless to genuinely context-aware. **Because memory is what separates a tool from a colleague.**

---

## 🧠 Dual-Layer Memory System

VyasaGraph gives your agent two layers of memory working together:

**1. RAM Layer (SESSION-STATE)**
- Holds *hot, in-flight context*: what's happening right now, decisions made this session, things to remember before the next compaction
- Survives context window resets (compaction) because it's a file, not just tokens
- Think of it as a *write-ahead log* — the agent writes to it continuously so nothing is lost mid-session

**2. Hard Drive Layer (VyasaGraph)**
- An *embedded SurrealDB database* (no server needed — it's a local file)
- Stores *permanent knowledge*: entities, relations between them, past decisions, errors, project state
- Query it with natural language and it finds all relevant memories — full native semantic search

VyasaGraph does this all automatically. No need to tell it to do anything memory-related.

---

VyasaGraph gives your AI agent a persistent, queryable memory — entities, relationships, and vector search — with no external server required. Built on [SurrealDB](https://surrealdb.com/) with RocksDB storage and OpenAI embeddings.

---

## Why Two Layers?

| | SESSION-STATE | VyasaGraph |
|---|---|---|
| **Speed** | Instant (file read) | ~5–100ms |
| **Scope** | Current session | All sessions |
| **Purpose** | Hot context, write-ahead log | Permanent knowledge |
| **Survives compaction?** | ✅ Yes (plain file) | ✅ Yes |
| **Semantic search?** | ❌ No | ✅ Yes (HNSW vectors) |
| **Best for** | Pending tasks, decisions in flight | People, projects, history |

---

## Features

- **Multi-model database**: Graph + Document + Vector in one embedded engine
- **Semantic search**: HNSW-indexed 1536-dim embeddings (cosine similarity)
- **Graph relations**: Native SurrealDB graph edges with traversal
- **Project management**: Built-in task board with status tracking (v3)
- **Error tracking**: Verrors system for pattern detection (v4)
- **Zero infrastructure**: Embedded SurrealKV/RocksDB, no server needed
- **MCP-compatible API**: Drop-in replacement for MCP memory operations

---

## Quick Start

```bash
npm install vyasagraph
```

```javascript
import * as vg from 'vyasagraph/src/index.js';

// Initialize
await vg.init('memory.db');

// Store knowledge
await vg.createEntities([{
  name: 'Alice (user)',
  entityType: 'Person',
  observations: ['Software engineer', 'Based in Berlin', 'Prefers concise answers']
}]);

// Create relationships
await vg.createRelations([{
  from: 'Alice (user)',
  to: 'Acme Corp',
  relationType: 'works_at'
}]);

// Search semantically
const results = await vg.smartSearch('software engineering Berlin', 5);

// Always close
await vg.close();
```

---

## Installation & Setup

See **[INSTALL.md](./INSTALL.md)** for the full setup guide, including:
- How to wire SESSION-STATE into your agent's instruction files
- What to add to SOUL.md / MEMORY.md / CLAUDE.md
- First-run verification steps

---

## API Reference

### Connection

```javascript
await vg.init('memory.db');   // Open or create database
await vg.close();              // Always close when done
```

### Entities

```javascript
// Create
await vg.createEntities([{
  name: 'Bob (colleague)',
  entityType: 'Person',
  observations: ['Product manager', 'Joined 2024']
}]);

// Add facts
await vg.addObservations([{
  entityName: 'Bob (colleague)',
  contents: ['Now leading the redesign project']
}]);

// Get
const entity = await vg.getEntity('Bob (colleague)');

// Update
await vg.updateEntity('Bob (colleague)', {
  observations: ['Updated observation set']
});

// Delete
await vg.deleteEntities(['Bob (colleague)']);
```

### Relations

```javascript
// Create
await vg.createRelations([{
  from: 'Alice (user)',
  to: 'Bob (colleague)',
  relationType: 'works_with'
}]);

// Get
const relations = await vg.getRelations('Alice (user)');

// Delete
await vg.deleteRelations([{
  from: 'Alice (user)',
  to: 'Bob (colleague)',
  relationType: 'works_with'
}]);
```

### Search

```javascript
// ✅ Preferred: semantic + name boosting
const results = await vg.smartSearch('project management strategy', 10);

// Text fallback (no embeddings needed)
const found = await vg.searchText('Berlin engineer', 5);

// Open specific entities
const entities = await vg.openNodes(['Alice (user)', 'Bob (colleague)']);

// Full graph export
const { entities, relations } = await vg.readGraph();
```

### Stats

```javascript
const stats = await vg.getStats();
// { entityCount: 42, relationCount: 18 }
```

---

## Project Management (v3)

Track projects and tasks with structured metadata:

```javascript
await vg.createEntities([{
  name: 'P01 - Website redesign',
  entityType: 'Project',
  observations: ['Modernise the company website'],
  metadata: {
    status: 'Active',        // Not Started | Active | On Hold | Blocked | Complete
    priority: 'High',
    category: 'Work',
    nextAction: 'Finalise wireframes by Friday'
  }
}]);

// Update status
await vg.updateEntity('P01 - Website redesign', {
  metadata: { status: 'Complete', completedAt: new Date().toISOString() }
});

// Get formatted task board (markdown table)
const board = await vg.formatAsVtasks();
```

---

## Error Tracking (v4 verrors)

Log errors as entities for pattern detection and post-mortems:

```javascript
await vg.createVerror({
  subsystem: 'cron_daily_brief',
  errorType: 'timeout',
  errorMessage: 'Daily brief timed out after 30s',
  impact: 'User did not receive morning update'
});

// Check open issues
const unresolved = await vg.getUnresolvedVerrors();

// Mark resolved
await vg.resolveVerror('ERR-123456 (cron timeout, 2025-01-15)', 'Increased timeout to 60s');
```

---

## Naming Conventions

For best search results, use descriptive names:

```javascript
// Person: Name (aliases, role, relationship)
'Alice Johnson (Alice, Head of Engineering)'

// Project: ID + name
'P01 - Website redesign'

// Document: Name (type, date)
'Q1 Strategy (board presentation, 2025-Q1)'
```

---

## Architecture

```
vyasagraph/
  src/
    index.js            # Main API (re-exports everything)
    db.js               # SurrealDB connection & schema
    entities.js         # Entity CRUD
    relations.js        # Graph edge operations
    search.js           # Vector + text search
    smart-search.js     # Semantic search (use this)
    embeddings.js       # OpenAI embedding generation
    regenerate.js       # Embedding regeneration
    project-queries.js  # Project/task management
    verrors.js          # Error tracking
  tests/
    test-basic.js       # CRUD tests
    test-vector.js      # Vector search tests
  SESSION-STATE-TEMPLATE.md  # Copy to workspace as SESSION-STATE.md
  INSTALL.md            # Full setup guide
  ARCHITECTURE.md       # Technical deep-dive
```

---

## Tech Stack

- **SurrealDB** — embedded graph database
- **RocksDB** — storage engine (reliable on all platforms)
- **HNSW** — approximate nearest-neighbour vector index (cosine similarity)
- **OpenAI** — text-embedding-3-small (1536 dimensions)
- **Node.js 18+** — ES Modules

---

## Tests

```bash
npm test              # All tests
npm run test:basic    # CRUD only
npm run test:vector   # Vector search only
```

---

## Migrate from MCP

```bash
node scripts/migrate-from-mcp.js
```

---

## License

MIT

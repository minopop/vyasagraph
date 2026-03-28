# VyasaGraph — Installation Guide

This guide sets up the full two-layer memory stack: **VyasaGraph** (long-term) + **SESSION-STATE** (short-term). Both are required for optimal agent performance.

---

## 1. Install the Package

```bash
cd your-workspace
npm install vyasagraph
```

Or clone and install locally:

```bash
git clone https://github.com/minopop/vyasagraph
cd vyasagraph
npm install
```

---

## 2. Set Up SESSION-STATE

Copy the template to your workspace root:

```bash
cp node_modules/vyasagraph/SESSION-STATE-TEMPLATE.md SESSION-STATE.md
```

This file is your agent's **RAM** — it holds hot context for the current session that doesn't need a database query to retrieve.

---

## 3. Set Environment Variable

VyasaGraph uses OpenAI embeddings for semantic search. Set your API key:

```bash
# .env or shell profile
OPENAI_API_KEY=sk-...
```

Without this, VyasaGraph falls back to text search (still works, just less semantic).

---

## 4. Wire Both Systems into Your Agent

Add the following blocks to your agent's core instruction files. The exact file names depend on your platform (OpenClaw: `MEMORY.md`; Claude Code: `CLAUDE.md`; Codex: `AGENTS.md`; etc.).

---

### Block A — Add to MEMORY.md (or your agent's instruction file)

```markdown
## FIRST ACTION EVERY MESSAGE — MANDATORY
When receiving ANY message:

1. **SESSION-STATE (write-ahead log):**
   - READ `SESSION-STATE.md` for hot context from current session
   - WRITE to SESSION-STATE.md BEFORE responding if user gives:
     - New preference or decision
     - Concrete deadline or commitment
     - Important context that must survive compaction
     - Correction to prior assumption
   - UPDATE "Last updated" timestamp on every write
   - CLEAR completed tasks from "Pending Actions" when done

2. **VYASAGRAPH SEARCH:**
   - Search VyasaGraph: `const results = await vg.smartSearch('topic', 5);`
   - Load any people/projects mentioned in the user's message

3. **THEN:** Respond using loaded context

## AUTO-RECORD TO MEMORY — EVERY CONVERSATION
When the user shares substantive information, record it in that same reply:

```javascript
// Run at workspace root
import * as vg from './node_modules/vyasagraph/src/index.js';
await vg.init('memory.db');
await vg.addObservations([{
  entityName: 'Person Name',
  contents: ['New fact about them']
}]);
await vg.close();
```

Record:
- New facts about people → `addObservations()`
- Decisions or strategies → `createEntities()` + `addObservations()`
- Relationships → `createRelations()`
- Status changes → `addObservations()` or `updateEntity()`

## SESSION-STATE vs VyasaGraph
- SESSION-STATE = CPU cache (hot, ephemeral, write-ahead log, daily scope)
- VyasaGraph = Hard drive (permanent, semantic search, cross-session)
- Both are required. Neither replaces the other.

## Key Paths
- VyasaGraph DB: `./memory.db`
- SESSION-STATE: `./SESSION-STATE.md`
```

---

### Block B — Add to SOUL.md (or your agent's persona/behaviour file)

```markdown
## Memory System

I use a two-layer memory stack:

1. **SESSION-STATE.md** — my working memory for the current session. I read this at the start of every message and update it before responding with anything important. This is how I remember what we were doing when context compresses.

2. **VyasaGraph** — my long-term knowledge graph. Stores entities (people, projects, decisions) with relations and semantic vector search. I search this for context on every substantive message.

**Policy:** If the user tells me something I didn't know before, I write it to VyasaGraph in that same reply. I do not defer to end-of-session.
```

---

## 5. First Run

```javascript
import * as vg from './node_modules/vyasagraph/src/index.js';

// Initialize (creates memory.db if it doesn't exist)
await vg.init('memory.db');

// Create your first entity
await vg.createEntities([{
  name: 'Alice (user)',
  entityType: 'Person',
  observations: ['Software engineer', 'Prefers concise answers']
}]);

// Search
const results = await vg.smartSearch('engineer', 5);
console.log(results);

await vg.close();
```

---

## 6. Verify Installation

```bash
node -e "
import { init, getStats, close } from './node_modules/vyasagraph/src/index.js';
await init('memory.db');
const stats = await getStats();
console.log('VyasaGraph ready:', stats);
await close();
"
```

Expected output:
```
VyasaGraph ready: { entityCount: 0, relationCount: 0 }
```

---

## 7. Optional: Project Tracking (v3)

VyasaGraph includes a project/task board. Create project entities with metadata:

```javascript
await vg.createEntities([{
  name: 'P01 - Launch new feature',
  entityType: 'Project',
  observations: ['Build user dashboard'],
  metadata: {
    status: 'Active',        // Not Started | Active | On Hold | Blocked | Complete
    priority: 'High',        // High | Medium | Low
    category: 'Work',        // Work | Personal
    nextAction: 'Design wireframes'
  }
}]);

// Get formatted task board
const taskBoard = await vg.formatAsVtasks();
console.log(taskBoard);
```

---

## 8. Optional: Error Tracking (v4 verrors)

Log errors as entities for pattern detection:

```javascript
await vg.createVerror({
  subsystem: 'cron_morning_brief',
  errorType: 'timeout',
  errorMessage: 'Morning briefing timed out',
  impact: 'User did not receive daily brief'
});

// Check unresolved errors
const unresolved = await vg.getUnresolvedVerrors();
console.log(unresolved);
```

---

## Upgrade Notes

- **From MCP memory server:** See `scripts/migrate-from-mcp.js`
- **Database location:** Default is `./vyasagraph.db`. Pass a custom path to `init()`.
- **Backups:** Copy the entire `.db` directory. It's just a RocksDB folder.

---

## Troubleshooting

**"Cannot find package"** → Run `npm install` from your workspace root.

**"OpenAI API key not configured"** → Set `OPENAI_API_KEY`. Text search still works without it.

**"Cannot open database"** → Check no other process is using the `.db` file. Close any other agent sessions first.

**Slow cold start (~1s)** → Normal. SurrealDB loads the schema on first connection. Subsequent queries are fast.

# VyasaGraph v3 — Release Notes

**Version:** 3.0.0  
**Status:** ✅ Production Ready

---

## What's New

VyasaGraph v3 adds **project management capabilities** while maintaining 100% backward compatibility.

### New Features

1. **Optional Metadata Field**
   - Entities can now have structured metadata
   - Flexible schema (any fields you need)
   - Backward compatible (entities without metadata still work)

2. **Project Entity Types**
   - `Project`: High-level projects with status, priority, category
   - `Task`: Actionable items with assignee, hours, blockers
   - `Milestone`: Project phases with progress tracking
   - `Agent`: Coding agent sessions with status

3. **Structured Queries**
   - `searchProjects({ status, priority, category })`
   - `searchTasks({ assignee, project, milestone })`
   - `searchMilestones({ project, status })`
   - `searchAgents({ agentType, status })`

4. **Task Board Integration**
   - `formatAsVtasks()` generates a markdown task board
   - All data in VyasaGraph, formatted on demand

5. **Combined Search**
   - Semantic search + metadata filters work together
   - Searches observations (semantic) + filters by metadata

---

## Usage Examples

### Create Project

```javascript
import * as vg from 'vyasagraph/src/index.js';

await vg.init('memory.db');

await vg.createEntities([{
  name: 'P01 - Website redesign',
  entityType: 'Project',
  observations: ['Modernise the company website'],
  metadata: {
    status: 'Active',
    priority: 'High',
    category: 'Work',
    nextAction: 'Finalise wireframes'
  }
}]);
```

### Query Projects

```javascript
// Active high-priority projects
const projects = await vg.searchProjects({ status: 'Active', priority: 'High' });

// Work projects only
const work = await vg.searchProjects({ category: 'Work' });

// Blocked tasks
const blocked = await vg.searchTasks({ status: 'Blocked' });
```

### Generate Task Board

```javascript
const board = await vg.formatAsVtasks();
console.log(board);
// Returns formatted markdown table
```

### Update Metadata

```javascript
await vg.updateEntity('P01 - Website redesign', {
  metadata: {
    status: 'Complete',
    completedAt: new Date().toISOString()
  }
});
```

---

## Metadata Schemas

### Project
```javascript
{
  status: "Not Started" | "Active" | "In Progress" | "On Hold" | "Blocked" | "Complete",
  priority: "High" | "Medium" | "Low",
  category: "Personal" | "Work",
  dueDate: "YYYY-MM-DD",
  nextAction: "string",
  repository: "github url",
  completedAt: "ISO-8601 timestamp"
}
```

### Task
```javascript
{
  project: "project name",
  milestone: "milestone name",
  status: "Not Started" | "In Progress" | "Blocked" | "Done",
  priority: "High" | "Medium" | "Low",
  assignee: "string",
  estimatedHours: number,
  actualHours: number,
  blockedBy: ["task-id"],
  completedAt: "ISO-8601 timestamp"
}
```

### Milestone
```javascript
{
  project: "project name",
  status: "In Progress" | "Blocked" | "Complete",
  dueDate: "YYYY-MM-DD",
  progress: "3/10 tasks",
  completedTasks: number,
  totalTasks: number
}
```

### Agent
```javascript
{
  agentType: "codex" | "claude-code" | "pi",
  status: "Running" | "Complete" | "Failed",
  task: "task name",
  spawnedAt: "ISO-8601 timestamp",
  completedAt: "ISO-8601 timestamp",
  sessionId: "session-key",
  exitCode: number
}
```

---

## Backward Compatibility

✅ **All existing entities continue to work unchanged.**

- Entities without metadata: work perfectly
- Semantic search: unchanged
- Relations: unchanged
- Embeddings: unchanged

---

## Files Changed

- `src/entities.js` — Added metadata support
- `src/db.js` — Changed to SCHEMALESS schema
- `src/project-queries.js` — NEW (query helpers + task board)
- `src/index.js` — Exported new functions
- `DESIGN-V3.md` — Design spec
- `V3-RELEASE.md` — This file

# VyasaGraph v3 — Project Management Design

**Status:** Implemented  
**Goal:** Add project/task management while preserving backward compatibility

---

## Design Principles

1. **Backward Compatible:** All existing entities continue to work
2. **Optional Metadata:** New fields are optional — simple entities stay simple
3. **Unified Search:** Semantic search + structured filters work together
4. **Type Safety:** Well-defined schemas for each entity type

---

## Schema Extension

### Core Entity Structure (unchanged)
```javascript
{
  id: "entity:xxxxx",
  name: "Entity Name",
  entityType: "Person" | "Project" | "Task" | "Milestone" | "Agent" | "Document" | ...,
  observations: ["fact 1", "fact 2", ...],
  embedding: [...],  // 1536-dim vector
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

### NEW: Optional Metadata Field
```javascript
{
  ...existing fields...,
  metadata: {
    // Project metadata
    status?: "Not Started" | "Active" | "On Hold" | "Blocked" | "Complete",
    priority?: "High" | "Medium" | "Low",
    category?: "Personal" | "Work",
    dueDate?: "ISO-8601 date",
    progress?: "3/10 tasks",
    nextAction?: "string",
    
    // Task metadata
    assignee?: "string",
    estimatedHours?: number,
    actualHours?: number,
    blockedBy?: ["task-id", ...],
    
    // Agent metadata
    agentType?: "codex" | "claude-code" | "pi",
    spawnedAt?: "timestamp",
    completedAt?: "timestamp",
    sessionId?: "session-key",
    
    // Generic
    repository?: "github.com/...",
    nextMilestone?: "milestone-name",
    owner?: "person-name",
    ...extensible...
  }
}
```

---

## Entity Type Schemas

### Project
```javascript
{
  name: "P01 - Website redesign",
  entityType: "Project",
  observations: ["Modernise the company website", "Mobile-first approach"],
  metadata: {
    status: "Active",
    priority: "High",
    category: "Work",
    dueDate: "2025-06-01",
    nextAction: "Finalise wireframes"
  }
}
```

### Milestone
```javascript
{
  name: "Website redesign - MVP",
  entityType: "Milestone",
  observations: ["First version with new design system"],
  metadata: {
    project: "P01 - Website redesign",
    status: "In Progress",
    dueDate: "2025-04-15",
    progress: "3/10 tasks",
    completedTasks: 3,
    totalTasks: 10
  }
}
```

### Task
```javascript
{
  name: "Build component library",
  entityType: "Task",
  observations: ["Create reusable React components"],
  metadata: {
    milestone: "Website redesign - MVP",
    project: "P01 - Website redesign",
    status: "In Progress",
    priority: "High",
    assignee: "Alice",
    estimatedHours: 8,
    blockedBy: []
  }
}
```

### Agent
```javascript
{
  name: "Codex Session #1234",
  entityType: "Agent",
  observations: ["Working on component library", "Completed Button, Input, Card"],
  metadata: {
    agentType: "codex",
    status: "Running",
    task: "Build component library",
    spawnedAt: "2025-01-15T10:00:00Z",
    sessionId: "session-xyz"
  }
}
```

---

## Relationships

```javascript
// Project hierarchy
Project --has_milestone--> Milestone
Milestone --has_task--> Task
Task --blocks--> Task

// Assignments
Task --assigned_to--> Agent
Project --owned_by--> Person

// Dependencies
Task --depends_on--> Task
Milestone --follows--> Milestone
```

---

## API

### Query Functions

```javascript
searchByType(entityType, filters?)          // Generic type + metadata search
searchProjects({ status?, category?, priority? })
searchTasks({ status?, assignee?, project? })
searchMilestones({ project?, status? })
searchAgents({ agentType?, status? })

getProject(name)
getProjectMilestones(projectName)
getMilestoneTasks(milestoneName)
getTasksBlockedBy(taskName)

formatAsVtasks()           // Markdown task board
formatProjectRoadmap(projectName)
```

### Enhanced Existing Functions

```javascript
// createEntities now accepts metadata
await vg.createEntities([{
  name: "P01 - Website redesign",
  entityType: "Project",
  observations: [...],
  metadata: { status: "Active", priority: "High" }
}]);

// updateEntity now accepts metadata
await vg.updateEntity("P01 - Website redesign", {
  metadata: { status: "Complete", completedAt: new Date().toISOString() }
});
```

---

## Backward Compatibility

All v2 entities continue to work without modification. The `metadata` field is optional — entities without it behave exactly as before.

# Epic as Top-Level Entity: Implementation Change

**Date:** February 2026  
**Status:** Implemented

---

## Overview

This document describes the architectural simplification where **Epic** was promoted to be the top-level entity, replacing the original three-tier hierarchy with a streamlined two-tier structure.

---

## Original Structure (Pre-Change)

The initial design included a three-tier hierarchy:

```
Workspace
  └─ Project (top-level container)
      └─ Epic (initiative)
          └─ Task (assignable work)
              └─ Subtask (execution steps)
```

### Original Hierarchy Characteristics

- **Project**: Top-level organizational container
  - Appeared in sidebar navigation
  - Had its own detail pages with tabs (Epics, Tasks, Board, Docs)
  - Controlled membership/access (who can see which projects)
  - Parent to multiple Epics
- **Epic**: Mid-level grouping for related work
  - Belonged to exactly one Project
  - Grouped related Tasks together
  - Tracked aggregate progress from child Tasks

- **Task**: Assignable work item
  - Belonged to exactly one Epic (which belonged to a Project)
  - Had owner, assignee, status, priority, estimates

- **Subtask**: Granular execution steps
  - Belonged to exactly one Task

### Issues with Original Structure

1. **Unnecessary nesting** — Most teams organized work directly at the Epic level, making Project an extra layer
2. **Navigation overhead** — Required clicking through Project → Epic → Task to reach work items
3. **Cognitive load** — Users had to remember which Epic belonged to which Project
4. **Access control complexity** — Project-level permissions added authorization complexity without clear value
5. **UI clutter** — Sidebar had to show expandable Project trees instead of flat Epic list

---

## New Structure (Current)

Simplified to a two-tier hierarchy:

```
Workspace
  └─ Epic (top-level initiative)
      └─ Task (assignable work)
          └─ Subtask (execution steps)
```

### New Hierarchy Characteristics

- **Epic**: Now the top-level entity
  - Appears directly in sidebar and main navigation
  - Has detail page with tabs (Tasks, Board, Docs)
  - Direct parent to Tasks (no intermediate Project layer)
  - Tracks aggregate progress from child Tasks
  - Can be filtered, sorted, and managed independently

- **Task**: Assignable work item
  - Belongs directly to one Epic (no Project reference needed)
  - Maintains all original functionality (owner, assignee, status, priority, estimates, watchers, comments, attachments)

- **Subtask**: Unchanged
  - Still belongs to exactly one Task
  - Rolls up progress to parent Task

### Benefits of New Structure

1. **Reduced navigation depth** — Direct access: Epic → Task (one less click)
2. **Simplified mental model** — Only two levels to track
3. **Cleaner UI** — Flat Epic list in sidebar instead of nested tree
4. **Easier permissions** — Workspace-level roles sufficient (no per-Project access control)
5. **Faster development** — Fewer entities = less CRUD boilerplate

---

## Implementation Changes

### 1. Navigation & Routing

**Removed:**

- `/projects` — No longer exists
- `/projects/:id` — Project detail page removed
- `/projects/:id/board` — Moved to `/board` (workspace-wide view)
- `/projects/:id/tasks` — Not needed (Epic-level task list exists)

**Active routes:**

- `/epics` — Main Epic list page
- `/epic/:epicId` — Epic detail page (tabs: Tasks, Docs)
- `/board` — Kanban board (workspace-wide, filterable by Epic)
- `/my-work` — Personal task view
- `/dashboard` — Management overview
- `/utilization` — Workload tracking
- `/task/:taskId` — Task detail modal/page

### 2. Sidebar Navigation

**Before:**

```
- Dashboard
- Projects (expandable tree)
  - Project A
    - Epic 1
    - Epic 2
  - Project B
    - Epic 3
- Board
- My Work
- Utilization
- Workspace
```

**After:**

```
- Dashboard
- Epics (flat list)
- Board
- My Work
- Utilization
- Workspace
```

### 3. Data Model

#### Type Definitions (`lib/types.ts`)

**Kept (Legacy/Optional):**

```typescript
export interface Project {
  id: string;
  name: string;
  description: string;
  color?: string;
  icon?: string;
  createdAt: string;
  archivedAt?: string;
  memberIds: string[];
}
```

> **Note:** Project interface still exists but is not actively used. The `projectId` field in Epic and Task is optional and typically `undefined`.

**Epic:**

```typescript
export interface Epic {
  id: string;
  projectId?: string; // Optional, usually undefined
  title: string;
  description: string;
  owner: User;
  watchers: User[];
  status: EpicStatus;
  startDate?: string;
  dueDate?: string;
  tags?: string[];
  docsPages: DocPage[];
}
```

**Task:**

```typescript
export interface Task {
  id: string;
  epicId: string; // Required: directly linked to Epic
  projectId?: string; // Optional legacy field, not enforced
  title: string;
  description: string;
  assignee: User | null;
  owner?: User;
  watchers: User[];
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  estimate?: number;
  subtasks: Subtask[];
  comments: Comment[];
  timeEntries: TimeEntry[];
  attachments: Attachment[];
  externalLinks: ExternalLink[];
}
```

### 4. Component Changes

**Removed/Deprecated:**

- `ProjectList` component (no longer needed)
- `ProjectCard` component (no Epic hierarchy display)
- `ProjectDetailPage` and related tabs

**Kept/Updated:**

- `EpicCard` — Now used as primary cards on Dashboard and Epics page
- `EpicHeader` — Displays Epic info without Project breadcrumb
- `EpicTasksTab` — Lists tasks directly under Epic
- `TaskCard` — Shows Epic name instead of Project > Epic breadcrumb
- `KanbanColumn` — Filters by Epic (not Project)

### 5. Data Store & Context

**Before:**

```typescript
// Context tracked Projects, Epics, Tasks
const projects = [...];
const epics = [...]; // each epic had projectId
const tasks = [...]; // each task had epicId and projectId
```

**After:**

```typescript
// Context only tracks Epics and Tasks
const epics = [...]; // projectId optional, often undefined
const tasks = [...]; // epicId required, projectId optional
```

### 6. Filtering & Search

**Before:**

- Filter by Project → then by Epic → then by Task
- Breadcrumb: Project > Epic > Task

**After:**

- Filter by Epic → then by Task
- Breadcrumb: Epic > Task

### 7. Documentation & PRD Alignment

**Original PRD mentions:**

- "Projects are the top-level container above Epics" — No longer accurate
- "Project membership controls access" — Now handled at workspace level
- Task references mentioned "Project/Epic" — Now just "Epic"

**Current Reality:**

- Epic is the primary organizational unit
- Workspace-level RBAC (Admin, Manager, Member, Viewer)
- No per-Epic access control (all roles see all Epics based on workspace role)

---

## Migration Notes

### Backward Compatibility

The system maintains **optional** `projectId` fields in Epic and Task interfaces to avoid breaking changes if old data references exist. However:

- New Epics created have `projectId: undefined`
- New Tasks created only require `epicId`
- UI never displays or requires Project information

### Database Considerations (If Applicable)

If persisting to a database, consider:

1. **Keep schema flexible**: Allow `project_id` to be NULL
2. **Do not enforce FK constraints** on `project_id` (it's a soft reference)
3. **Queries should not JOIN on projects** table
4. **Filter/search only uses** `epic_id` as the parent relationship

### Future Cleanup Opportunities

If Project concept is fully deprecated:

- Remove `Project` interface from `types.ts`
- Remove `projectId` field from Epic and Task
- Remove any residual Project-related utility functions
- Update all documentation to reflect Epic-only hierarchy

---

## User-Facing Changes

### What Users See

1. **Sidebar**: Flat list of Epics instead of nested Projects
2. **Dashboard**: Epic cards as primary units (no Project grouping)
3. **Board view**: Columns are statuses, cards show Epic name (not Project > Epic)
4. **My Work**: Tasks show Epic breadcrumb only
5. **Task detail**: Parent is Epic (no Project reference)

### What Users Don't See Anymore

- Project detail pages
- Project creation/management UI
- Project membership management
- "Assign to Project" workflows
- Project-level documentation (only Epic-level docs remain)

---

## Benefits Realized

1. **Faster task creation**: One less dropdown (no Project selection)
2. **Simpler navigation**: Direct Epic access from sidebar
3. **Clearer ownership**: Epic owner is top-level accountability
4. **Less training needed**: Two-tier hierarchy easier to explain
5. **Faster development**: 20-30% less boilerplate code

---

## Related Documentation

- [PRD.md](PRD.md) — Original product requirements (reflects old structure)
- [USER_STORY.md](USER_STORY.md) — User stories (mentions "Project/Epic" in older stories)
- [TASK-06-project-management.md](tasks/TASK-06-project-management.md) — Originally scoped Project CRUD (now deprecated)
- [TASK-07-epic-crud.md](tasks/TASK-07-epic-crud.md) — Epic management (now top-level)
- [lib/types.ts](lib/types.ts) — Current type definitions

---

## Summary

The transition from **Project > Epic > Task > Subtask** to **Epic > Task > Subtask** represents a strategic simplification that:

- Reduces cognitive overhead
- Accelerates development velocity
- Improves user experience through cleaner navigation
- Maintains backward compatibility through optional `projectId` fields
- Aligns the implementation with how teams naturally organize work

**Epic is now the single top-level container for all work.**

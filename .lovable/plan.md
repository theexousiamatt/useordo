# Workspace-Scoped Data Model

## Goal
Make `workspace_id` the top-level tenant boundary for every business entity. Today `projects`, `tasks`, `activity`, `files`, `milestones`, `approvals` are scoped only through `project_members` + `owner_id` — there is no `workspace_id` on them, and there is no `comments` or `deliverables` table. This design adds the missing column, the missing tables, and a single consistent RLS strategy keyed on workspace membership and role.

## Core principle
Every row belongs to exactly one workspace. RLS always answers two questions: (1) is the caller a member of this row's workspace, and (2) does their `workspace_role` (`owner` / `member` / `client`) permit the action. We reuse the existing security-definer helpers `is_workspace_member(workspace_id, uid)`, `has_workspace_role(workspace_id, uid, role)`, and `get_workspace_role(workspace_id, uid)`.

## 1. Add workspace_id to existing tables
Add a non-null `workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE` to:
- `projects` (the anchor entity)
- `tasks`, `milestones`, `files`, `activity` (derive from their project's workspace)

```text
workspaces
  └─ projects (workspace_id)
       ├─ tasks (workspace_id, project_id)
       ├─ milestones (workspace_id, project_id)
       ├─ files / deliverables (workspace_id, project_id)
       ├─ comments (workspace_id, project_id, parent refs)
       └─ activity (workspace_id, project_id)
```

Backfill plan: populate `workspace_id` on existing rows from each project's owner's primary workspace (or a default workspace) before applying the `NOT NULL` constraint, so current data survives the migration.

## 2. New tables

### comments
Threaded discussion attachable to a project, task, milestone, or deliverable.
- Domain fields: `workspace_id`, `project_id`, `body`, `author_id`, `parent_comment_id` (self-FK for threads), plus a polymorphic target via `entity_type` (enum: project, task, milestone, deliverable) + `entity_id`.
- `is_client_visible boolean default true` so internal-only notes can be hidden from client-role users.
- Cascades: `ON DELETE CASCADE` from workspace and project; `parent_comment_id` cascades to delete replies.

### deliverables
Formal client-facing outputs (distinct from raw `files`).
- Domain fields: `workspace_id`, `project_id`, `title`, `description`, `status` (new enum `deliverable_status`: draft, in_review, approved, delivered, archived), `due_date`, `file_id` (nullable FK to `files`), `delivered_at`.
- Links to approvals: a deliverable can be the subject of an approval.

### client_access (explicit client scoping)
Today client visibility is implicit via `project_members` role `client`. To make "Client Access" first-class:
- `workspace_id`, `project_id`, `client_user_id`, `access_level` (enum: viewer, approver), `invited_by`, `revoked_at`.
- Drives which projects a `client`-role workspace member can see, independent of internal `project_members`.

### Future AI planning (extensible, built now as empty-but-scoped tables)
- `ai_plans`: `workspace_id`, `project_id` (nullable for workspace-level plans), `prompt`, `model`, `status` (queued/running/complete/failed), `created_by`.
- `ai_plan_items`: `ai_plan_id` FK (cascade), `workspace_id`, suggested `entity_type` (task/milestone/deliverable), `payload jsonb`, `applied boolean`, `applied_entity_id`.
- `payload jsonb` keeps the AI surface flexible without future schema churn; a generated `accepted_at` records when a suggestion is materialized into a real task/milestone.

## 3. RLS strategy (uniform across all tables)
For each workspace-scoped table:
- SELECT: `is_workspace_member(workspace_id, auth.uid())`, AND for `client`-role users additionally gated on `client_access` (or `is_client_visible` for comments).
- INSERT/UPDATE/DELETE: `has_workspace_role(workspace_id, auth.uid(), 'owner')` OR `'member'`. Clients get write access only where intended (e.g. creating comments, recording approvals on deliverables they can access).
- Comments UPDATE/DELETE restricted to `author_id = auth.uid()` OR workspace owner.
- AI tables: read by members; write by owner/member only.

Every `CREATE TABLE` ships with explicit `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` and `GRANT ALL ... TO service_role` (no `anon`, since all data is workspace-private). A new `is_client_for_project(project_id, uid)` security-definer helper avoids recursive RLS when checking `client_access`.

## 4. Indexes
- `workspace_id` index on every scoped table (tenant filter on every query).
- Composite `(workspace_id, project_id)` on tasks, milestones, comments, deliverables, activity.
- `(entity_type, entity_id)` on comments for polymorphic lookups.
- `(project_id, client_user_id)` unique on `client_access`.
- `(ai_plan_id)` on `ai_plan_items`.
- Existing status/due_date sort columns get supporting indexes where list views order by them.

## 5. Foreign keys & cascade rules
- Delete workspace → cascade to all child entities (full tenant teardown).
- Delete project → cascade tasks, milestones, files, deliverables, comments, activity, client_access for that project.
- Delete task/milestone/deliverable → cascade their comments (via `entity_id` cleanup trigger, since polymorphic refs can't use a plain FK) and approvals.
- `file_id` on deliverables uses `ON DELETE SET NULL` so removing a raw file doesn't destroy the deliverable record.
- AI plan delete → cascade plan items.

## 6. Activity logging
Extend the existing trigger pattern: triggers on tasks/milestones/files already write to `activity`. Add equivalent triggers for `deliverables` (status changes) and `comments` (created), all stamping `workspace_id` so the workspace-level `activity_logs` feed and the project-level `activity` feed stay consistent. New `activity_type` enum values: `deliverable_created`, `deliverable_status_changed`, `comment_added` (already exists), `client_access_granted`, `client_access_revoked`.

## 7. Extensibility notes
- `jsonb` payloads on AI tables and activity keep new feature data additive.
- Polymorphic `entity_type` + `entity_id` on comments lets future entities (e.g. proposals, invoices) reuse the comment system without new join tables.
- New enums (`deliverable_status`, `comment_entity_type`, `ai_plan_status`) are isolated so adding values later is non-breaking.

## Technical details
- Implemented as one or more `supabase--migration` calls: enums first, then `ALTER TABLE` for `workspace_id` + backfill + `NOT NULL`, then new tables with GRANT→RLS→POLICY order, then helper functions, indexes, and triggers.
- No UI is built in this phase; `src/integrations/supabase/types.ts` regenerates automatically after migration.
- Existing edge functions (`list-workspaces`, `create-workspace`) are unaffected.

## Open questions
1. For backfilling existing `projects` with `workspace_id`: should orphan projects map to each owner's first workspace, or do you want a one-off "Legacy" workspace created for unassigned data?
2. Should `client`-role users ever create `deliverables`/`tasks`, or strictly comment + approve?
3. Do you want `deliverables` to fully replace the current `files`-as-output usage, or coexist (files = raw assets, deliverables = curated outputs)?

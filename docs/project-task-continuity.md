# Ordo task completion and editor continuity (2026-11-14)

## Authoritative semantics

- **Stage** is the actual workflow location (`tasks.stage_id`). `project_stages.is_completion` tells Ordo whether tasks placed there count as finished. Stage name is user-defined and stage colour is cosmetic.
- Existing `Done` stages (`category='done'`) are migrated to `is_completion=true`; newly seeded projects have the same default. Other stages may be marked as completion stages through their own menu.
- The existing `tasks.status` field remains as a legacy compatibility category, **not** a second completion source. The board and drawer display actual stage details, not a guessed reporting category.
- **Checklist progress** is computed as completed checklist items / all items only when any exist. It is intentionally independent of task completion. A task in a completion stage with unfinished checklist items is permitted, but the user must confirm before moving it there.
- **Project progress** = completed unarchived tasks / all unarchived tasks, rounded to the nearest integer. Empty projects show “No tasks”. An additive database trigger maintains the existing `projects.progress` field for dashboards and other clients; the project page also displays a locally derived breakdown of completed/total tasks.
- Moving to a completion stage with unfinished checklist items opens a confirmation. “Finish anyway” changes only the stage, never checks unfinished items. This is shared across card menus, keyboard, dragging, and bulk operations.
- Existing projects and tasks are not deleted, reset, or reparented by the migration.

## Shared editing

The task drawer reuses the same `InlineTaskTitle`, `InlineLabelPicker`, `InlineMemberPicker` and `InlineDatePicker` controls as the board and routes mutations through the parent board. The drawer also exposes an actual stage picker. Stage, title, assignees, labels, and due date are all editable in either view and update the same query cache.

## Rollout & verification

1. Apply `20261114041500_stage_completion_project_progress.sql` only after isolated legacy schema and task migration tests pass.
2. Verify project progress for existing projects, task creation, drag-and-drop, bulk moves, task deletion/archive and moving a task back out of Done.
3. Verify completion-stage toggle with concurrent revision checks and manager permissions; stage duplication carries completion semantics.
4. Test task editors in board and drawer, custom stage names, label updates and mobile popovers. Verify no remaining “To do” reporting label leaks into the custom stage UI.
5. Deploy the matching frontend and updated duplicate-project Edge Function after all checks pass, retaining a rollback build.

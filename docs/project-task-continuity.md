# Ordo — every stage is equal

## Product contract

A project stage is **only** a customizable container: `id`, user-editable `name`, order, theme, and tasks. Names such as Done, Review, Backlog, and Design are text only. Stages do not determine task completion, change checklist items, or affect project progress. Duplicating, renaming, moving between, or recolouring stages never adds a hidden completion rule.

`project_stages.category` and `tasks.status` are historical compatibility fields, not application workflow state. All visible stage information is derived from `stage_id`, the user-defined stage name, and the chosen theme. New tasks do not inherit any completion state based on where they are created.

Task completion uses the explicit `tasks.completed_at` timestamp. Users can **Mark complete** or **Reopen** from the card, its menu, the drawer, and bulk actions. Users may deliberately finish a task with unfinished checklist items after confirmation; this never checks the items off.

Checklist completion is an independent `completed/total` value and a progress bar is shown **only when items exist**.

Project progress is `round(100 × explicitly completed active tasks / active tasks)`, or zero for projects without tasks. The same database trigger maintains `projects.progress` for other views.

The workspace Tasks screen groups open work by **real project and stage names** and excludes only tasks whose `completed_at` is set. A stage named Done never hides tasks from that screen.

## Migration behaviour

The old completion-stage RPC, column, trigger, and automatic stage-to-status mapping are removed. All project, stage, task and checklist records remain untouched, but legacy auto-completion is **not** copied to `completed_at` because doing so would incorrectly assume users intended those stages to mark work as finished. Existing project progress is recalculated from explicit task completion, which may reset old automatically derived percentages to 0%. No tasks or checklist items are deleted.

New projects may still start with sample stage **names**, but these names are entirely ordinary user-editable labels. This is a default layout template, not an application workflow.

## Release acceptance criteria

- Rename a stage to Done, Design, or anything else: no task becomes complete.
- Move and reorder tasks between any stages: completion, checklist and project progress unchanged.
- Mark a task complete in any stage: project progress updates; reopen reverses it.
- Incomplete checklist when clicking Mark complete: confirmation; no automatic checklist changes.
- New tasks created in any stage begin incomplete.
- Stage theme changes presentation only; task labels remain independent.
- Consolidated Tasks view displays custom stage names, including incomplete work under Done.
- Duplicated projects preserve stage names/themes/layout but no stage-completion semantics.
- Database migration passes isolated verification and RLS rules before production update.

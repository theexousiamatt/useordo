# Task-card progress and quick labels

## Task-card rule
A task **without subtasks** is a regular card: no progress bar or synthetic percentage, regardless of its workflow stage or status. When one or more real checklist items exist, the card shows `completed / total` and a percentage calculated as `round(completed / total * 100)`. Deleting the last subtask removes the bar immediately. The progress bar takes the current **stage's theme** accent colour.

## Creating and completing subtasks
Task details → Overview → **Subtasks** contains a compact checklist for adding, completing, and deleting steps. There is no “Coming soon” placeholder. Checklist changes invalidate the shared project query so board cards update; completion and deletion are optimistic. A subtask belongs to an existing task and project, enforced by a composite foreign key and RLS. Task or project deletion cascades. Moving a task between projects retains its subtasks through ON UPDATE CASCADE.

Task duplication copies subtasks as well as the task. When duplicating a project with its tasks, subtasks are mapped to the newly created task IDs.

## Quick labels
Click an existing label chip or **Add label** on a card to open the inline label picker without opening Task Details. Use the existing picker to assign, remove, search, create, rename, recolour and delete project labels. A newly created label is immediately assigned to the card that created it. Stage themes and label colours are independent.

## Rollout
Apply `supabase/migrations/20261114030000_task_subtasks.sql` to **legacy Ordo Supabase**, then deploy the matching frontend and duplicate-project Edge Function. Verify all three with existing project data before release. No old tasks or labels should be rewritten.

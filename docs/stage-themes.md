# Ordo stage themes

The appearance setting belongs to `project_stages.theme`, **not** the board or individual task. Each stage has one named colour theme: Neutral, Forest, Ocean, Lavender, Rose, Amber or Slate. Only stage managers can edit the theme. Every card in a stage inherits its background, border, progress bar and supporting visual accents. The stage header dot also uses the theme accent. Colour schemes have light and dark variants.

The stage creation flow exposes **Stage name** and **Theme** only. The previously visible “Reporting status” selector is removed. The existing legacy `category` column is still required for compatibility with task statuses and reporting, so freely created stages silently default to `todo`; duplicating a stage retains its category. Users can name a stage anything; the stage name, not an arbitrary default reporting value, is displayed on its task card pills.

Use the stage overflow menu → **Change theme** to update an existing stage, with an immediate local visual preview. Saving applies to that stage only. Labels, priorities and task content are unchanged. A duplicate project copies the theme for each duplicated stage.

## Migration and deployment safety

- Additive `20261114014500_stage_themes.sql` adds `project_stages.theme`, default Neutral, plus two explicitly authorized RPCs. Existing project theme fields remain physically present for backward compatibility but are ignored by the updated UI.
- `create_custom_stage` atomically creates a stage with the selected theme, preserving idempotent request IDs.
- `set_project_stage_theme` validates project-manager access and checks the stage revision before updating.
- No direct stage-table write permission is granted to clients. Cached older clients can continue using `manage_project_stage` unchanged.
- Deploy SQL to the **legacy Ordo Supabase project**, before the matching frontend. Preserve both source and static-site rollback branches.
- Verify independent themes on two stages, new-stage creation with arbitrary names, stage duplication, task drag/drop (including overlay), dark mode, cross-project access rejection, and duplication into a new project.

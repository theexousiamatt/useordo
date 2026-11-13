# Ordo custom-board theme system

The board-level setting is `projects.theme`; its default is `neutral`.
Available themes: Neutral, Forest, Ocean, Lavender, Rose, Amber and Slate.

**Theme:** card background, border, progress track/fill and footer divider, in light and dark modes.
**Not theme:** labels, priorities, stages, task status or completion. Status pills remain semantic.

Project settings → Board appearance → Theme has a selectable palette and real card preview.
Only users with permission to manage the project can change the theme.
All cards in that project's board, including dragged cards, inherit the same theme.
Duplicating a project copies its theme only when settings are copied; blank duplicates use Neutral.

## Safe deployment order
1. Validate against a non-production copy of legacy Ordo's database.
2. Apply `20261114001000_project_board_theme.sql` to the **existing legacy** database, once backups and RLS are checked.
3. Deploy the new frontend and matching duplicate-project Edge Function.
4. Verify theme persistence, per-board isolation, labels/status independence, dark mode, permissions, drag overlay and duplication.

Do not apply canonical new-backend migrations or reset the existing production database.
The source branch is separate from the Hostinger static build branch.

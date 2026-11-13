-- Additive migration for existing legacy Ordo projects, not the canonical backend.
-- Does not modify tasks or destroy project data. New/existing boards are neutral.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'neutral';

ALTER TABLE public.projects
  ADD CONSTRAINT projects_board_theme_allowed
  CHECK (theme IN ('neutral', 'forest', 'ocean', 'lavender', 'rose', 'amber', 'slate'));

COMMENT ON COLUMN public.projects.theme IS
  'One card appearance theme per project board, independent of labels, stage and status.';

-- Existing project UPDATE RLS controls who may change this column.

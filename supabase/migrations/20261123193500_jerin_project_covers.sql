ALTER TABLE public.projects
  ADD COLUMN cover_image_key text
  CONSTRAINT projects_cover_image_key_valid CHECK (
    cover_image_key IN ('architecture', 'wildflowers', 'alpine-stream', 'highland-road', 'cliffs', 'mountain-drive')
  );

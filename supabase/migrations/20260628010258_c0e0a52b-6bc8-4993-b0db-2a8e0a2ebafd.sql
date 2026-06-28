-- =========================================================
-- Project-scoped Label system
-- =========================================================

-- 1. project_labels: each project owns its own labels
CREATE TABLE public.project_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'gray',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_labels TO authenticated;
GRANT ALL ON public.project_labels TO service_role;

ALTER TABLE public.project_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View project labels" ON public.project_labels
  FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "Create project labels" ON public.project_labels
  FOR INSERT TO authenticated
  WITH CHECK (public.can_contribute_project(project_id, auth.uid()));
CREATE POLICY "Update project labels" ON public.project_labels
  FOR UPDATE TO authenticated
  USING (public.can_contribute_project(project_id, auth.uid()))
  WITH CHECK (public.can_contribute_project(project_id, auth.uid()));
CREATE POLICY "Delete project labels" ON public.project_labels
  FOR DELETE TO authenticated
  USING (public.can_contribute_project(project_id, auth.uid()));

CREATE INDEX idx_project_labels_project ON public.project_labels(project_id);
CREATE INDEX idx_project_labels_workspace ON public.project_labels(workspace_id);

CREATE TRIGGER trg_project_labels_updated_at
  BEFORE UPDATE ON public.project_labels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. task_labels: join between tasks and project_labels
CREATE TABLE public.task_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.project_labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, label_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_labels TO authenticated;
GRANT ALL ON public.task_labels TO service_role;

ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View task labels" ON public.task_labels
  FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "Create task labels" ON public.task_labels
  FOR INSERT TO authenticated
  WITH CHECK (public.can_contribute_project(project_id, auth.uid()));
CREATE POLICY "Delete task labels" ON public.task_labels
  FOR DELETE TO authenticated
  USING (public.can_contribute_project(project_id, auth.uid()));

CREATE INDEX idx_task_labels_task ON public.task_labels(task_id);
CREATE INDEX idx_task_labels_label ON public.task_labels(label_id);
CREATE INDEX idx_task_labels_project ON public.task_labels(project_id);

-- 3. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_labels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_labels;

-- 4. Auto-seed default labels on new projects
CREATE OR REPLACE FUNCTION public.seed_project_labels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.project_labels (workspace_id, project_id, name, color, position)
  VALUES
    (NEW.workspace_id, NEW.id, 'Low', 'gray', 0),
    (NEW.workspace_id, NEW.id, 'Medium', 'blue', 1),
    (NEW.workspace_id, NEW.id, 'High', 'orange', 2),
    (NEW.workspace_id, NEW.id, 'Urgent', 'red', 3);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_project_labels
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.seed_project_labels();

-- =========================================================
-- 5. Data migration for existing projects/tasks
-- =========================================================

-- 5a. Seed default labels for every existing project
INSERT INTO public.project_labels (workspace_id, project_id, name, color, position)
SELECT p.workspace_id, p.id, v.name, v.color, v.position
FROM public.projects p
CROSS JOIN (VALUES ('Low','gray',0),('Medium','blue',1),('High','orange',2),('Urgent','red',3)) AS v(name,color,position);

-- 5b. Map existing task.priority -> matching default label
INSERT INTO public.task_labels (workspace_id, project_id, task_id, label_id)
SELECT t.workspace_id, t.project_id, t.id, pl.id
FROM public.tasks t
JOIN public.project_labels pl
  ON pl.project_id = t.project_id
  AND pl.name = CASE t.priority
    WHEN 'low' THEN 'Low'
    WHEN 'medium' THEN 'Medium'
    WHEN 'high' THEN 'High'
    WHEN 'critical' THEN 'Urgent'
    ELSE 'Medium'
  END
ON CONFLICT (task_id, label_id) DO NOTHING;

-- 5c. Convert existing free-text labels into project labels (gray default)
INSERT INTO public.project_labels (workspace_id, project_id, name, color, position)
SELECT DISTINCT t.workspace_id, t.project_id, lbl, 'gray', 100
FROM public.tasks t
CROSS JOIN LATERAL unnest(t.labels) AS lbl
WHERE btrim(lbl) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.project_labels pl
    WHERE pl.project_id = t.project_id AND lower(pl.name) = lower(lbl)
  );

-- 5d. Link tasks to their converted text labels
INSERT INTO public.task_labels (workspace_id, project_id, task_id, label_id)
SELECT t.workspace_id, t.project_id, t.id, pl.id
FROM public.tasks t
CROSS JOIN LATERAL unnest(t.labels) AS lbl
JOIN public.project_labels pl
  ON pl.project_id = t.project_id AND lower(pl.name) = lower(lbl)
WHERE btrim(lbl) <> ''
ON CONFLICT (task_id, label_id) DO NOTHING;

-- 6. Drop legacy priority + labels columns from tasks
ALTER TABLE public.tasks DROP COLUMN IF EXISTS priority;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS labels;
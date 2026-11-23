-- Older project-level deliverables continue to work without a task or source.
ALTER TABLE public.deliverables
 ADD COLUMN task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
 ADD COLUMN project_file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
 ADD COLUMN attachment_url text,
 ADD COLUMN attachment_path text,
 ADD COLUMN attachment_name text,
 ADD COLUMN version_label text,
 ADD CONSTRAINT deliverable_one_source CHECK (num_nonnulls(project_file_id, attachment_url, attachment_path) <= 1),
 ADD CONSTRAINT deliverable_http_url CHECK (
   attachment_url IS NULL OR (length(attachment_url) <= 2048 AND attachment_url ~* '^https?://[^[:space:]]+$')
 ),
 ADD CONSTRAINT deliverable_upload_scope CHECK (
   attachment_path IS NULL OR split_part(attachment_path, '/', 1) = project_id::text
 ),
 ADD CONSTRAINT deliverable_version_length CHECK (length(version_label) <= 40);

CREATE INDEX deliverables_task_id_idx ON public.deliverables(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX deliverables_project_file_idx ON public.deliverables(project_file_id) WHERE project_file_id IS NOT NULL;
CREATE UNIQUE INDEX deliverables_attachment_path_idx ON public.deliverables(attachment_path) WHERE attachment_path IS NOT NULL;

CREATE FUNCTION public.check_deliverable_source_scope() RETURNS trigger
 LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = NEW.project_id AND p.workspace_id = NEW.workspace_id) THEN
   RAISE EXCEPTION 'Deliverable workspace does not match the project' USING ERRCODE = '23514';
 END IF;
 IF NEW.task_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.tasks t WHERE t.id = NEW.task_id AND t.project_id = NEW.project_id AND t.workspace_id = NEW.workspace_id
 ) THEN
   RAISE EXCEPTION 'The task must belong to the deliverable project' USING ERRCODE = '23514';
 END IF;
 IF NEW.project_file_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.files f WHERE f.id = NEW.project_file_id AND f.project_id = NEW.project_id
 ) THEN
   RAISE EXCEPTION 'The file must belong to the deliverable project' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;

CREATE TRIGGER check_deliverable_source_scope
 BEFORE INSERT OR UPDATE OF task_id, project_file_id, project_id, workspace_id ON public.deliverables
 FOR EACH ROW EXECUTE FUNCTION public.check_deliverable_source_scope();

INSERT INTO storage.buckets (id, name, public, file_size_limit)
 VALUES ('deliverable-files', 'deliverable-files', false, 52428800);

CREATE POLICY "Read shared deliverable files" ON storage.objects FOR SELECT TO authenticated
 USING (
   bucket_id = 'deliverable-files'
   AND (
     public.can_contribute_project(
       CASE WHEN split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN split_part(name, '/', 1)::uuid END, auth.uid()
     )
     OR EXISTS (
       SELECT 1 FROM public.deliverables d
       WHERE d.attachment_path = storage.objects.name
         AND d.status <> 'draft'
         AND public.is_project_client(d.project_id, auth.uid())
     )
   )
 );
CREATE POLICY "Upload project deliverable files" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (
   bucket_id = 'deliverable-files'
   AND public.can_contribute_project(
     CASE WHEN split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN split_part(name, '/', 1)::uuid END, auth.uid()
   )
 );
CREATE POLICY "Clean up unlinked deliverable uploads" ON storage.objects FOR DELETE TO authenticated
 USING (
   bucket_id = 'deliverable-files'
   AND public.can_contribute_project(
     CASE WHEN split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN split_part(name, '/', 1)::uuid END, auth.uid()
   )
   AND NOT EXISTS (SELECT 1 FROM public.deliverables d WHERE d.attachment_path = storage.objects.name)
 );

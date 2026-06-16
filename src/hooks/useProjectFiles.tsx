import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const BUCKET = "project-files";

export interface ProjectFile {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

const db = supabase as unknown as { from: (t: string) => any };

/** Live project file storage backed by Supabase Storage + the `files` table. */
export function useProjectFiles(projectId: string | undefined) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(false);
    const { data, error } = await db
      .from("files")
      .select("id, name, storage_path, size_bytes, mime_type, uploaded_by, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) {
      setError(true);
      setLoading(false);
      return;
    }
    setFiles((data ?? []) as ProjectFile[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = useCallback(
    async (file: File) => {
      if (!projectId || !currentWorkspace) return;
      setUploading(true);
      // Path must start with projectId so storage RLS (split_part name '/' 1) matches.
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const path = `${projectId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) {
        setUploading(false);
        toast.error(upErr.message ?? "Upload failed");
        return;
      }
      const { error: rowErr } = await db.from("files").insert({
        project_id: projectId,
        workspace_id: currentWorkspace.id,
        name: file.name,
        storage_path: path,
        size_bytes: file.size,
        mime_type: file.type || null,
        uploaded_by: user?.id ?? null,
      });
      setUploading(false);
      if (rowErr) {
        // Roll back the orphaned object so storage and DB stay consistent.
        await supabase.storage.from(BUCKET).remove([path]);
        toast.error(rowErr.message ?? "Could not save file");
        return;
      }
      toast.success("File uploaded");
      await load();
    },
    [projectId, currentWorkspace, user, load],
  );

  const download = useCallback(async (f: ProjectFile) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(f.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Could not generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }, []);

  const remove = useCallback(
    async (f: ProjectFile) => {
      const { error: sErr } = await supabase.storage.from(BUCKET).remove([f.storage_path]);
      if (sErr) {
        toast.error("Could not delete file");
        return;
      }
      await db.from("files").delete().eq("id", f.id);
      toast.success("File deleted");
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
    },
    [],
  );

  return { files, loading, error, uploading, upload, download, remove, reload: load };
}

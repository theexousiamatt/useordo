import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const BUCKET = "project-files";

/** Hard limit for a single task attachment (50 MB). */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export interface TaskAttachment {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

// The regenerated types may briefly lag the `task_id` column, so use a
// loosely-typed client here (mirrors useProjectFiles).
const db = supabase as unknown as { from: (t: string) => any };

/**
 * Live attachment storage for a single task, backed by Supabase Storage and the
 * `files` table (scoped via `task_id`). Files share the project-files bucket so
 * existing storage RLS (folder = project id) keeps them workspace-isolated.
 */
export function useTaskAttachments(taskId: string | undefined, projectId: string | undefined) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(false);
    const { data, error } = await db
      .from("files")
      .select("id, name, storage_path, size_bytes, mime_type, uploaded_by, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    if (error) {
      setError(true);
      setLoading(false);
      return;
    }
    setAttachments((data ?? []) as TaskAttachment[]);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = useCallback(
    async (file: File) => {
      if (!taskId || !projectId || !currentWorkspace) return;
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error("File is too large (max 50 MB).");
        return;
      }
      setUploading(true);
      // Path must start with projectId so storage RLS (folder[1]) matches.
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
        task_id: taskId,
        workspace_id: currentWorkspace.id,
        name: file.name,
        storage_path: path,
        size_bytes: file.size,
        mime_type: file.type || null,
        uploaded_by: user?.id ?? null,
      });
      setUploading(false);
      if (rowErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        toast.error(rowErr.message ?? "Could not save attachment");
        return;
      }
      toast.success("Attachment added");
      await load();
    },
    [taskId, projectId, currentWorkspace, user, load],
  );

  const getSignedUrl = useCallback(
    async (f: TaskAttachment, expiresIn = 3600): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(f.storage_path, expiresIn);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
    [],
  );

  const download = useCallback(async (f: TaskAttachment) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(f.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Could not generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }, []);

  const remove = useCallback(async (f: TaskAttachment) => {
    const { error: sErr } = await supabase.storage.from(BUCKET).remove([f.storage_path]);
    if (sErr) {
      toast.error("Could not delete attachment");
      return;
    }
    await db.from("files").delete().eq("id", f.id);
    toast.success("Attachment removed");
    setAttachments((prev) => prev.filter((x) => x.id !== f.id));
  }, []);

  return { attachments, loading, error, uploading, upload, download, remove, reload: load };
}

import { useState } from "react";
import { ArrowDownToLine, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DELIVERABLE_FILE_BUCKET, type DeliverableSource } from "@/hooks/useProjectData";

export function deliverableLink(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) return url.href;
  } catch {
    // Show validation feedback through the form.
  }
  return null;
}

export function DeliverableAttachment({ source, projectId }: { source: DeliverableSource; projectId: string }) {
  const [busy, setBusy] = useState(false);
  const url = deliverableLink(source.attachment_url ?? "");
  const download = async () => {
    setBusy(true);
    try {
      let path = source.attachment_path;
      let name = source.attachment_name;
      let bucket = DELIVERABLE_FILE_BUCKET;
      if (source.project_file_id) {
        const { data, error } = await supabase.from("files").select("name, storage_path")
          .eq("id", source.project_file_id).eq("project_id", projectId).maybeSingle();
        if (error || !data) throw new Error("This project file is unavailable.");
        path = data.storage_path;
        name = data.name;
        bucket = "project-files";
      }
      if (!path) return;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60, { download: name || true });
      if (error || !data) throw new Error("Could not prepare this download.");
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.click();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download the file.");
    } finally {
      setBusy(false);
    }
  };

  if (url) return <a className="jerin-deliverable-source" href={url} rel="noopener noreferrer" target="_blank">
    <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />Open deliverable link
  </a>;
  if (!source.attachment_path && !source.project_file_id) return null;
  return <button type="button" className="jerin-deliverable-source" onClick={() => void download()} disabled={busy}>
    <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden="true" />
    <span className="min-w-0 break-words">{busy ? "Preparing download…" : source.attachment_name || "Download file"}</span>
  </button>;
}

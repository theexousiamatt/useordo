import { useRef } from "react";
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  Loader2,
  FileText,
  FileImage,
  FileArchive,
  File as FileIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBytes, timeAgo } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import {
  useTaskAttachments,
  type TaskAttachment,
} from "@/hooks/useTaskAttachments";

function iconFor(mime: string | null) {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("zip") || mime.includes("compressed") || mime.includes("tar")) return FileArchive;
  if (mime.includes("pdf") || mime.startsWith("text/") || mime.includes("document")) return FileText;
  return FileIcon;
}

/**
 * Task attachments — upload, list, download and remove files scoped to a task.
 * Backed by the project-files bucket + files table (task_id).
 */
export function TaskAttachmentsSection({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  const { user } = useAuth();
  const { attachments, loading, error, uploading, upload, download, remove } =
    useTaskAttachments(taskId, projectId);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => upload(f));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          Attachments
          {attachments.length > 0 && (
            <span className="text-muted-foreground/70">({attachments.length})</span>
          )}
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1 h-3.5 w-3.5" />
          )}
          Upload
        </Button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={onPick} />
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="rounded-card border border-dashed border-border p-4 text-xs text-muted-foreground">
          Couldn't load attachments. Try again later.
        </p>
      ) : attachments.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-1.5 rounded-card border border-dashed border-border p-6 text-center transition-colors hover:border-primary/40 hover:bg-black/[0.015]"
        >
          <Paperclip className="h-5 w-5 text-muted-foreground/60" />
          <span className="text-sm font-medium text-foreground">Add attachments</span>
          <span className="text-xs text-muted-foreground/70">
            Drag files here or click to upload (max 50 MB each)
          </span>
        </button>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              canDelete={a.uploaded_by === user?.id}
              onDownload={() => download(a)}
              onRemove={() => remove(a)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AttachmentRow({
  attachment,
  canDelete,
  onDownload,
  onRemove,
}: {
  attachment: TaskAttachment;
  canDelete: boolean;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const Icon = iconFor(attachment.mime_type);
  return (
    <li className="group flex items-center gap-3 rounded-card border border-border bg-card px-3 py-2.5 transition-shadow hover:shadow-subtle">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-small bg-black/5 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <button
        type="button"
        onClick={onDownload}
        className="min-w-0 flex-1 text-left"
        title={attachment.name}
      >
        <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatBytes(attachment.size_bytes)} · {timeAgo(attachment.created_at)}
        </p>
      </button>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onDownload}
          className="rounded-small p-1.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
          aria-label="Download attachment"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onRemove}
            className={cn(
              "rounded-small p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
              "opacity-0 group-hover:opacity-100 focus:opacity-100",
            )}
            aria-label="Remove attachment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

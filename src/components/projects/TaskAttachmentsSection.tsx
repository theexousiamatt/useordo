import { useCallback, useEffect, useRef, useState } from "react";
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  Loader2,
  FileText,
  FileImage,
  FileVideo,
  FileArchive,
  File as FileIcon,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatBytes, timeAgo } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import {
  useTaskAttachments,
  type TaskAttachment,
} from "@/hooks/useTaskAttachments";

type MediaKind = "image" | "pdf" | "video" | "other";

function kindOf(mime: string | null, name?: string): MediaKind {
  const m = mime ?? "";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.includes("pdf") || name?.toLowerCase().endsWith(".pdf")) return "pdf";
  return "other";
}

function iconFor(mime: string | null) {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
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
  const { attachments, loading, error, uploading, upload, download, remove, getSignedUrl } =
    useTaskAttachments(taskId, projectId);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ url: string; name: string; kind: MediaKind } | null>(
    null,
  );

  // Resolve signed URLs for previewable attachments (image, pdf, video).
  useEffect(() => {
    let cancelled = false;
    const previewable = attachments.filter(
      (a) => kindOf(a.mime_type, a.name) !== "other",
    );
    previewable.forEach(async (a) => {
      if (previews[a.id]) return;
      const url = await getSignedUrl(a);
      if (!cancelled && url) setPreviews((prev) => ({ ...prev, [a.id]: url }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments, getSignedUrl]);
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);

  const uploadFiles = useCallback(
    (files: File[]) => {
      files.filter(Boolean).forEach((f) => upload(f));
    },
    [upload],
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(Array.from(e.target.files ?? []));
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDragEnter = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files ?? []));
  };

  // Paste-to-upload: when the section (or anything inside it) is focused/active,
  // capture pasted files & images from the clipboard.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as Node | null;
      const active = document.activeElement;
      // Ignore pastes into text fields (e.g. description / comments).
      if (
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return;
      }
      if (target && !el.contains(target)) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length === 0) return;
      e.preventDefault();
      uploadFiles(files);
    };
    el.addEventListener("paste", onPaste);
    return () => el.removeEventListener("paste", onPaste);
  }, [uploadFiles]);

  return (
    <section
      ref={sectionRef}
      tabIndex={0}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative rounded-card outline-none transition-colors",
        dragOver && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
      )}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-primary/50 bg-card/90 backdrop-blur-sm">
          <Upload className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-foreground">Drop files to upload</span>
          <span className="text-xs text-muted-foreground/70">Max 50 MB each</span>
        </div>
      )}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
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
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">Add files</span>
            <span className="block text-xs text-muted-foreground">Drop, paste or browse · 50 MB max each</span>
          </span>
          <Upload className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
        </button>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              previewUrl={previews[a.id]}
              canDelete={a.uploaded_by === user?.id}
              onDownload={() => download(a)}
              onRemove={() => remove(a)}
              onPreview={
                previews[a.id]
                  ? () =>
                      setLightbox({
                        url: previews[a.id],
                        name: a.name,
                        kind: kindOf(a.mime_type, a.name),
                      })
                  : undefined
              }
            />
          ))}
        </ul>
      )}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl border-border bg-card p-2">
          <DialogTitle className="sr-only">{lightbox?.name ?? "Attachment preview"}</DialogTitle>
          {lightbox?.kind === "image" && (
            <img
              src={lightbox.url}
              alt={lightbox.name}
              className="mx-auto max-h-[80vh] w-auto rounded-small object-contain"
            />
          )}
          {lightbox?.kind === "video" && (
            <video
              src={lightbox.url}
              controls
              autoPlay
              className="mx-auto max-h-[80vh] w-full rounded-small bg-black"
            />
          )}
          {lightbox?.kind === "pdf" && (
            <iframe
              src={lightbox.url}
              title={lightbox.name}
              className="h-[80vh] w-full rounded-small border-0 bg-white"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AttachmentRow({
  attachment,
  previewUrl,
  canDelete,
  onDownload,
  onRemove,
  onPreview,
}: {
  attachment: TaskAttachment;
  previewUrl?: string;
  canDelete: boolean;
  onDownload: () => void;
  onRemove: () => void;
  onPreview?: () => void;
}) {
  const Icon = iconFor(attachment.mime_type);
  const kind = kindOf(attachment.mime_type, attachment.name);
  const canPreview = !!previewUrl && kind !== "other";
  return (
    <li className="group flex items-center gap-3 rounded-card border border-border bg-card px-3 py-2.5 transition-shadow hover:shadow-subtle">
      {canPreview ? (
        <button
          type="button"
          onClick={onPreview}
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-small bg-black/5 ring-1 ring-border transition-opacity hover:opacity-80"
          aria-label={`Preview ${kind}`}
        >
          {kind === "image" && (
            <img src={previewUrl} alt={attachment.name} className="h-full w-full object-cover" />
          )}
          {kind === "video" && (
            <>
              <video src={previewUrl} muted preload="metadata" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                <Play className="h-4 w-4" />
              </span>
            </>
          )}
          {kind === "pdf" && (
            <span className="flex h-full w-full items-center justify-center bg-destructive/10 text-destructive">
              <FileText className="h-4 w-4" />
            </span>
          )}
        </button>
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-small bg-black/5 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
      )}
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

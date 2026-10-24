import { useRef } from "react";
import { FileUp, Download, Trash2, File as FileIcon, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/EmptyState";
import { LoadingList } from "@/components/states/LoadingState";
import { ErrorState } from "@/components/states/ErrorState";
import { useProjectFiles } from "@/hooks/useProjectFiles";
import { dateShort } from "@/lib/format";

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function FilesTab({ projectId, readOnly = false }: { projectId: string; readOnly?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { files, loading, error, uploading, upload, download, remove, reload } =
    useProjectFiles(projectId);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Files shared on this project. Access is limited to people on this project.
        </p>
        {!readOnly && <input ref={inputRef} type="file" className="hidden" onChange={onPick} />}
        {!readOnly && <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="mr-1.5 h-4 w-4" />
          )}
          Upload file
        </Button>}
      </div>

      {loading ? (
        <LoadingList rows={4} />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : files.length === 0 ? (
        <EmptyState
          icon={FileIcon}
          title="No files yet"
          description={readOnly ? "Files will appear here when your agency shares them." : "Upload deliverables, briefs, and assets to keep everything in one place."}
          actionLabel={readOnly ? undefined : "Upload a file"}
          onAction={readOnly ? undefined : () => inputRef.current?.click()}
        />
      ) : (
        <Card className="divide-y divide-border">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-small bg-muted">
                <FileIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(f.size_bytes)} • {dateShort(f.created_at)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => download(f)} aria-label="Download">
                <Download className="h-4 w-4" />
              </Button>
              {!readOnly && <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(f)}
                aria-label="Delete"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

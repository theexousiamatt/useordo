import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { formatBytes, timeAgo } from "@/lib/format";

export default function Files() {
  const { data: files = [] } = useQuery({
    queryKey: ["all-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files").select("*, projects(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Array<{ id: string; project_id: string; name: string; storage_path: string; size_bytes: number | null; created_at: string; projects: { name: string } | null }>;
    },
  });

  const download = async (path: string, name: string) => {
    const { data } = await supabase.storage.from("project-files").createSignedUrl(path, 60);
    if (!data) return;
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.click();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
        <p className="text-sm text-muted-foreground mt-1">All deliverables across your projects.</p>
      </div>

      {files.length === 0 ? (
        <Card className="p-10 border-dashed border-border text-center text-sm text-muted-foreground">
          No files yet.
        </Card>
      ) : (
        <Card className="border-border/50 divide-y divide-border">
          {files.map((f) => (
            <div key={f.id} className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary/40 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{f.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  {f.projects && (
                    <Link to={`/projects/${f.project_id}`} className="hover:text-primary">{f.projects.name}</Link>
                  )}
                  <span>·</span>
                  <span>{formatBytes(f.size_bytes)}</span>
                  <span>·</span>
                  <span>{timeAgo(f.created_at)}</span>
                </div>
              </div>
              <button onClick={() => download(f.storage_path, f.name)} className="text-xs text-primary hover:underline">
                Download
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

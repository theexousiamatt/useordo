import { useEffect, useState, useCallback } from "react";
import { Activity as ActivityIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingList } from "@/components/states/LoadingState";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/format";

interface Log {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const describe = (log: Log): string => {
  const m = log.metadata as any;
  switch (log.action) {
    case "workspace.created": return `Workspace "${m?.name ?? ""}" was created`;
    case "members.invited": return `Invited ${(m?.emails?.length ?? 0)} member(s)`;
    default: return log.action.replace(/[._]/g, " ");
  }
};

export default function ActivityPage() {
  const { currentWorkspace } = useWorkspace();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    setError(false);
    const { data, error } = await supabase
      .from("activity_logs")
      .select("id, action, metadata, created_at")
      .eq("workspace_id", currentWorkspace.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { setError(true); setLoading(false); return; }
    setLogs((data ?? []) as Log[]);
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader title="Activity" description="A chronological trail of everything happening here." />

      {loading ? (
        <LoadingList rows={5} />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity yet"
          description="As you and your team work, every meaningful change is recorded here."
        />
      ) : (
        <Card className="divide-y divide-border">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-4">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{describe(log)}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(log.created_at)}</p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

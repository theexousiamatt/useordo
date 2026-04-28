import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { activityLabel } from "@/lib/activity";
import { timeAgo } from "@/lib/format";

export default function ActivityPage() {
  const { data: items = [] } = useQuery({
    queryKey: ["activity-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity").select("*, projects(name)").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Array<{ id: string; project_id: string; type: string; payload: Record<string, unknown>; created_at: string; projects: { name: string } | null }>;
    },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">Everything happening across your projects.</p>
      </div>

      {items.length === 0 ? (
        <Card className="p-10 border-dashed border-border text-center text-sm text-muted-foreground">
          Nothing yet.
        </Card>
      ) : (
        <Card className="border-border/50 divide-y divide-border">
          {items.map((a) => (
            <div key={a.id} className="p-4 flex items-start gap-4">
              <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm">{activityLabel(a)}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  {a.projects && (
                    <Link to={`/projects/${a.project_id}`} className="hover:text-primary">{a.projects.name}</Link>
                  )}
                  <span>·</span>
                  <span>{timeAgo(a.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

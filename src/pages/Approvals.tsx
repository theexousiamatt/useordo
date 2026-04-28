import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ApprovalActions } from "@/components/ApprovalActions";
import { dateShort } from "@/lib/format";

export default function Approvals() {
  const { data: tasks = [] } = useQuery({
    queryKey: ["awaiting-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(name)")
        .eq("status", "awaiting_approval")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Array<{ id: string; project_id: string; title: string; description: string | null; due_date: string | null; projects: { name: string } | null }>;
    },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">Tasks waiting for your decision.</p>
      </div>

      {tasks.length === 0 ? (
        <Card className="p-10 border-dashed border-border text-center">
          <p className="text-sm text-muted-foreground">You're all caught up — nothing waiting on you.</p>
        </Card>
      ) : (
        <Card className="border-border/50 divide-y divide-border">
          {tasks.map((t) => (
            <div key={t.id} className="p-5 flex flex-wrap items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{t.title}</div>
                {t.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-3">
                  {t.projects && (
                    <Link to={`/projects/${t.project_id}`} className="text-primary hover:underline">
                      {t.projects.name}
                    </Link>
                  )}
                  <span>Due {dateShort(t.due_date)}</span>
                </div>
              </div>
              <ApprovalActions task={t} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

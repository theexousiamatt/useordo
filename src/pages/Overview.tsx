import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, ProjectStatus } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { FolderKanban, CheckCircle2, AlertTriangle, FileText, ArrowRight } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { activityLabel } from "@/lib/activity";

export default function Overview() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingApprovals = 0 } = useQuery({
    queryKey: ["pending-approvals-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tasks").select("*", { count: "exact", head: true })
        .eq("status", "awaiting_approval");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: filesCount = 0 } = useQuery({
    queryKey: ["files-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("files").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["activity-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity").select("*").order("created_at", { ascending: false }).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const active = projects.filter((p) => p.status !== "done").length;
  const atRisk = projects.filter((p) => p.status === "at_risk" || p.status === "blocked").length;

  const kpis = [
    { label: "Active projects", value: active, icon: FolderKanban, accent: "text-primary" },
    { label: "Pending approvals", value: pendingApprovals, icon: CheckCircle2, accent: "text-warning" },
    { label: "At risk", value: atRisk, icon: AlertTriangle, accent: "text-destructive" },
    { label: "Files", value: filesCount, icon: FileText, accent: "text-success" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Your projects at a glance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4 surface-gradient border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{k.label}</span>
              <k.icon className={`h-4 w-4 ${k.accent}`} />
            </div>
            <div className="text-2xl font-semibold mt-2 tabular-nums">{k.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Project progress</h2>
            <Link to="/projects" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {projects.length === 0 ? (
            <EmptyState text="No projects yet. They'll appear here as your team adds them." />
          ) : (
            <div className="space-y-4">
              {projects.slice(0, 5).map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="block group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate group-hover:text-primary transition">{p.name}</span>
                      <StatusBadge status={p.status as ProjectStatus} />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} className="h-1.5" />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent activity</h2>
            <Link to="/activity" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {activity.length === 0 ? (
            <EmptyState text="Updates will appear here." />
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="text-sm">
                  <div className="text-foreground/90">{activityLabel(a)}</div>
                  <div className="text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-lg">
      {text}
    </div>
  );
}

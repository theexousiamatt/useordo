import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, ProjectStatus } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { dateShort } from "@/lib/format";
import { CalendarDays } from "lucide-react";

export default function Projects() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground mt-1">All projects you have access to.</p>
      </div>

      {isLoading ? null : projects.length === 0 ? (
        <Card className="p-10 border-dashed border-border text-center">
          <p className="text-sm text-muted-foreground">No projects yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`}>
              <Card className="p-5 surface-gradient border-border/50 hover:border-primary/40 transition group h-full">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold group-hover:text-primary transition">{p.name}</h3>
                  <StatusBadge status={p.status as ProjectStatus} />
                </div>
                {p.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{p.description}</p>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="tabular-nums">{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} className="h-1.5" />
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Due {dateShort(p.due_date)}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

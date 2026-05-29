import { FolderKanban, CheckSquare, Activity, Users, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { useWorkspace } from "@/hooks/useWorkspace";

const stats = [
  { label: "Active Projects", value: 0, icon: FolderKanban, hint: "No projects yet" },
  { label: "Upcoming Tasks", value: 0, icon: CheckSquare, hint: "Nothing due" },
  { label: "Recent Activity", value: 0, icon: Activity, hint: "All quiet" },
  { label: "Team Members", value: 1, icon: Users, hint: "Just you, for now" },
];

export default function Dashboard() {
  const { currentWorkspace } = useWorkspace();

  return (
    <div>
      <PageHeader
        title={`Welcome${currentWorkspace ? ` to ${currentWorkspace.name}` : ""}`}
        description="Here's a calm overview of what's happening across your workspace."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{s.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-medium">Recent Activity</h2>
          <p className="mb-4 text-xs text-muted-foreground">What's been happening lately.</p>
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Once you start creating projects and tasks, updates will show up here."
          />
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-medium">Team Activity</h2>
          <p className="mb-4 text-xs text-muted-foreground">Stay in sync with your team.</p>
          <EmptyState
            icon={Sparkles}
            title="Your team is quiet"
            description="Invite teammates to start collaborating inside your workspace."
          />
        </Card>
      </div>
    </div>
  );
}

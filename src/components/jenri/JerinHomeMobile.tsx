import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OrdoSidebar } from "@/components/OrdoSidebar";
import { NotificationButton } from "@/components/client/NotificationButton";
import { MemberAvatars } from "@/components/projects/MemberAvatars";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { dateShort } from "@/lib/format";
import { buildStudioOverview, type StudioTask } from "@/lib/studioDashboard";
import "@/styles/jenri-home.css";

type Overview = ReturnType<typeof buildStudioOverview>;
interface Props {
  workspaceName: string;
  overview: Overview | null;
  tasks: StudioTask[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

const covers: Record<string, string> = {
  "ivy website": "/jenri/projects/ivy-cover.svg",
  "velmont": "/jenri/projects/velmont-cover.svg",
  "tiana gift shop": "/jenri/projects/tiana-cover.svg",
  "devine apartment": "/jenri/projects/devine-cover.svg",
};


/** Personal assignments include both multi-member and legacy single-assignee tasks. */
function useAssignedTaskCount(tasks: StudioTask[]) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { data } = useQuery({
    queryKey: ["jenri-home-assigned", workspaceId, user?.id],
    enabled: !!workspaceId && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const [multiple, legacy] = await Promise.all([
        supabase.from("task_assignees").select("task_id")
          .eq("workspace_id", workspaceId!).eq("user_id", user!.id),
        supabase.from("tasks").select("id")
          .eq("workspace_id", workspaceId!).eq("assignee_id", user!.id)
          .is("completed_at", null).is("archived_at", null),
      ]);
      if (multiple.error) throw multiple.error;
      if (legacy.error) throw legacy.error;
      return Array.from(new Set([
        ...(multiple.data ?? []).map((entry) => entry.task_id),
        ...(legacy.data ?? []).map((entry) => entry.id),
      ]));
    },
  });
  return useMemo(() => {
    if (!data) return null;
    const assigned = new Set(data);
    return tasks.filter((task) => assigned.has(task.id) && !task.completed_at && !task.archived_at).length;
  }, [data, tasks]);
}

function ProjectCarousel({ overview }: { overview: Overview }) {
  const navigate = useNavigate();
  const { data: memberProjects = [] } = useProjects();
  const projects = overview.featuredProjects.slice(0, 8);

  if (!projects.length) return (
    <div className="jhm-project-empty">
      <FolderKanban size={27} strokeWidth={1.5} aria-hidden="true" />
      <h3>No active projects yet</h3>
      <p>Start a project to see its progress here.</p>
      <button type="button" onClick={() => window.dispatchEvent(new Event("jerin:open-create"))}>
        Create a project
      </button>
    </div>
  );

  return <div className="jhm-carousel" role="region" aria-label="Active projects carousel" tabIndex={0}>
    {projects.map((project) => {
      const progress = overview.projectProgress(project.id);
      const members = memberProjects.find((item) => item.id === project.id)?.members ?? [];
      const cover = covers[project.name.trim().toLowerCase()];
      const approvalCount = overview.pendingApprovals.filter((item) => item.project_id === project.id).length;
      const remaining = Math.max(0, progress.total - progress.completed);
      return <article className="jhm-project-card" key={project.id}>
        <div className="jhm-card-top">
          <button type="button" className="jhm-card-title-action" onClick={() => navigate("/projects/" + project.id)}>
            {cover ? <img src={cover} className="jhm-cover" alt="" loading="lazy" /> :
              <span className="jhm-cover jhm-cover-placeholder"><FolderKanban size={24} strokeWidth={1.5} aria-hidden="true" /></span>}
            <span className="jhm-card-heading">
              <strong>{project.name}</strong>
              <small>{approvalCount > 0 ? approvalCount + " pending approval" + (approvalCount === 1 ? "" : "s") :
                remaining > 0 ? remaining + " tasks remaining" : "No pending approvals"}</small>
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="jhm-options" type="button" aria-label={"Actions for " + project.name}>
                <img src="/jenri/projects/more.svg" alt="" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate("/projects/" + project.id)}>Open project</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/projects/" + project.id + "?tab=activity")}>View activity</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => {
                void navigator.clipboard.writeText(window.location.origin + "/projects/" + project.id)
                  .then(() => toast.success("Project link copied"))
                  .catch(() => toast.error("Couldn't copy the link"));
              }}>Copy link</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="jhm-members">
          {members.length ? <MemberAvatars members={members} max={3} /> :
            <span className="jhm-members-empty">Your project team</span>}
        </div>
        <div className="jhm-progress">
          <div className="jhm-progress-head"><span>Progress</span><strong>{progress.percent}%</strong></div>
          <div className="jhm-track" role="progressbar" aria-label={project.name + " progress"}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
            <span style={{ width: progress.percent + "%" }} />
          </div>
        </div>
        <div className="jhm-card-end">
          <span className="jhm-due">{project.due_date ? "•  Due " + dateShort(project.due_date) : "No due date"}</span>
        </div>
      </article>;
    })}
  </div>;
}

export function JerinHomeMobile({ workspaceName, overview, tasks, isLoading, isError, onRetry }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const assignedCount = useAssignedTaskCount(tasks);
  const dueProjects = overview?.upcoming.filter((item) => item.kind === "project" && item.days_until <= 7).length ?? 0;
  const dueTasks = overview?.upcoming.filter((item) => item.kind === "task" && item.days_until <= 7).length ?? 0;
  const stats = [
    { label: "Active Projects", value: overview?.activeProjects.length ?? 0, path: "/projects" },
    { label: "Due This Week", value: dueProjects, path: "/projects" },
    { label: "Assigned Tasks", value: assignedCount, path: "/tasks" },
    { label: "Due Tasks", value: dueTasks, path: "/tasks" },
  ];

  return <div className="jhm-shell" aria-label="Workspace dashboard">
    <header className="jhm-header">
      <img className="jhm-brand" src="/jenri/jerin-logo-light-surface.svg" width={110} height={38} alt="Jerin" />
      <div className="jhm-header-actions">
        <div className="jhm-notifications"><NotificationButton /></div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild><button type="button" className="jhm-menu" aria-label="Open workspace menu">
            <img src="/jenri/projects/menu.svg" alt="" />
          </button></SheetTrigger>
          <SheetContent side="right" className="client-os jerin-navigation-sheet w-[280px] border-none p-0" overlayClassName="bg-[#351001]/80">
            <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
            <OrdoSidebar onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </header>
    <main className="jhm-main">
      <section className="jhm-overview-panel" aria-label="Your workspace">
        <div className="jhm-overview-head">
          <span>Your Workspace</span>
          <h1>{workspaceName}</h1>
        </div>
        <div className="jhm-stat-grid">
          {stats.map((stat, index) => <Link to={stat.path} key={stat.label}
            className={"jhm-stat jhm-stat-" + index}>
            <span>{stat.label}</span>
            <strong>{isLoading ? "–" : stat.value === null ? "–" : stat.value}</strong>
          </Link>)}
        </div>
      </section>
      <section className="jhm-projects-section" aria-labelledby="jhm-projects-heading">
        <div className="jhm-projects-header">
          <h2 id="jhm-projects-heading">Active projects</h2>
          <Link to="/projects">See all</Link>
        </div>
        {isLoading ? <div className="jhm-project-loading" role="status">Loading projects…</div> :
          isError || !overview ? <div className="jhm-project-loading" role="alert">
            Couldn't load projects. <button type="button" onClick={onRetry}>Try again</button>
          </div> : <ProjectCarousel overview={overview} />}
      </section>
    </main>
  </div>;
}

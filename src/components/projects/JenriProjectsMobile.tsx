import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban } from "lucide-react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { OrdoSidebar } from "@/components/OrdoSidebar";
import { NotificationButton } from "@/components/client/NotificationButton";
import { MemberAvatars } from "@/components/projects/MemberAvatars";
import { ProjectOverflowMenu, type ProjectMenuHandlers } from "@/components/projects/ProjectActionsMenu";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectWithMembers } from "@/hooks/useProjects";
import "@/styles/jenri-projects.css";

export type JenriProjectFilter = "ongoing" | "on_hold" | "completed" | "archived";

interface Props {
  projects: ProjectWithMembers[];
  filter: JenriProjectFilter;
  onFilterChange: (filter: JenriProjectFilter) => void;
  onCreate: () => void;
  onOpen: (project: ProjectWithMembers) => void;
  onRetry: () => void;
  handlers: ProjectMenuHandlers;
  isLoading: boolean;
  isError: boolean;
}

const covers: Record<string, string> = {
  "ivy website": "/jenri/projects/ivy-cover.svg",
  "velmont": "/jenri/projects/velmont-cover.svg",
  "tiana gift shop": "/jenri/projects/tiana-cover.svg",
  "devine apartment": "/jenri/projects/devine-cover.svg",
};
const tabs = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Projects", href: "/projects", icon: "projects" },
  { label: "Tasks", href: "/tasks", icon: "tasks" },
  { label: "Inbox", href: "/inbox", icon: "inbox" },
];

function filterMatches(project: ProjectWithMembers, filter: JenriProjectFilter) {
  if (filter === "archived") return !!project.archived_at;
  if (project.archived_at) return false;
  if (filter === "completed") return project.status === "completed";
  if (filter === "on_hold") return project.status === "on_hold";
  return project.status === "active" || project.status === "draft";
}

function projectState(project: ProjectWithMembers): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (project.archived_at || project.status === "archived") return { label: "Archived", tone: "neutral" };
  if (project.status === "completed") return { label: "Completed", tone: "success" };
  if (project.status === "on_hold") return { label: "On Hold", tone: "warning" };
  if (project.status === "draft") return { label: "Planning", tone: "neutral" };
  if (project.health === "blocked") return { label: "Blocked", tone: "danger" };
  if (project.health === "at_risk") return { label: "At risk", tone: "warning" };
  return { label: "On track", tone: "success" };
}

function shortDueDate(value: string) {
  const date = new Date(value.slice(0, 10) + "T12:00:00");
  return Number.isNaN(date.getTime()) ? "" : format(date, "MMM d");
}

/** Uses workspace RLS; only actual task records contribute to the displayed counts. */
function useProjectTaskCounts(projects: ProjectWithMembers[]) {
  const ids = projects.map((project) => project.id);
  const workspaceId = projects[0]?.workspace_id;
  return useQuery({
    queryKey: ["jenri-project-list-task-counts", workspaceId, ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const result: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
      // Paginate so counts remain accurate beyond Supabase's 1,000-row default limit.
      for (let start = 0; ; start += 1000) {
        const { data, error } = await supabase
          .from("tasks")
          .select("project_id")
          .in("project_id", ids)
          .range(start, start + 999);
        if (error) throw error;
        for (const row of data ?? []) {
          if (row.project_id) result[row.project_id] = (result[row.project_id] ?? 0) + 1;
        }
        if (!data || data.length < 1000) break;
      }
      return result;
    },
  });
}

function MobileProjectCard({
  project, count, onOpen, handlers,
}: {
  project: ProjectWithMembers;
  count: number | undefined;
  onOpen: () => void;
  handlers: ProjectMenuHandlers;
}) {
  const permissions = useProjectPermissions(project);
  const status = projectState(project);
  const cover = covers[project.name.trim().toLowerCase()];
  const tasksText = typeof count === "number"
    ? `${count} ${count === 1 ? "task" : "tasks"}`
    : `${project.progress}% complete`;
  const dateText = project.due_date ? `  ·  Due ${shortDueDate(project.due_date)}` : "";

  return <article className="jenri-project-card" data-project-id={project.id}>
    <button type="button" className="jenri-project-card-open"
      onClick={onOpen} aria-label={`Open ${project.name}`}>
      {cover ? (
        <img className="jenri-project-cover" src={cover} alt="" loading="lazy" />
      ) : (
        <span className="jenri-project-cover jenri-project-cover-fallback" aria-hidden="true">
          <FolderKanban size={28} strokeWidth={1.65} />
        </span>
      )}
      <div className="jenri-project-details">
        <span className="jenri-project-name" title={project.name}>{project.name}</span>
        <span className={`jenri-project-status jenri-project-status-${status.tone}`}>
          <span className="jenri-project-status-dot" />{status.label}
        </span>
        <span className="jenri-project-meta">{tasksText}{dateText}</span>
        <div className="jenri-project-members">
          {project.members.length ? <MemberAvatars members={project.members} size="sm" max={3} /> : <span className="jenri-project-no-members">No teammates yet</span>}
        </div>
      </div>
    </button>
    <div className="jenri-project-menu">
      <ProjectOverflowMenu
        project={project}
        perms={permissions}
        handlers={handlers}
        trigger={
          <button type="button" className="jenri-project-options" aria-label={`Actions for ${project.name}`}>
            <img src="/jenri/projects/more.svg" alt="" />
          </button>
        }
      />
    </div>
  </article>;
}

export function JenriProjectsMobile({
  projects, filter, onFilterChange, onCreate, onOpen, onRetry, handlers, isLoading, isError,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: taskCounts } = useProjectTaskCounts(projects);
  const visible = projects.filter((project) => filterMatches(project, filter));
  const availableFilters: { value: JenriProjectFilter; label: string }[] = [
    { value: "ongoing", label: "Ongoing" },
    { value: "on_hold", label: "On Hold" },
    { value: "completed", label: "Completed" },
    { value: "archived", label: "Archived" },
  ];

  return <section className="jenri-projects-mobile" aria-label="Projects">
    <header className="jenri-projects-header">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <button type="button" className="jenri-projects-icon-button jenri-projects-menu-trigger" aria-label="Open workspace navigation">
            <img src="/jenri/projects/menu.svg" alt="" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] border-none bg-transparent p-0">
          <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
          <OrdoSidebar onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
      <img className="jenri-projects-brand" src="/jenri/jenri-logo.svg" alt="Jerin" />
      <div className="jenri-projects-notification"><NotificationButton /></div>
    </header>

    <div className="jenri-projects-heading">
      <h1>Projects</h1>
      <p>All your work, in one place.</p>
      <button type="button" className="jenri-projects-add-button" aria-label="Create project" onClick={onCreate}>
        <img src="/jenri/projects/add.svg" alt="" />
      </button>
    </div>

    <div className="jenri-projects-filters" role="group" aria-label="Filter projects">
      {availableFilters.map((option) => (
        <button key={option.value} type="button"
          className={`jenri-projects-filter${option.value === filter ? " is-selected" : ""}`}
          onClick={() => onFilterChange(option.value)}
          aria-pressed={option.value === filter}
        >{option.label}</button>
      ))}
    </div>

    <div className="jenri-projects-list" aria-live="polite">
      {isLoading ? (
        <div className="jenri-projects-state" role="status">Loading your projects…</div>
      ) : isError ? (
        <div className="jenri-projects-state" role="alert">
          Couldn't load projects. <button type="button" onClick={onRetry}>Try again</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="jenri-projects-state">
          <FolderKanban size={26} strokeWidth={1.5} aria-hidden="true" />
          <h2>No {filter === "ongoing" ? "ongoing" : filter === "on_hold" ? "on-hold" : filter} projects</h2>
          <p>{filter === "ongoing" ? "Create your first project to get started." : "Your projects will appear here when their status changes."}</p>
          {filter === "ongoing" && <button type="button" onClick={onCreate}>Create project</button>}
        </div>
      ) : visible.map((project) => (
        <MobileProjectCard key={project.id} project={project} count={taskCounts?.[project.id]}
          onOpen={() => onOpen(project)} handlers={handlers} />
      ))}
    </div>

    <nav className="jenri-projects-bottom-nav" aria-label="Mobile navigation">
      {tabs.map((tab) => (
        <NavLink key={tab.href} to={tab.href} end={tab.href === "/"}
          className={({ isActive }) => `jenri-projects-nav-tab${isActive ? " is-active" : ""}`}>
          <img src={`/jenri/projects/${tab.icon}.svg`} alt="" />
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  </section>;
}

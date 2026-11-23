import { format, parseISO } from "date-fns";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorkTasks } from "@/hooks/useWorkTasks";
import { filterWorkTasks } from "@/lib/myTasks";
import { FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OrdoSidebar } from "@/components/OrdoSidebar";
import { NotificationButton } from "@/components/client/NotificationButton";
import { MemberAvatars } from "@/components/projects/MemberAvatars";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { projectCover, projectCoverUrl } from "@/lib/projectCovers";
import { buildStudioOverview } from "@/lib/studioDashboard";
import "@/styles/jenri-home.css";

type Overview = ReturnType<typeof buildStudioOverview>;
interface Props {
  workspaceName: string;
  overview: Overview | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

const homeAssets = "/jenri/home/";

function Attention({ overview, from }: { overview: Overview | null; from: string }) {
  const overdue = overview?.overdueTasks.length;
  const revisions = overview?.changesRequested.length;
  return <section className="jhm-attention" aria-labelledby="jhm-attention-heading">
    <h2 id="jhm-attention-heading">Needs attention</h2>
    <div className="jhm-attention-list">
      <Link className="jhm-attention-row" to={`/tasks?view=overdue&assignee=all&from=${from}`}>
        <span className="jhm-attention-icon jhm-overdue-icon"><img src={homeAssets + "overdue.png"} alt="" /></span>
        <span>
          <strong>{overdue ? `${overdue} Overdue ${overdue === 1 ? "task" : "tasks"}` : "Overdue tasks"}</strong>
          <small>{overdue === undefined ? "Checking task deadlines…" : overdue > 0 ? "Review tasks past their due date." : "Nothing overdue. You’re all caught up."}</small>
        </span>
      </Link>
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="jhm-attention-row">
            <span className="jhm-attention-icon jhm-revisions-icon"><img src={homeAssets + "changes-requested.png"} alt="" /></span>
            <span>
              <strong>Changes requested</strong>
              <small>{revisions === undefined ? "Checking client feedback…" : revisions ? `${revisions} ${revisions === 1 ? "deliverable needs" : "deliverables need"} revisions.` : "No deliverables need revisions."}</small>
            </span>
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogTitle>Changes requested</DialogTitle>
          <DialogDescription>Deliverables that clients have sent back for revision.</DialogDescription>
          {overview?.changesRequested.length ? <ul className="divide-y divide-border">
            {overview.changesRequested.map(item => <li key={item.id}>
              <Link className="block rounded-lg px-3 py-3 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                to={`/projects/${item.project_id}?tab=deliverables&deliverable=${item.id}`}>
                <strong className="block break-words text-sm">{item.title}</strong>
                <span className="text-sm text-muted-foreground">{overview.projectName(item.project_id)}</span>
              </Link>
            </li>)}
          </ul> : <p role="status" className="text-sm">{overview ? "You’re all caught up." : "Client feedback is currently unavailable."}</p>}
        </DialogContent>
      </Dialog>
    </div>
  </section>;
}

function ProjectCarousel({ overview }: { overview: Overview }) {
  const navigate = useNavigate();
  const { data: memberProjects = [] } = useProjects();
  const { user } = useAuth();
  const workspacePermissions = useProjectPermissions();
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
      const membership = memberProjects.find((item) => item.id === project.id);
      const members = membership?.members ?? [];
      const canManage = workspacePermissions.canManage || (!!user && membership?.owner_id === user.id);
      const cover = projectCoverUrl(projectCover(project.id, project.cover_image_key));
      const approvalCount = overview.pendingApprovals.filter((item) => item.project_id === project.id).length;
      return <article className="jhm-project-card" key={project.id}>
        <div className="jhm-card-top">
          <button type="button" className="jhm-card-title-action" onClick={() => navigate("/projects/" + project.id)}>
            <img src={cover} className="jhm-cover" alt="" loading="lazy" />
            <span className="jhm-card-heading">
              <strong>{project.name}</strong>
              <small>{approvalCount > 0 ? approvalCount + " pending approval" + (approvalCount === 1 ? "" : "s") : "No pending approvals"}</small>
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="jhm-options" type="button" aria-label={"Actions for " + project.name}>
                <img src="/jenri/home/project-options.svg" alt="" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate("/projects/" + project.id)}>Open project</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/projects/" + project.id + "?tab=activity")}>View activity</DropdownMenuItem>
              {canManage && <DropdownMenuItem onSelect={() => navigate("/projects/" + project.id + "?settings=cover")}>Change cover</DropdownMenuItem>}
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
          <span className="jhm-due">{project.due_date ? "•  Due " + format(parseISO(project.due_date), "MMM d") : "No due date"}</span>
        </div>
      </article>;
    })}
  </div>;
}

export function JerinHomeMobile({ workspaceName, overview, isLoading, isError, onRetry }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const { data: taskData } = useWorkTasks();
  const now = new Date();
  const assignedCount = taskData ? filterWorkTasks(taskData.tasks, taskData.assignees, user?.id, "open", true, now).length : null;
  const from = format(now, "yyyy-MM-dd");
  const stats = [
    { label: "Active Projects", value: overview?.activeProjects.length ?? null, path: "/projects?view=active" },
    { label: "Assigned Tasks", value: assignedCount, path: "/tasks?view=open&assignee=me" },
  ];

  return <div className="jhm-shell" aria-label="Workspace dashboard">
    <header className="jhm-header">
      <img className="jhm-brand" src="/jenri/home/mark.svg" width={29} height={38} alt="Jerin" />
      <div className="jhm-header-actions">
        <div className="jhm-notifications"><NotificationButton icon={homeAssets + "bell.svg"} /></div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild><button type="button" className="jhm-menu" aria-label="Open workspace menu">
            <img src="/jenri/home/menu.svg" alt="" />
          </button></SheetTrigger>
          <SheetContent side="left" className="client-os jerin-navigation-sheet w-[280px] border-none p-0" overlayClassName="bg-[#351001]/80">
            <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
            <OrdoSidebar onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </header>
    <div className="jhm-main">
      <section className="jhm-overview-panel" aria-label="Your workspace">
        <div className="jhm-overview-head">
          <span>Your Workspace</span>
          <h1>{workspaceName}</h1>
        </div>
        <div className="jhm-stat-grid">
          {stats.map((stat) => <Link to={stat.path} key={stat.label}
            className="jhm-stat">
            <span>{stat.label}</span>
            <strong>{isLoading ? "–" : stat.value === null ? "–" : stat.value}</strong>
          </Link>)}
        </div>
      </section>
      <Attention overview={overview} from={from} />
      <section className="jhm-projects-section" aria-labelledby="jhm-projects-heading">
        <div className="jhm-projects-header">
          <h2 id="jhm-projects-heading">Active projects</h2>
          <Link to="/projects?view=active">See all</Link>
        </div>
        {isLoading ? <div className="jhm-project-loading" role="status">Loading projects…</div> :
          isError || !overview ? <div className="jhm-project-loading" role="alert">
            Couldn't load projects. <button type="button" onClick={onRetry}>Try again</button>
          </div> : <ProjectCarousel overview={overview} />}
      </section>
    </div>
  </div>;
}

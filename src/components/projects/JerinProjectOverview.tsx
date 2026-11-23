import { projectCover, projectCoverUrl } from "@/lib/projectCovers";
import { Link } from "react-router-dom";
import { HealthBadge } from "@/components/projects/ProjectBadges";
import { useProjectStages } from "@/hooks/useProjectStages";
import type { TaskRow } from "@/hooks/useProjectData";
import type { ProjectRow } from "@/hooks/useProjects";
import { dateShort } from "@/lib/format";
import { isTaskCompleted } from "@/lib/taskCompletion";

interface Props {
  project: ProjectRow;
  tasks: TaskRow[];
  completion: { total: number; completed: number; percent: number };
  loading: boolean;
}

export function JerinProjectOverview({ project, tasks, completion, loading }: Props) {
  const { data: stages = [] } = useProjectStages(project.id);
  const nextTasks = tasks.filter(task => !task.archived_at && !isTaskCompleted(task))
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 3);

  return (
    <div className="jerin-project-overview">
      <section className="jerin-project-progress" aria-label="Overall progress">
        <header><h2>Overall progress</h2><strong>{loading ? "—" : `${completion.percent}%`}</strong></header>
        <progress max={100} value={loading ? undefined : completion.percent} aria-label="Overall progress" />
        <p>{loading ? "Loading tasks…" : `${completion.completed} of ${completion.total} tasks completed`}</p>
      </section>
      <section className="jerin-project-next">
        <h2>Next up</h2>
        {loading ? <p role="status">Loading tasks…</p> : nextTasks.length === 0 ? <p>No upcoming tasks.</p> : (
          <ul>
            {nextTasks.map(task => {
              const stage = stages.find(item => item.id === task.stage_id);
              const metadata = [stage?.name, task.due_date && `Due ${dateShort(task.due_date)}`].filter(Boolean);
              return (
                <li key={task.id}>
                  <Link to={`?tab=board&task=${encodeURIComponent(task.id)}`}>
                    <span className="jerin-project-task-circle" aria-hidden="true" />
                    <span className="min-w-0">
                      <strong>{task.title}</strong>
                      {metadata.length > 0 && <small>{metadata.join(" · ")}</small>}
                    </span>
                    <span className="jerin-project-task-dot" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function JerinProjectSummary({ project, members }: { project: ProjectRow; members: number }) {
  return (
    <section className="jerin-project-summary" aria-label="Project summary">
        <img className="jerin-project-cover" src={projectCoverUrl(projectCover(project.id, project.cover_image_key))} alt="" width={100} height={108} />
        <div className="min-w-0 space-y-2">
          <h2>{project.name}</h2>
          <HealthBadge health={project.health} />
          <p>{project.due_date ? `Due ${dateShort(project.due_date)}` : "No due date"}</p>
          <p>{members} {members === 1 ? "teammate" : "teammates"}</p>
        </div>
      </section>
  );
}

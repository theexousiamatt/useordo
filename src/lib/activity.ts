type ActivityRow = {
  type: string;
  payload: Record<string, unknown> | null;
};

export function activityLabel(a: ActivityRow): string {
  const p = (a.payload ?? {}) as Record<string, string>;
  switch (a.type) {
    case "task_created": return `New task: ${p.title ?? "Untitled"}`;
    case "task_status_changed": return `Task "${p.title}" → ${formatStatus(p.to)}`;
    case "task_approved": return `Approved: ${p.title}`;
    case "task_changes_requested": return `Changes requested on ${p.title}`;
    case "file_uploaded": return `File uploaded: ${p.name}`;
    case "milestone_completed": return `Milestone reached: ${p.title}`;
    case "project_created": return `Project created`;
    case "project_updated": return `Project updated`;
    case "comment_added": return `New comment`;
    default: return a.type.replaceAll("_", " ");
  }
}

function formatStatus(s?: string) {
  if (!s) return "";
  return s.replaceAll("_", " ");
}

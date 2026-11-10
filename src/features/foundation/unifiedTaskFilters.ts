import { matchesTaskDueDate, type TaskDueFilter } from "@/lib/taskDueDates";
import type { UnifiedTask } from "./api";
export const UNIFIED_DUE_FILTERS = [
 {id:"all",label:"All"},{id:"today",label:"Due Today"},{id:"this-week",label:"Due This Week"},
 {id:"overdue",label:"Overdue"},{id:"upcoming",label:"Upcoming"},{id:"none",label:"No Due Date"},
] as const;
export type UnifiedFilters={assignee:string;context:string;priority:string;status:string};
export function filterUnifiedBase(tasks:UnifiedTask[],filters:UnifiedFilters) {
 return tasks.filter(task=>!task.archived_at
  && (!filters.context || task.work_context_id===filters.context)
  && (!filters.priority || task.priority===filters.priority)
  && (filters.assignee==="all" || (filters.assignee==="unassigned" ? task.assignees.length===0 : task.assignees.some(person=>person.id===filters.assignee)))
  && (filters.status==="all" || (filters.status==="open" ? task.category!=="done" : task.category===filters.status)));
}
export function matchesUnifiedDue(task:UnifiedTask,due:TaskDueFilter,today:string) {
 return due==="all" || (task.category!=="done" && matchesTaskDueDate({due_date:task.due_date,status:task.category},due,{},today));
}
export function unifiedDueCounts(tasks:UnifiedTask[],today:string) {
 return Object.fromEntries(UNIFIED_DUE_FILTERS.map(filter=>[filter.id,tasks.filter(task=>matchesUnifiedDue(task,filter.id,today)).length])) as Record<typeof UNIFIED_DUE_FILTERS[number]["id"],number>;
}

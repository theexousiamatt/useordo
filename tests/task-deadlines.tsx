// Development-only preview. All backend reads use synthetic local data.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { addDays, parseISO } from "date-fns";
import { AuthProvider } from "../src/hooks/useAuth";
import { WorkspaceProvider } from "../src/hooks/useWorkspace";
import { supabase } from "../src/integrations/supabase/client";
import { localDateKey } from "../src/lib/format";
import { taskWeekRange } from "../src/lib/taskDueDates";
import Tasks from "../src/pages/Tasks";
import "../src/index.css";

const today = localDateKey();
const week = taskWeekRange(today);
const params = new URLSearchParams(location.search);
const owner = { id: "creative", email: "creative@example.invalid" };
const task = (id: string, title: string, due_date: string | null, extra = {}) => ({
  id, title, due_date, workspace_id: "studio", project_id: "branding",
  status: "todo", position: 0, archived_at: null, assignee_id: "creative",
  task_assignees: [{ user_id: "creative" }], ...extra,
});
const tasks = [
  task("today", "Refine the identity presentation", today),
  task("shared", "Review the launch messaging", today, { assignee_id: "writer", task_assignees: [{ user_id: "writer" }, { user_id: "creative" }], status: "review" }),
  task("week", "Prepare the motion identity preview", week.to, { status: "in_progress", assignee_id: "motion", task_assignees: [{ user_id: "motion" }] }),
  task("late", "Confirm the approved creative direction", localDateKey(addDays(parseISO(today), -1))),
  task("later", "Export the final brand asset package", localDateKey(addDays(parseISO(week.to), 3))),
  task("undated", "Collect references for the next campaign", null),
  task("done", "Completed draft", today, { status: "done" }),
  task("archived", "Archived task", today, { archived_at: today }),
];

Object.assign(supabase.auth, {
  getSession: async () => ({ data: { session: { user: owner, access_token: "local-preview" } }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
});
Object.defineProperty(supabase, "functions", { value: {
  invoke: async (name: string) => ({ data: name === "list-workspaces" ? { workspaces: [
    { id: "studio", name: "Inspirare Studio", slug: "inspirare", type: "agency", owner_id: "creative", role: "member" },
  ] } : null, error: null }),
} });
Object.assign(supabase, {
  from: (name: string) => {
    let rows = (name === "tasks" ? params.get("state") === "empty" ? [] : tasks
      : name === "projects" ? [{ id: "branding", name: "Branding project", workspace_id: "studio" }] : []) as Record<string, unknown>[];
    const chain = {
      select: () => chain,
      eq: (field: string, value: unknown) => { rows = rows.filter((row) => row[field] === value); return chain; },
      neq: (field: string, value: unknown) => { rows = rows.filter((row) => row[field] !== value); return chain; },
      is: (field: string, value: unknown) => { rows = rows.filter((row) => row[field] === value); return chain; },
      in: (field: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[field])); return chain; },
      order: () => chain,
      then: (resolve: (value: unknown) => void) => resolve(params.get("state") === "error" && name === "tasks"
        ? { data: null, error: new Error("Local preview load failure") } : { data: rows, error: null }),
    };
    return chain;
  },
});
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Preview() {
  return <div className="client-os min-h-screen bg-background p-4 sm:p-8">
    <p className="mb-6 text-xs text-muted-foreground">Local preview · sample tasks</p>
    <QueryClientProvider client={queryClient}><MemoryRouter initialEntries={["/tasks"]}><AuthProvider><WorkspaceProvider>
      <Routes><Route path="/tasks" element={<Tasks />} /><Route path="/projects/:id" element={<p>Task opened from the deadline view.</p>} /></Routes>
    </WorkspaceProvider></AuthProvider></MemoryRouter></QueryClientProvider>
  </div>;
}
const width = Number(params.get("width"));
if (width > 0 && window.top === window.self) {
  const source = new URL(location.href);
  source.searchParams.delete("width");
  createRoot(document.getElementById("root")!).render(<iframe title="Mobile task deadlines preview" src={source.toString()}
    style={{ display: "block", border: 0, width: Math.min(width, innerWidth), height: "100vh", margin: "auto" }} />);
} else createRoot(document.getElementById("root")!).render(<Preview />);

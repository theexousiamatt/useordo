import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Tasks from "./Tasks";

const api = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: api.from } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/hooks/useWorkspace", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "studio" } }),
}));

type Row = Record<string, unknown>;
type Result = { data: Row[]; error: null };
interface QueryDouble extends PromiseLike<Result> {
  select: (columns: string) => QueryDouble;
  eq: (column: string, value: unknown) => QueryDouble;
  is: (column: string, value: unknown) => QueryDouble;
  neq: (column: string, value: unknown) => QueryDouble;
  order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => QueryDouble;
  in: (column: string, values: unknown[]) => QueryDouble;
}

const task = (id: string, title: string, due_date: string | null, extra: Row = {}): Row => ({
  id, title, due_date, workspace_id: "studio", project_id: "brand-project",
  status: "todo", assignee_id: "other", task_assignees: [], archived_at: null,
  position: 0, ...extra,
});
const tasks = [
  task("previous-week", "Late research", "2026-11-01"),
  task("monday", "Monday kickoff", "2026-11-02"),
  task("primary", "My concept draft", "2026-11-03", { assignee_id: "me" }),
  task("secondary", "Shared identity review", "2026-11-03", {
    status: "review", task_assignees: [{ user_id: "other" }, { user_id: "me" }],
  }),
  task("colleague", "Colleague presentation", "2026-11-03", { task_assignees: [{ user_id: "other" }] }),
  task("sunday", "Sunday handover", "2026-11-08"),
  task("next-week", "Next Monday launch", "2026-11-09"),
  task("undated", "Unscheduled exploration", null),
  task("completed", "Completed concept", "2026-11-03", { status: "done" }),
  task("archived", "Archived concept", "2026-11-03", { archived_at: "2026-11-02T12:00:00Z" }),
  task("foreign", "Another studio task", "2026-11-03", { workspace_id: "another-studio" }),
];
const projects: Row[] = [{ id: "brand-project", workspace_id: "studio", name: "Brand identity" }];
const queries: { table: string; query: QueryDouble }[] = [];
const clients: QueryClient[] = [];

// Preserve the query boundary: filters determine the returned rows, rather than
// handing the component a prefiltered fixture regardless of what it requests.
function queryFor(table: string): QueryDouble {
  const predicates: ((row: Row) => boolean)[] = [];
  const ordering: { column: string; ascending: boolean; nullsFirst: boolean }[] = [];
  const query: QueryDouble = {
    select: vi.fn(() => query),
    eq: vi.fn((column, value) => { predicates.push((row) => row[column] === value); return query; }),
    is: vi.fn((column, value) => { predicates.push((row) => row[column] === value); return query; }),
    neq: vi.fn((column, value) => { predicates.push((row) => row[column] !== value); return query; }),
    in: vi.fn((column, values) => { predicates.push((row) => values.includes(row[column])); return query; }),
    order: vi.fn((column, options = {}) => {
      ordering.push({ column, ascending: options.ascending ?? true, nullsFirst: options.nullsFirst ?? false });
      return query;
    }),
    then: (resolve, reject) => {
      const rows = (table === "tasks" ? tasks : projects)
        .filter((row) => predicates.every((matches) => matches(row)))
        .sort((left, right) => {
          for (const { column, ascending, nullsFirst } of ordering) {
            const a = left[column]; const b = right[column];
            if (a === b) continue;
            if (a == null) return nullsFirst ? -1 : 1;
            if (b == null) return nullsFirst ? 1 : -1;
            const comparison = String(a).localeCompare(String(b));
            if (comparison) return ascending ? comparison : -comparison;
          }
          return 0;
        });
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    },
  };
  queries.push({ table, query });
  return query;
}

function Location() {
  const location = useLocation();
  return <div aria-label="Current location">{location.pathname + location.search}</div>;
}

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/tasks"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Tasks /><Location />
  </MemoryRouter></QueryClientProvider>);
  return screen.findByText("My concept draft");
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 3, 12));
  queries.length = 0;
  api.from.mockReset().mockImplementation(queryFor);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
});

describe("workspace task deadlines", () => {
  it("shows open workspace work and narrows it to tasks due today", async () => {
    await show();
    expect(screen.getByRole("status")).toHaveTextContent("8 tasks shown");
    for (const title of ["Completed concept", "Archived concept", "Another studio task"]) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
    const taskQuery = queries.find(({ table }) => table === "tasks")!.query;
    expect(taskQuery.is).toHaveBeenCalledWith("archived_at", null);
    expect(taskQuery.neq).toHaveBeenCalledWith("status", "done");

    fireEvent.click(screen.getByRole("button", { name: /^Due today\b/ }));
    expect(screen.getByRole("status")).toHaveTextContent("3 tasks shown");
    expect(screen.getByText("My concept draft")).toBeInTheDocument();
    expect(screen.getByText("Shared identity review")).toBeInTheDocument();
    expect(screen.getByText("Colleague presentation")).toBeInTheDocument();
    expect(screen.queryByText("Monday kickoff")).not.toBeInTheDocument();
    expect(screen.queryByText("Unscheduled exploration")).not.toBeInTheDocument();
  });

  it("includes both Monday and Sunday in this week, excluding adjacent weeks", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: /^Due this week\b/ }));
    expect(screen.getByRole("status")).toHaveTextContent("5 tasks shown");
    expect(screen.getByText("Monday kickoff")).toBeInTheDocument();
    expect(screen.getByText("Sunday handover")).toBeInTheDocument();
    expect(screen.getByText(/Monday–Sunday/)).toBeInTheDocument();
    for (const title of ["Late research", "Next Monday launch", "Unscheduled exploration"]) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
  });

  it("combines due dates with primary and secondary assignments to the current user", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "My tasks" }));
    fireEvent.click(screen.getByRole("button", { name: /^Due today\b/ }));
    expect(screen.getByRole("button", { name: "My tasks" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("2 tasks shown");
    expect(screen.getByText("My concept draft")).toBeInTheDocument();
    expect(screen.getByText("Shared identity review")).toBeInTheDocument();
    expect(screen.queryByText("Colleague presentation")).not.toBeInTheDocument();
  });

  it("uses inclusive custom dates, explains empty results, and clears the range", async () => {
    await show();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by due date" }), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-02" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-11-08" } });
    expect(screen.getByRole("status")).toHaveTextContent("5 tasks shown");
    expect(screen.getByText("Monday kickoff")).toBeInTheDocument();
    expect(screen.getByText("Sunday handover")).toBeInTheDocument();
    expect(screen.queryByText("Late research")).not.toBeInTheDocument();
    expect(screen.queryByText("Next Monday launch")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-11" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-11-12" } });
    expect(screen.getByRole("heading", { name: "No tasks match these dates" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 tasks shown");
    fireEvent.click(screen.getAllByRole("button", { name: "Clear date filter" })[0]);
    expect(screen.getByRole("combobox", { name: "Filter by due date" })).toHaveValue("all");
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("8 tasks shown");
    expect(screen.getByText("Unscheduled exploration")).toBeInTheDocument();
  });

  it("opens the selected task directly on its project board", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: /Shared identity review/ }));
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/projects/brand-project?task=secondary");
  });
});

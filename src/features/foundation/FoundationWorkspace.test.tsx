import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FoundationWorkspace } from "./FoundationWorkspace";
import { foundationApi } from "./api";
import type { CreateFoundationProject, FoundationProject, ProjectParent, StudioOrganization } from "./types";

const auth = vi.hoisted(() => ({ id: "account-a", email: "team@example.test", loading: false, signOut: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: auth.id, email: auth.email }, loading: auth.loading, signOut: auth.signOut }) }));
vi.mock("./api", () => ({ foundationApi: {
  listOrganizations: vi.fn(), createOrganization: vi.fn(), listClients: vi.fn(), listInitiatives: vi.fn(),
  createClient: vi.fn(), createInitiative: vi.fn(), listProjects: vi.fn(), getProject: vi.fn(), createProject: vi.fn(),
} }));

const api = vi.mocked(foundationApi);
const orgA: StudioOrganization = { id: "studio-a", name: "Inspirare Studio", slug: "inspirare", role: "owner" };
const orgB: StudioOrganization = { id: "studio-b", name: "Second Studio", slug: "second", role: "manager" };
const project = (extra: Partial<FoundationProject> = {}): FoundationProject => ({
  id: "project-a", organization_id: "studio-a", name: "Brand launch", description: null,
  ownership: "internal", lifecycle: "fixed_scope", client_organization_id: null, internal_initiative_id: null,
  engagement_id: null, owner_id: auth.id, due_date: null, created_at: "2026-11-03T10:00:00Z", disciplines: [], ...extra,
});

let organizations: StudioOrganization[];
let projects: FoundationProject[];
let clients: ProjectParent[];
let initiatives: ProjectParent[];
let savedCount: number;
const queryClients: QueryClient[] = [];

function show(path = "/projects") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 }, mutations: { retry: false } } });
  queryClients.push(queryClient);
  const tree = () => <QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}><FoundationWorkspace /></MemoryRouter></QueryClientProvider>;
  const view = render(tree());
  return { ...view, queryClient, rerenderAccount: () => view.rerender(tree()) };
}

async function openCreate() {
  fireEvent.click(await screen.findByRole("button", { name: "New project" }));
  await screen.findByRole("textbox", { name: /^Project name/ });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  auth.id = "account-a"; auth.email = "team@example.test"; auth.loading = false;
  auth.signOut.mockResolvedValue(undefined);
  organizations = [orgA]; projects = [project()]; clients = []; initiatives = []; savedCount = 0;
  api.listOrganizations.mockImplementation(async () => [...organizations]);
  api.listProjects.mockImplementation(async (organizationId) => projects.filter((item) => item.organization_id === organizationId));
  api.getProject.mockImplementation(async (organizationId, id) => projects.find((item) => item.organization_id === organizationId && item.id === id) ?? null);
  api.listClients.mockImplementation(async (organizationId) => clients.filter((item) => item.organization_id === organizationId));
  api.listInitiatives.mockImplementation(async (organizationId) => initiatives.filter((item) => item.organization_id === organizationId));
  api.createClient.mockImplementation(async (organizationId, name) => {
    clients.push({ id: "client-business", organization_id: organizationId, name }); return "client-business";
  });
  api.createInitiative.mockImplementation(async (organizationId, name) => {
    initiatives.push({ id: "initiative", organization_id: organizationId, name }); return "initiative";
  });
  api.createProject.mockImplementation(async (input: CreateFoundationProject) => {
    const saved = project({ id: `saved-${++savedCount}`, organization_id: input.organizationId, name: input.name,
      description: input.description, ownership: input.ownership, lifecycle: input.lifecycle,
      client_organization_id: input.clientOrganizationId, internal_initiative_id: input.internalInitiativeId,
      disciplines: input.disciplineKeys, due_date: input.dueDate });
    projects.push(saved); return saved.id;
  });
  api.createOrganization.mockImplementation(async (name, slug) => {
    const saved: StudioOrganization = { id: "new-studio", name, slug, role: "owner" }; organizations.push(saved); return saved.id;
  });
});

afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach((client) => client.clear());
});

describe("foundation workspace", () => {
  it("uses only authorized studios, switches scoped lists and reopens a saved project", async () => {
    organizations = [orgA, orgB];
    projects.push(project({ id: "project-b", organization_id: orgB.id, name: "Campaign system" }));
    localStorage.setItem("ordo:foundation:organization:account-a", "forged-studio");
    show();
    expect(await screen.findByRole("link", { name: /Brand launch/ })).toBeInTheDocument();
    const switcher = screen.getByRole("combobox", { name: "Studio workspace" });
    expect(switcher).toHaveValue(orgA.id);
    expect(screen.queryByRole("option", { name: "forged-studio" })).not.toBeInTheDocument();
    fireEvent.change(switcher, { target: { value: orgB.id } });
    const saved = await screen.findByRole("link", { name: /Campaign system/ });
    expect(screen.queryByRole("link", { name: /Brand launch/ })).not.toBeInTheDocument();
    expect(api.listProjects).toHaveBeenLastCalledWith(orgB.id);
    expect(localStorage.getItem("ordo:foundation:organization:account-a")).toBe(orgB.id);
    fireEvent.click(saved);
    expect(await screen.findByRole("heading", { name: "Campaign system" })).toBeInTheDocument();
    expect(api.getProject).toHaveBeenLastCalledWith(orgB.id, "project-b");
    fireEvent.click(screen.getByRole("link", { name: "All projects" }));
    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
  });

  it("creates internal work without a client and saves disciplines independently of lifecycle", async () => {
    show(); await openCreate();
    fireEvent.click(screen.getByRole("radio", { name: "Internal project" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Project name/ }), { target: { value: "Lora" } });
    fireEvent.click(screen.getByRole("button", { name: "Add details" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Branding" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Software" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Lifecycle" }), { target: { value: "continuous" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "Our own evolving product." } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-12-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("heading", { name: "Lora" })).toBeInTheDocument();
    expect(api.createProject).toHaveBeenCalledWith(expect.objectContaining({
      name: "Lora", ownership: "internal", clientOrganizationId: null, internalInitiativeId: null,
      lifecycle: "continuous", disciplineKeys: ["branding", "software"], dueDate: "2026-12-01", description: "Our own evolving product.",
    }), expect.any(String));
    expect(screen.getByText("Project created and saved.")).toBeInTheDocument();
    expect(screen.getByText("Branding, Software")).toBeInTheDocument();
    expect(screen.getByText("Continuous")).toBeInTheDocument();
    expect(api.createClient).not.toHaveBeenCalled();
  });

  it("creates a client business without a login and links a recurring multidisciplinary project", async () => {
    show(); await openCreate();
    fireEvent.change(screen.getByRole("textbox", { name: /^Project name/ }), { target: { value: "Devine campaign" } });
    fireEvent.click(screen.getByRole("button", { name: "Add client business" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Business name" }), { target: { value: "Devine Apartments" } });
    fireEvent.click(screen.getByRole("button", { name: "Save client business" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: /Client business/ })).toHaveValue("client-business"));
    expect(api.createClient).toHaveBeenCalledWith(orgA.id, "Devine Apartments", expect.any(String));
    expect(screen.queryByRole("textbox", { name: /email|password/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add details" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Web" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Growth" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Lifecycle" }), { target: { value: "recurring" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("heading", { name: "Devine campaign" })).toBeInTheDocument();
    expect(api.createProject).toHaveBeenCalledWith(expect.objectContaining({ ownership: "client", clientOrganizationId: "client-business", internalInitiativeId: null, disciplineKeys: ["web", "growth"], lifecycle: "recurring" }), expect.any(String));
    expect(screen.getByText("Devine Apartments")).toBeInTheDocument();
  });

  it("retains a failed project draft and reuses its command ID on retry", async () => {
    api.createProject.mockRejectedValueOnce(new Error("Connection interrupted. Try again."));
    show(); await openCreate();
    fireEvent.click(screen.getByRole("radio", { name: "Internal project" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Project name/ }), { target: { value: "Studio toolkit" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted");
    expect(screen.getByRole("textbox", { name: /^Project name/ })).toHaveValue("Studio toolkit");
    expect(screen.queryByText("Project created and saved.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("heading", { name: "Studio toolkit" })).toBeInTheDocument();
    expect(api.createProject.mock.calls[1][1]).toBe(api.createProject.mock.calls[0][1]);
    expect(projects.filter((item) => item.name === "Studio toolkit")).toHaveLength(1);
  });

  it("saves an optional internal initiative and lets an admin create operational work", async () => {
    organizations = [{ ...orgA, role: "admin" }];
    show(); await openCreate();
    expect(screen.getByRole("button", { name: "Create another studio" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Internal project" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Project name/ }), { target: { value: "Studio standards" } });
    fireEvent.click(screen.getByRole("button", { name: "Add initiative" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Initiative name" }), { target: { value: "Studio systems" } });
    fireEvent.click(screen.getByRole("button", { name: "Save initiative" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Internal initiative" })).toHaveValue("initiative"));
    fireEvent.click(screen.getByRole("button", { name: "Add details" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Lifecycle" }), { target: { value: "operational" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("heading", { name: "Studio standards" })).toBeInTheDocument();
    expect(screen.getByText("Studio systems")).toBeInTheDocument();
    expect(api.createProject).toHaveBeenCalledWith(expect.objectContaining({ ownership: "internal", internalInitiativeId: "initiative", clientOrganizationId: null, lifecycle: "operational", disciplineKeys: [] }), expect.any(String));
  });

  it("keeps a new account's selection and queries separate from the previous account", async () => {
    organizations = [orgA, orgB];
    projects.push(project({ id: "b", organization_id: orgB.id, name: "Other studio project" }));
    const view = show();
    await screen.findByRole("link", { name: /Brand launch/ });
    fireEvent.change(screen.getByRole("combobox", { name: "Studio workspace" }), { target: { value: orgB.id } });
    await screen.findByRole("link", { name: /Other studio project/ });
    auth.id = "account-b";
    organizations = [{ ...orgA, role: "member" }];
    projects = [project({ id: "account-b-project", name: "Only shared with account B" })];
    await act(async () => { view.rerenderAccount(); });
    expect(await screen.findByRole("link", { name: /Only shared with account B/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Other studio project/ })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Studio workspace" })).toHaveValue(orgA.id);
    expect(localStorage.getItem("ordo:foundation:organization:account-a")).toBe(orgB.id);
    expect(localStorage.getItem("ordo:foundation:organization:account-b")).toBe(orgA.id);
    expect(screen.queryByRole("button", { name: "New project" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create another studio" })).not.toBeInTheDocument();
    expect(view.queryClient.getQueryData(["foundation", "account-b", orgA.id, "projects"])).toEqual(projects);
  });

  it("honors effective project capabilities independently of the base role", async () => {
    organizations = [{ ...orgA, role: "member", capabilities: ["projects.create"] }];
    show();
    await openCreate();
    expect(screen.queryByRole("button", { name: "Create another studio" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Internal project" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Project name/ }), { target: { value: "Assigned initiative" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("heading", { name: "Assigned initiative" })).toBeInTheDocument();
    expect(api.createProject).toHaveBeenCalledOnce();
  });

  it("does not infer creation rights when effective capabilities are empty", async () => {
    organizations = [{ ...orgA, role: "manager", capabilities: [] }];
    show();
    await screen.findByRole("heading", { name: "Projects" });
    expect(screen.queryByRole("button", { name: "New project" })).not.toBeInTheDocument();
  });

  it("withholds internal routes and project queries from a client account", async () => {
    organizations = [{ ...orgA, role: "client" }];
    show("/projects/project-a");
    expect(await screen.findByRole("heading", { name: "Your client account" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Studio workspace" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New project" })).not.toBeInTheDocument();
    expect(api.listProjects).not.toHaveBeenCalled();
    expect(api.getProject).not.toHaveBeenCalled();
    expect(api.listClients).not.toHaveBeenCalled();
    expect(api.listInitiatives).not.toHaveBeenCalled();
  });

  it("recovers an organization loading failure before querying any project data", async () => {
    api.listOrganizations.mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline"));
    show();
    expect(await screen.findByRole("heading", { name: "Couldn’t load your studios" })).toBeInTheDocument();
    expect(api.listProjects).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /Brand launch/ })).toBeInTheDocument();
  });

  it("bootstraps a new studio and opens its real saved workspace", async () => {
    organizations = []; projects = [];
    show();
    fireEvent.change(await screen.findByRole("textbox", { name: /Studio name/ }), { target: { value: "Inspirare Studio" } });
    expect(screen.getByRole("textbox", { name: /Workspace address/ })).toHaveValue("inspirare-studio");
    fireEvent.click(screen.getByRole("button", { name: "Create studio" }));
    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Studio workspace" })).toHaveValue("new-studio");
    expect(api.createOrganization).toHaveBeenCalledWith("Inspirare Studio", "inspirare-studio", expect.any(String));
    expect(api.listProjects).toHaveBeenLastCalledWith("new-studio");
  });
});

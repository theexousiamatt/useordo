import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { CreateFoundationProject, DisciplineKey, FoundationProject, ProjectParent, StudioOrganization } from "./types";

export interface ProductionBoard { id:string; organization_id:string; work_context_id:string; name:string; position:number; archived_at:string|null }
export interface ProductionColumn { id:string; organization_id:string; work_context_id:string; board_id:string; name:string; category:string; position:number }
export interface ProductionTask { id:string; organization_id:string; work_context_id:string; board_id:string|null; column_id:string|null; title:string; priority:string; due_date:string|null; position:number; archived_at:string|null }

type ProjectRecord = Omit<FoundationProject, "disciplines">;
type Table<Row> = {
  Row: { [Key in keyof Row]: Row[Key] };
  Insert: { [Key in keyof Row]?: Row[Key] };
  Update: { [Key in keyof Row]?: Row[Key] };
  Relationships: [];
};

/** Canonical development schema; deliberately independent of legacy generated types. */
export interface FoundationDatabase {
  public: {
    Tables: {
      projects: Table<ProjectRecord & {work_context_id:string}>;
      boards: Table<ProductionBoard>;
      board_columns: Table<ProductionColumn>;
      tasks: Table<ProductionTask>;
      client_organizations: Table<ProjectParent>;
      internal_initiatives: Table<ProjectParent>;
      project_disciplines: Table<{ project_id: string; discipline_key: DisciplineKey; organization_id: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      list_my_organizations: { Args: Record<string, never>; Returns: StudioOrganization[] };
      create_organization: { Args: { _name: string; _slug: string; _request_id: string }; Returns: string };
      create_client_organization: { Args: { _organization_id: string; _name: string; _request_id: string }; Returns: string };
      create_internal_initiative: { Args: { _organization_id: string; _name: string; _request_id: string }; Returns: string };
      create_project: {
        Args: {
          _organization_id: string; _name: string; _ownership: FoundationProject["ownership"];
          _discipline_keys: DisciplineKey[]; _lifecycle: FoundationProject["lifecycle"];
          _client_organization_id?: string | null; _internal_initiative_id?: string | null;
          _engagement_id?: string | null; _description?: string | null;
          _due_date?: string | null; _request_id: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

const client = supabase as unknown as SupabaseClient<FoundationDatabase>;
const PROJECT_FIELDS = "id,organization_id,name,description,ownership,lifecycle,client_organization_id,internal_initiative_id,engagement_id,owner_id,due_date,created_at";

function savedId(data: string | null): string {
  if (!data) throw new Error("The save could not be confirmed. Your draft is still here; try again.");
  return data;
}

async function withDisciplines(records: ProjectRecord[], organizationId: string): Promise<FoundationProject[]> {
  if (!records.length) return [];
  const { data, error } = await client.from("project_disciplines").select("project_id,discipline_key")
    .eq("organization_id", organizationId).in("project_id", records.map((project) => project.id));
  if (error) throw error;
  return records.map((project) => ({
    ...project,
    disciplines: (data ?? []).filter((row) => row.project_id === project.id).map((row) => row.discipline_key),
  }));
}

export const foundationApi = {
  async getProductionWorkspace(organizationId:string, projectId:string) {
    // Resolve context through the authorized project; never accept a context from the URL.
    const project = await client.from("projects").select("work_context_id").eq("organization_id",organizationId).eq("id",projectId).maybeSingle();
    if (project.error) throw project.error;
    if (!project.data) throw new Error("Project unavailable in this studio.");
    const contextId=project.data.work_context_id;
    const [boards,columns,tasks]=await Promise.all([
      client.from("boards").select("*").eq("organization_id",organizationId).eq("work_context_id",contextId).is("archived_at",null).order("position").order("id"),
      client.from("board_columns").select("*").eq("organization_id",organizationId).eq("work_context_id",contextId).order("position").order("id"),
      client.from("tasks").select("id,organization_id,work_context_id,board_id,column_id,title,priority,due_date,position,archived_at").eq("organization_id",organizationId).eq("work_context_id",contextId).is("archived_at",null).order("position").order("id"),
    ]);
    for (const result of [boards,columns,tasks]) if (result.error) throw result.error;
    return {boards:boards.data ?? [],columns:columns.data ?? [],tasks:tasks.data ?? []};
  },
  async listOrganizations(): Promise<StudioOrganization[]> {
    const { data, error } = await client.rpc("list_my_organizations");
    if (error) throw error;
    return data ?? [];
  },
  async createOrganization(name: string, slug: string, requestId: string): Promise<string> {
    const { data, error } = await client.rpc("create_organization", { _name: name, _slug: slug, _request_id: requestId });
    if (error) throw error;
    return savedId(data);
  },
  async listClients(organizationId: string): Promise<ProjectParent[]> {
    const { data, error } = await client.from("client_organizations").select("id,organization_id,name")
      .eq("organization_id", organizationId).order("name");
    if (error) throw error;
    return data ?? [];
  },
  async listInitiatives(organizationId: string): Promise<ProjectParent[]> {
    const { data, error } = await client.from("internal_initiatives").select("id,organization_id,name")
      .eq("organization_id", organizationId).order("name");
    if (error) throw error;
    return data ?? [];
  },
  async createClient(organizationId: string, name: string, requestId: string): Promise<string> {
    const { data, error } = await client.rpc("create_client_organization", { _organization_id: organizationId, _name: name, _request_id: requestId });
    if (error) throw error;
    return savedId(data);
  },
  async createInitiative(organizationId: string, name: string, requestId: string): Promise<string> {
    const { data, error } = await client.rpc("create_internal_initiative", { _organization_id: organizationId, _name: name, _request_id: requestId });
    if (error) throw error;
    return savedId(data);
  },
  async listProjects(organizationId: string): Promise<FoundationProject[]> {
    const { data, error } = await client.from("projects").select(PROJECT_FIELDS)
      .eq("organization_id", organizationId).order("created_at", { ascending: false });
    if (error) throw error;
    return withDisciplines(data ?? [], organizationId);
  },
  async getProject(organizationId: string, projectId: string): Promise<FoundationProject | null> {
    const { data, error } = await client.from("projects").select(PROJECT_FIELDS)
      .eq("organization_id", organizationId).eq("id", projectId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return (await withDisciplines([data], organizationId))[0];
  },
  async createProject(input: CreateFoundationProject, requestId: string): Promise<string> {
    const { data, error } = await client.rpc("create_project", {
      _organization_id: input.organizationId, _name: input.name, _ownership: input.ownership,
      _discipline_keys: input.disciplineKeys, _lifecycle: input.lifecycle,
      _client_organization_id: input.clientOrganizationId, _internal_initiative_id: input.internalInitiativeId,
      _description: input.description, _due_date: input.dueDate, _request_id: requestId,
    });
    if (error) throw error;
    return savedId(data);
  },
};

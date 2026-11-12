import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { CreateFoundationProject, DisciplineKey, FoundationProject, ProjectParent, StudioOrganization } from "./types";

export interface ProductionBoard { id:string; organization_id:string; work_context_id:string; name:string; position:number; archived_at:string|null; revision:number }
export interface ProductionColumn { id:string; organization_id:string; work_context_id:string; board_id:string; name:string; category:string; position:number; revision:number }
export interface ProductionTask { id:string; organization_id:string; work_context_id:string; board_id:string|null; column_id:string|null; title:string; description:string|null; category:string; priority:string; due_date:string|null; position:number; archived_at:string|null; revision:number }
export interface ProjectTeamPerson { user_id:string; member_name:string; studio_role:string; project_role:"owner"|"manager"|"contributor"|"viewer"|null }

export interface UnifiedTask extends ProductionTask {
 context_kind:"project"|"operational";context_name:string;project_id:string|null;ownership:"client"|"internal"|null;initiative_name:string|null;
 board_name:string|null;board_archived:boolean;context_archived:boolean;can_write:boolean;assignees:{id:string;name:string}[];
}

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
      task_assignees: Table<{organization_id:string;work_context_id:string;task_id:string;user_id:string}>;
      client_organizations: Table<ProjectParent>;
      internal_initiatives: Table<ProjectParent>;
      project_disciplines: Table<{ project_id: string; discipline_key: DisciplineKey; organization_id: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      list_unified_tasks:{Args:{_organization_id:string};Returns:UnifiedTask[]};
      list_context_assignees:{Args:{_organization_id:string;_context_id:string};Returns:{id:string;name:string}[]};
      save_operational_task:{Args:{_organization_id:string;_context_id:string;_task_id:string;_expected_revision:number;_values:Record<string,unknown>;_request_id:string};Returns:string};
      change_production_item: {Args:{_organization_id:string;_project_id:string;_action:string;_id:string;_expected_revision:number;_column_id:string|null;_before_id:string|null;_request_id:string};Returns:string};
      change_production_column: {Args:{_organization_id:string;_project_id:string;_action:"move_column"|"remove_column";_column_id:string;_expected_revision:number;_destination_column_id:string|null;_request_id:string};Returns:string};
      save_production_item: {Args:{_organization_id:string;_project_id:string;_kind:string;_id:string|null;_expected_revision:number|null;_values:Record<string,unknown>;_request_id:string};Returns:string};
      list_production_assignees: {Args:{_organization_id:string;_project_id:string};Returns:{id:string;name:string}[]};
      list_project_team: {Args:{_organization_id:string;_project_id:string};Returns:ProjectTeamPerson[]};
      set_project_team_member: {Args:{_organization_id:string;_project_id:string;_user_id:string;_role:"manager"|"contributor"|"viewer"|null;_request_id:string};Returns:string};
      production_permissions: {Args:{_organization_id:string;_project_id:string};Returns:{can_write:boolean;can_configure:boolean}[]};
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
  async listUnifiedTasks(organizationId:string) {
    const {data,error}=await client.rpc("list_unified_tasks",{_organization_id:organizationId});if(error)throw error;return data ?? [];
  },
  async listContextAssignees(organizationId:string,contextId:string) {
    const {data,error}=await client.rpc("list_context_assignees",{_organization_id:organizationId,_context_id:contextId});if(error)throw error;return data ?? [];
  },
  async saveOperationalTask(organizationId:string,contextId:string,taskId:string,revision:number,values:Record<string,unknown>,requestId:string) {
    const {data,error}=await client.rpc("save_operational_task",{_organization_id:organizationId,_context_id:contextId,_task_id:taskId,_expected_revision:revision,_values:values,_request_id:requestId});if(error)throw error;return savedId(data);
  },
  async getTaskContext(organizationId:string,contextId:string) {
    const [boards,columns]=await Promise.all([
      client.from("boards").select("*").eq("organization_id",organizationId).eq("work_context_id",contextId).order("position").order("id"),
      client.from("board_columns").select("*").eq("organization_id",organizationId).eq("work_context_id",contextId).order("position").order("id"),
    ]);if(boards.error)throw boards.error;if(columns.error)throw columns.error;return {boards:boards.data ?? [],columns:columns.data ?? []};
  },
  async changeProductionColumn(organizationId:string,projectId:string,action:"move_column"|"remove_column",columnId:string,revision:number,destinationColumnId:string|null,requestId:string) {
    const {data,error}=await client.rpc("change_production_column",{
      _organization_id:organizationId,_project_id:projectId,_action:action,
      _column_id:columnId,_expected_revision:revision,_destination_column_id:destinationColumnId,_request_id:requestId,
    });
    if(error)throw error;
    return savedId(data);
  },
  async changeProductionItem(organizationId:string,projectId:string,action:string,id:string,revision:number,columnId:string|null,beforeId:string|null,requestId:string) {
    const {data,error}=await client.rpc("change_production_item",{_organization_id:organizationId,_project_id:projectId,_action:action,_id:id,_expected_revision:revision,_column_id:columnId,_before_id:beforeId,_request_id:requestId});if(error)throw error;return savedId(data);
  },
  async saveProductionItem(organizationId:string,projectId:string,kind:string,id:string|null,revision:number|null,values:Record<string,unknown>,requestId:string) {
    const {data,error}=await client.rpc("save_production_item",{_organization_id:organizationId,_project_id:projectId,_kind:kind,_id:id,_expected_revision:revision,_values:values,_request_id:requestId});
    if(error) throw error; return savedId(data);
  },
  async listProjectTeam(organizationId:string,projectId:string):Promise<ProjectTeamPerson[]> {
    const {data,error}=await client.rpc("list_project_team",{_organization_id:organizationId,_project_id:projectId});
    if(error)throw error;
    return data ?? [];
  },
  async setProjectTeamMember(organizationId:string,projectId:string,userId:string,role:"manager"|"contributor"|"viewer"|null,requestId:string):Promise<string> {
    const {data,error}=await client.rpc("set_project_team_member",{
      _organization_id:organizationId,_project_id:projectId,_user_id:userId,_role:role,_request_id:requestId,
    });
    if(error)throw error;
    return savedId(data);
  },
  async listProductionAssignees(organizationId:string,projectId:string) {
    const {data,error}=await client.rpc("list_production_assignees",{_organization_id:organizationId,_project_id:projectId});if(error) throw error;return data ?? [];
  },
  async getProductionWorkspace(organizationId:string, projectId:string) {
    // Resolve context through the authorized project; never accept a context from the URL.
    const project = await client.from("projects").select("work_context_id").eq("organization_id",organizationId).eq("id",projectId).maybeSingle();
    if (project.error) throw project.error;
    if (!project.data) throw new Error("Project unavailable in this studio.");
    const contextId=project.data.work_context_id;
    const [boards,columns,tasks,assignments,permissions]=await Promise.all([
      client.from("boards").select("*").eq("organization_id",organizationId).eq("work_context_id",contextId).order("position").order("id"),
      client.from("board_columns").select("*").eq("organization_id",organizationId).eq("work_context_id",contextId).order("position").order("id"),
      client.from("tasks").select("id,organization_id,work_context_id,board_id,column_id,title,description,category,revision,priority,due_date,position,archived_at").eq("organization_id",organizationId).eq("work_context_id",contextId).order("position").order("id"),
      client.from("task_assignees").select("organization_id,work_context_id,task_id,user_id").eq("organization_id",organizationId).eq("work_context_id",contextId),
      client.rpc("production_permissions",{_organization_id:organizationId,_project_id:projectId}),
    ]);
    for (const result of [boards,columns,tasks,assignments,permissions]) if (result.error) throw result.error;
    return {boards:boards.data ?? [],columns:columns.data ?? [],tasks:tasks.data ?? [],assignments:assignments.data ?? [],permissions:permissions.data?.[0] ?? {can_write:false,can_configure:false}};
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

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          project_id: string
          type: Database["public"]["Enums"]["activity_type"]
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          project_id: string
          type: Database["public"]["Enums"]["activity_type"]
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          project_id?: string
          type?: Database["public"]["Enums"]["activity_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_plan_items: {
        Row: {
          accepted_at: string | null
          ai_plan_id: string
          applied: boolean
          applied_entity_id: string | null
          created_at: string
          entity_type: Database["public"]["Enums"]["ai_item_entity_type"]
          id: string
          payload: Json
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          ai_plan_id: string
          applied?: boolean
          applied_entity_id?: string | null
          created_at?: string
          entity_type: Database["public"]["Enums"]["ai_item_entity_type"]
          id?: string
          payload?: Json
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          ai_plan_id?: string
          applied?: boolean
          applied_entity_id?: string | null
          created_at?: string
          entity_type?: Database["public"]["Enums"]["ai_item_entity_type"]
          id?: string
          payload?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_plan_items_ai_plan_id_fkey"
            columns: ["ai_plan_id"]
            isOneToOne: false
            referencedRelation: "ai_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_plan_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_plans: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          model: string | null
          project_id: string | null
          prompt: string
          status: Database["public"]["Enums"]["ai_plan_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          project_id?: string | null
          prompt: string
          status?: Database["public"]["Enums"]["ai_plan_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          project_id?: string | null
          prompt?: string
          status?: Database["public"]["Enums"]["ai_plan_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          client_id: string
          decided_at: string
          decision: Database["public"]["Enums"]["approval_decision"]
          id: string
          note: string | null
          task_id: string
        }
        Insert: {
          client_id: string
          decided_at?: string
          decision: Database["public"]["Enums"]["approval_decision"]
          id?: string
          note?: string | null
          task_id: string
        }
        Update: {
          client_id?: string
          decided_at?: string
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          note?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          project_id: string
          requires_approval: boolean
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          project_id: string
          requires_approval?: boolean
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          project_id?: string
          requires_approval?: boolean
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          name: string
          project_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          project_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          project_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          project_id: string
          status: string
          title: string
          workspace_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          status?: string
          title: string
          workspace_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          status?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_activity: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          project_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          project_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          project_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          project_id: string
          task_id: string | null
          workspace_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          project_id: string
          task_id?: string | null
          workspace_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          task_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          project_id: string
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          project_id: string
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          project_id?: string
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          health: string
          id: string
          name: string
          owner_id: string | null
          progress: number
          start_date: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          health?: string
          id?: string
          name: string
          owner_id?: string | null
          progress?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          health?: string
          id?: string
          name?: string
          owner_id?: string | null
          progress?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          position: number
          priority: string
          project_id: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          priority?: string
          project_id: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          priority?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
          type: Database["public"]["Enums"]["workspace_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          type?: Database["public"]["Enums"]["workspace_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          type?: Database["public"]["Enums"]["workspace_type"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_workspace_role: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
      has_project_role: {
        Args: { _project_id: string; _role: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_workspace_role: {
        Args: {
          _role: Database["public"]["Enums"]["workspace_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      is_project_client: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      shares_workspace_with: {
        Args: { _profile_id: string; _viewer: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_type:
        | "project_created"
        | "project_updated"
        | "milestone_completed"
        | "task_created"
        | "task_status_changed"
        | "task_approved"
        | "task_changes_requested"
        | "file_uploaded"
        | "comment_added"
        | "deliverable_created"
        | "deliverable_status_changed"
        | "client_access_granted"
        | "client_access_revoked"
      ai_item_entity_type: "task" | "milestone" | "deliverable"
      ai_plan_status: "queued" | "running" | "complete" | "failed"
      app_role: "admin" | "client" | "team"
      approval_decision: "approved" | "changes_requested"
      client_access_level: "viewer" | "approver"
      comment_entity_type: "project" | "task" | "milestone" | "deliverable"
      deliverable_status:
        | "draft"
        | "in_review"
        | "approved"
        | "delivered"
        | "archived"
      project_status: "on_track" | "at_risk" | "blocked" | "done" | "planning"
      task_status:
        | "pending"
        | "in_progress"
        | "awaiting_approval"
        | "approved"
        | "changes_requested"
        | "done"
      workspace_role: "owner" | "member" | "client"
      workspace_type:
        | "freelancer"
        | "agency"
        | "consultant"
        | "other"
        | "startup"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "project_created",
        "project_updated",
        "milestone_completed",
        "task_created",
        "task_status_changed",
        "task_approved",
        "task_changes_requested",
        "file_uploaded",
        "comment_added",
        "deliverable_created",
        "deliverable_status_changed",
        "client_access_granted",
        "client_access_revoked",
      ],
      ai_item_entity_type: ["task", "milestone", "deliverable"],
      ai_plan_status: ["queued", "running", "complete", "failed"],
      app_role: ["admin", "client", "team"],
      approval_decision: ["approved", "changes_requested"],
      client_access_level: ["viewer", "approver"],
      comment_entity_type: ["project", "task", "milestone", "deliverable"],
      deliverable_status: [
        "draft",
        "in_review",
        "approved",
        "delivered",
        "archived",
      ],
      project_status: ["on_track", "at_risk", "blocked", "done", "planning"],
      task_status: [
        "pending",
        "in_progress",
        "awaiting_approval",
        "approved",
        "changes_requested",
        "done",
      ],
      workspace_role: ["owner", "member", "client"],
      workspace_type: [
        "freelancer",
        "agency",
        "consultant",
        "other",
        "startup",
      ],
    },
  },
} as const

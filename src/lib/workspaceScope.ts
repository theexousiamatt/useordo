import { supabase } from "@/integrations/supabase/client";

/**
 * Tables that carry a `workspace_id` column and MUST be queried scoped to the
 * currently active workspace. Keep this list in sync with the database schema so
 * future modules inherit workspace isolation automatically.
 */
export const WORKSPACE_SCOPED_TABLES = [
  "projects",
  "tasks",
  "milestones",
  "deliverables",
  "project_comments",
  "project_files",
  "project_activity",
  "activity",
  "activity_logs",
  "ai_plans",
  "ai_plan_items",
] as const;

export type WorkspaceScopedTable = (typeof WORKSPACE_SCOPED_TABLES)[number];

/**
 * Single source of truth for reading workspace-scoped data.
 *
 * Always applies `.eq("workspace_id", workspaceId)` so callers physically cannot
 * forget the filter. Throws when no active workspace is present, surfacing the
 * mistake immediately instead of silently leaking cross-workspace rows.
 *
 * Usage:
 *   const { data } = await scopedSelect("projects", workspaceId)
 *     .order("updated_at", { ascending: false });
 */
export function scopedSelect(
  table: WorkspaceScopedTable,
  workspaceId: string | null | undefined,
  columns = "*",
) {
  if (!workspaceId) {
    throw new Error(
      `[workspaceScope] Refusing to query "${table}" without an active workspace id.`,
    );
  }
  return supabase.from(table).select(columns).eq("workspace_id", workspaceId);
}

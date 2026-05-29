import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type WorkspaceRole = "owner" | "member" | "client";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  type: "freelancer" | "agency" | "consultant" | "other";
  owner_id: string;
  role: WorkspaceRole;
};

type WorkspaceContextValue = {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  role: WorkspaceRole | null;
  loading: boolean;
  error: string | null;
  selectWorkspace: (id: string) => void;
  refresh: () => Promise<void>;
};

const STORAGE_KEY = "ordo:current-workspace";

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!user) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("workspace_members")
      .select("role, workspaces(id, name, slug, type, owner_id)")
      .eq("user_id", user.id);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const list: Workspace[] = (data ?? [])
      .filter((row: any) => row.workspaces)
      .map((row: any) => ({
        id: row.workspaces.id,
        name: row.workspaces.name,
        slug: row.workspaces.slug,
        type: row.workspaces.type,
        owner_id: row.workspaces.owner_id,
        role: row.role as WorkspaceRole,
      }));

    setWorkspaces(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const selectWorkspace = (id: string) => {
    setCurrentId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const currentWorkspace =
    workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        role: currentWorkspace?.role ?? null,
        loading,
        error,
        selectWorkspace,
        refresh: load,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

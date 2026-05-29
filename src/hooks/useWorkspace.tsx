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
  /** True once a workspace fetch has completed successfully (no error). */
  resolved: boolean;
  error: string | null;
  debug: {
    lastResponse: unknown;
    parsedWorkspaceCount: number | null;
    tokenAttached: boolean;
  };
  selectWorkspace: (id: string) => void;
  refresh: () => Promise<void>;
};

const STORAGE_KEY = "ordo:current-workspace";

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<WorkspaceContextValue["debug"]>({
    lastResponse: null,
    parsedWorkspaceCount: null,
    tokenAttached: false,
  });

  const load = async () => {
    // No authenticated user → nothing to load, but this is a resolved "zero" state.
    if (!user) {
      console.info("[useWorkspace] no auth user, clearing workspaces");
      setWorkspaces([]);
      setDebug({ lastResponse: null, parsedWorkspaceCount: 0, tokenAttached: false });
      setResolved(true);
      setLoading(false);
      return;
    }

    const token = session?.access_token;
    if (!token) {
      // Session not ready yet — keep loading, do NOT resolve to an empty state.
      console.info("[useWorkspace] auth user present but no access token yet, waiting", {
        userId: user.id,
      });
      setDebug((current) => ({ ...current, tokenAttached: false }));
      setLoading(true);
      setResolved(false);
      return;
    }

    setLoading(true);
    setError(null);
    console.info("[useWorkspace] loading workspaces", {
      userId: user.id,
      sessionExists: Boolean(session),
      tokenAttached: true,
    });
    setDebug((current) => ({ ...current, tokenAttached: true }));

    const { data, error } = await supabase.functions.invoke<{ workspaces?: Workspace[]; error?: string }>(
      "list-workspaces",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (error) {
      console.error("[useWorkspace] list-workspaces invoke error", error);
      setDebug((current) => ({ ...current, lastResponse: error, parsedWorkspaceCount: null }));
      setError(error.message);
      setResolved(false);
      setLoading(false);
      return;
    }

    if (data?.error) {
      console.error("[useWorkspace] list-workspaces returned error", data.error);
      setDebug((current) => ({ ...current, lastResponse: data, parsedWorkspaceCount: null }));
      setError(data.error);
      setResolved(false);
      setLoading(false);
      return;
    }

    const list = data?.workspaces ?? [];
    console.info("[useWorkspace] list-workspaces response", data);
    console.info("[useWorkspace] workspaces loaded", {
      userId: user.id,
      sessionExists: Boolean(session),
      accessTokenExists: Boolean(token),
      count: list.length,
      ids: list.map((w) => w.id),
    });

    setWorkspaces(list);
    setDebug({ lastResponse: data, parsedWorkspaceCount: list.length, tokenAttached: true });
    setResolved(true);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]);

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
        resolved,
        error,
        debug,
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

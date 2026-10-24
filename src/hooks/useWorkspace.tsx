import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type WorkspaceRole = "owner" | "manager" | "member" | "client";
export type Workspace = { id: string; name: string; slug: string; type: "freelancer" | "agency" | "consultant" | "other"; owner_id: string; role: WorkspaceRole };
type WorkspaceContextValue = {
  workspaces: Workspace[]; currentWorkspace: Workspace | null; role: WorkspaceRole | null;
  loading: boolean; resolved: boolean; error: string | null;
  selectWorkspace: (id: string) => void; refresh: () => Promise<void>;
};
const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

// Remount account-scoped state and children immediately on identity changes.
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <WorkspaceState key={user?.id ?? "signed-out"}>{children}</WorkspaceState>;
}
function WorkspaceState({ children }: { children: ReactNode }) {
  const { user, session, loading: authLoading } = useAuth();
  const storageKey = `ordo:current-workspace:${user?.id ?? "signed-out"}`;
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(() => {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const userId = user?.id;
  const token = session?.access_token;

  const load = useCallback(async () => {
    const request = ++sequence.current;
    pending.current?.abort();
    if (authLoading) { setLoading(true); return; }
    if (!userId) {
      setWorkspaces([]); setError(null); setResolved(true); setLoading(false); return;
    }
    if (!token) {
      setWorkspaces([]); setResolved(false); setLoading(false);
      setError("Your session is unavailable. Please sign in again."); return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setResolved(false); setError(null);
    try {
      const { data, error: requestError } = await supabase.functions.invoke<{ workspaces?: Workspace[]; error?: string }>("list-workspaces", {
        headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, timeout: 15000,
      });
      if (controller.signal.aborted || request !== sequence.current) return;
      if (requestError || data?.error || !Array.isArray(data?.workspaces)) {
        throw new Error("Workspace request failed");
      }
      setWorkspaces(data.workspaces); setResolved(true);
    } catch {
      if (!controller.signal.aborted && request === sequence.current) {
        setWorkspaces([]); setResolved(false);
        setError("We couldn't load your workspaces. Check your connection and try again.");
      }
    } finally {
      if (!controller.signal.aborted && request === sequence.current) setLoading(false);
    }
  }, [authLoading, userId, token]);
  useEffect(() => {
    void load();
    return () => { pending.current?.abort(); };
  }, [load]);
  const selectWorkspace = (id: string) => {
    // Onboarding may select a newly created workspace before the next fetch.
    setCurrentId(id);
    try { localStorage.setItem(storageKey, id); } catch { /* Memory selection still works. */ }
  };
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentId) ?? workspaces[0] ?? null;
  return <WorkspaceContext.Provider value={{ workspaces, currentWorkspace, role: currentWorkspace?.role ?? null, loading, resolved, error, selectWorkspace, refresh: load }}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}

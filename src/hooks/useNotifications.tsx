import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
  workspace_id: string | null;
}

/** Never navigate to an arbitrary URL stored in a notification row. */
export function notificationDestination(url: string | null, client: boolean): string | null {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return null;
  if (client) {
    const project = url.match(/^\/projects\/([a-f0-9-]{36})(?:\?.*)?$/i);
    if (project) return `/client/projects/${project[1]}`;
    if (url === "/client" || url.startsWith("/client/")) return url;
    if (url.startsWith("/auth/")) return url;
    return "/client";
  }
  if (url.startsWith("/client/")) return "/";
  if (/^\/(?:projects|tasks|inbox|activity|team|clients|settings)(?:\/|\?|$)/.test(url)) return url;
  if (url.startsWith("/auth/")) return url;
  return "/";
}

/** User and workspace scoped, with one shared cache across bell and Inbox. */
export function useNotifications() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const userId = user?.id;
  const workspaceId = currentWorkspace?.id;
  const key = ["notifications", userId, workspaceId];

  const query = useQuery({
    queryKey: key,
    enabled: !!userId && !!workspaceId,
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AppNotification[]> => {
      if (!userId || !workspaceId) return [];
      const { data, error } = await supabase.from("notifications")
        .select("id,type,title,body,url,read_at,created_at,workspace_id")
        .eq("user_id", userId)
        .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
  });

  useEffect(() => {
    if (!userId || !workspaceId) return;
    const channel = supabase.channel(`notifications-${userId}-${workspaceId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}`,
      }, () => { void qc.invalidateQueries({ queryKey: key }); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, workspaceId, qc]);

  const markRead = useCallback(async (id: string) => {
    if (!userId) return;
    const { data, error } = await supabase.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id",id).eq("user_id",userId).is("read_at",null).select("id");
    if (error) throw error;
    // A previously-read notification is not an error.
    if (!data?.length && !(query.data ?? []).some(item => item.id === id && item.read_at)) {
      throw new Error("Could not mark this notification as read.");
    }
    await qc.invalidateQueries({ queryKey: ["notifications", userId] });
  }, [userId, qc, query.data]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const unread = (query.data ?? []).filter(n => !n.read_at).map(n => n.id);
    if (!unread.length) return;
    const { error } = await supabase.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId).in("id",unread);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["notifications", userId] });
  }, [query.data, userId, qc]);

  return {
    items: query.data ?? [],
    loading: query.isPending,
    error: query.isError,
    unreadCount: (query.data ?? []).filter(item=>!item.read_at).length,
    reload: query.refetch,
    markRead,
    markAllRead,
  };
}

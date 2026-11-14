import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Live in-app notifications for the signed-in user. Subscribes to realtime
 * inserts so the bell updates without a refresh.
 */
export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, url, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      setError(true);
      setLoading(false);
      return;
    }
    setItems((data ?? []) as AppNotification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setItems((prev) => [payload.new as AppNotification, ...prev].slice(0, 30));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markRead = useCallback(async (id: string) => {
    if (!user) return;
    const item = items.find((entry) => entry.id === id);
    if (!item || item.read_at) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((entry) => entry.id === id ? { ...entry, read_at: now } : entry));
    const { error } = await supabase.from("notifications").update({ read_at: now })
      .eq("id", id).eq("user_id", user.id).is("read_at", null);
    if (error) await load();
  }, [items, user, load]);

  const markAllRead = useCallback(async () => {
    const unread = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread)
      .eq("user_id", user!.id);
    if (error) await load();
  }, [items, user, load]);

  return { items, loading, error, unreadCount, reload: load, markAllRead, markRead };
}

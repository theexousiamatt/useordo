import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, Inbox as InboxIcon, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/hooks/useNotifications";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function Inbox() {
  const { items, loading, error, reload, markAllRead, markRead } = useNotifications();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const visible = useMemo(() => onlyUnread ? items.filter((item) => !item.read_at) : items, [items, onlyUnread]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Collaboration</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">Assignments, comments, decisions and important team updates.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void reload()} aria-label="Refresh inbox">
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => void markAllRead()} disabled={!items.some((item) => !item.read_at)}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all read
          </Button>
        </div>
      </header>
      <div className="flex gap-1 rounded-xl bg-card p-1.5 self-start" role="group" aria-label="Filter notifications">
        <button type="button" onClick={() => setOnlyUnread(false)}
          className={cn("rounded-lg px-4 py-2 text-sm font-medium", !onlyUnread ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>All</button>
        <button type="button" onClick={() => setOnlyUnread(true)}
          className={cn("rounded-lg px-4 py-2 text-sm font-medium", onlyUnread ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>
          Unread {items.filter((item) => !item.read_at).length > 0 ? `(${items.filter((item) => !item.read_at).length})` : ""}
        </button>
      </div>
      {loading ? <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        : error ? <Card className="space-y-3 rounded-panel p-7"><p className="text-sm">Notifications couldn't be loaded.</p><Button onClick={() => void reload()} variant="outline">Try again</Button></Card>
        : !visible.length ? <Card className="flex flex-col items-center gap-2 rounded-panel px-6 py-14 text-center">
          <InboxIcon className="h-7 w-7 text-muted-foreground" />
          <h2 className="font-medium">{onlyUnread ? "You're all caught up" : "No notifications yet"}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">New task assignments and collaboration updates will appear here.</p>
        </Card> : <Card className="divide-y divide-border overflow-hidden rounded-panel">
          {visible.map((item) => {
            const target = item.url?.startsWith("/") && !item.url.startsWith("//") ? item.url : null;
            const row = <div className="flex items-start gap-3 px-5 py-4">
              <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", item.read_at ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary")}>
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm font-medium">{item.title}</p>
                  {!item.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </div>
                {item.body && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{timeAgo(item.created_at)}</p>
              </div>
            </div>;
            return target ? <Link to={target} key={item.id} className="block transition-colors hover:bg-muted/40"
              onClick={() => { if (!item.read_at) void markRead(item.id); }}>{row}</Link>
              : <div key={item.id}>{row}</div>;
          })}
        </Card>}
    </div>
  );
}

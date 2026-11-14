import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Inbox, MessageSquareText, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useNotifications, notificationDestination } from "@/hooks/useNotifications";
import { useWorkspace } from "@/hooks/useWorkspace";
import { dateShort, timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread";
function category(type: string) {
  if (/comment|mention|feedback/i.test(type)) return "Discussion";
  if (/assign|task/i.test(type)) return "Assignments";
  if (/approval|deliverable|review/i.test(type)) return "Reviews";
  return "Update";
}

export default function InboxPage() {
  const navigate = useNavigate();
  const { role } = useWorkspace();
  const client = role === "client";
  const { items, loading, error, reload, unreadCount, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => items.filter(item =>
    (filter === "all" || !item.read_at) &&
    (categoryFilter === "All" || category(item.type) === categoryFilter)
  ), [items, filter, categoryFilter]);

  const openNotification = async (id: string, url: string | null, read: boolean) => {
    if (!read) {
      try { await markRead(id); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't mark as read"); }
    }
    const destination = notificationDestination(url, client);
    if (destination) navigate(destination);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Keep up with your work</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Assignments, conversations, approvals and project notifications.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={busy || !unreadCount}
          onClick={async () => {
            setBusy(true);
            try { await markAllRead(); toast.success("Inbox marked as read"); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't update notifications"); }
            finally { setBusy(false); }
          }}>
          <CheckCheck className="mr-1.5 h-4 w-4" aria-hidden="true"/>
          Mark all read
        </Button>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-pill border border-border bg-card p-1" role="group" aria-label="Inbox status">
          {(["all","unread"] as const).map(value=>(
            <button key={value} type="button" onClick={()=>setFilter(value)}
              aria-pressed={filter===value}
              className={cn("rounded-pill px-4 py-2 text-xs font-semibold transition-colors",
                filter===value?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground")}>
              {value==="all"?"All updates":`Unread (${unreadCount})`}
            </button>
          ))}
        </div>
        <div className="flex max-w-full gap-1.5 overflow-x-auto" role="group" aria-label="Notification category">
          {["All","Assignments","Discussion","Reviews"].map(item=>(
            <button key={item} type="button" onClick={()=>setCategoryFilter(item)} aria-pressed={categoryFilter===item}
              className={cn("shrink-0 rounded-pill border px-3 py-2 text-xs font-medium transition-colors",
                categoryFilter===item?"border-primary text-primary bg-primary/5":"border-border text-muted-foreground hover:text-foreground")}>
              {item}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({length:4},(_,i)=><Skeleton key={i} className="h-20 w-full rounded-panel"/>)}</div>
      ) : error ? (
        <div role="alert" className="rounded-panel border border-border bg-card p-6">
          <p className="text-sm">Couldn't load your notifications.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={()=>void reload()}>
            <RefreshCcw className="mr-2 h-4 w-4"/> Try again
          </Button>
        </div>
      ) : !visible.length ? (
        <div className="rounded-panel border border-border bg-card p-10 text-center">
          <Inbox className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true"/>
          <h2 className="mt-3 text-base font-semibold">{filter==="unread"?"You're all caught up":"No updates here"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter==="unread"?"New updates will appear here when your team collaborates.":"Try another filter or check back after your team makes changes."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-card">
          {visible.map(item=>{
            const destination=notificationDestination(item.url,client);
            const unread=!item.read_at;
            return (
              <button key={item.id} type="button"
                onClick={()=>void openNotification(item.id,item.url,!unread)}
                className={cn("flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5",
                  unread&&"bg-primary/[0.025]")}>
                <span className={cn("mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-small",
                  unread?"bg-primary/10 text-primary":"bg-muted text-muted-foreground")}>
                  {category(item.type)==="Discussion"?<MessageSquareText className="h-[17px] w-[17px]"/>:<Bell className="h-[17px] w-[17px]"/>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <p className={cn("break-words text-sm",unread?"font-semibold":"font-medium")}>{item.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground" title={dateShort(item.created_at)}>{timeAgo(item.created_at)}</span>
                  </div>
                  {item.body&&<p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.body}</p>}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {category(item.type)}{destination?" · Open related work":""}
                  </p>
                </div>
                {unread&&<span aria-label="Unread" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

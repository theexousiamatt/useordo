import { useState } from "react";
import { Bell, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useNotifications, notificationDestination } from "@/hooks/useNotifications";
import { timeAgo } from "@/lib/format";

export function NotificationButton() {
  const navigate = useNavigate();
  const { role } = useWorkspace();
  const client = role === "client";
  const inbox = client ? "/client/inbox" : "/inbox";
  const { items, unreadCount, markRead } = useNotifications();
  const [open,setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground shadow-panel outline-none transition-transform hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[hsl(var(--badge-red-text))]" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(330px,calc(100vw-24px))]">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <DropdownMenuLabel className="px-0">Inbox {unreadCount > 0 ? `· ${unreadCount} unread` : ""}</DropdownMenuLabel>
          <button type="button" onClick={()=>{setOpen(false);navigate(inbox);}}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            View all <ArrowUpRight className="h-3 w-3"/>
          </button>
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
        ) : (
          <ul className="max-h-72 overflow-y-auto py-1">
            {items.slice(0,5).map(n=>(
              <li key={n.id}>
                <button type="button" onClick={async()=>{
                  if(!n.read_at){try{await markRead(n.id);}catch(e){toast.error(e instanceof Error?e.message:"Couldn't mark as read");}}
                  setOpen(false);
                  navigate(notificationDestination(n.url, client) ?? inbox);
                }} className="flex w-full items-start gap-2.5 rounded-small px-2.5 py-3 text-left text-sm hover:bg-muted/60">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at?"bg-transparent":"bg-primary"}`} aria-hidden="true"/>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{n.title}</span>
                    {n.body&&<span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body}</span>}
                    <span className="mt-1 block text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

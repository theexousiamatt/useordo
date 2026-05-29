import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClientActivity } from "@/hooks/useClientDashboard";
import { timeAgo } from "@/lib/format";

export function NotificationButton() {
  const { data: activity } = useClientActivity(5);
  const count = activity?.length ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Notifications${count ? `, ${count} recent` : ""}`}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground shadow-panel outline-none transition-transform hover:-translate-y-0.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[hsl(var(--badge-red-text))]" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Recent notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">You're all caught up.</p>
        ) : (
          <ul className="max-h-72 overflow-auto py-1">
            {activity!.map((a) => (
              <li key={a.id} className="px-2 py-2 text-sm">
                <p className="truncate">{(a.payload?.title as string) ?? a.type.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

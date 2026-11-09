import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Settings, User, Mail } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/format";

export function UserProfileMenu({ settingsPath = "/client/settings" }: { settingsPath?: string }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex items-center gap-3 rounded-pill bg-card py-1.5 pl-1.5 pr-4 shadow-panel outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-secondary text-xs text-foreground">{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">{name}</span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:inline" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate text-sm">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/auth/invitations")} className="gap-2"><Mail className="h-4 w-4" />Invitations</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(settingsPath)} className="gap-2">
          <User className="h-4 w-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(settingsPath)} className="gap-2">
          <Settings className="h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { void signOut().catch(() => toast.error("Could not sign out. Check your connection and try again.")); }} className="gap-2 text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

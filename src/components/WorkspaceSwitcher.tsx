import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { workspaces, currentWorkspace, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();

  if (!currentWorkspace) return null;

  const initial = currentWorkspace.name.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-white/30"
        aria-label="Switch workspace"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-sm font-semibold text-white">
          {initial}
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-white">{currentWorkspace.name}</div>
              <div className="truncate text-[11px] capitalize text-white/60">
                {currentWorkspace.role}
              </div>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-white/60" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onClick={() => selectWorkspace(w.id)}
            className="gap-2"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-medium">
              {w.name.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 truncate">{w.name}</span>
            <Check
              className={cn(
                "h-4 w-4",
                w.id === currentWorkspace.id ? "opacity-100" : "opacity-0",
              )}
            />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/onboarding")} className="gap-2">
          <Plus className="h-4 w-4" />
          New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Search, UserX, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { roleLabel } from "@/lib/roles";
import type { ProjectMemberProfile } from "@/hooks/useProjects";

interface InlineMemberPickerProps {
  members: ProjectMemberProfile[];
  /** Current assignee ids. */
  value: string[];
  /** Called with the next full set of assignee ids whenever the selection changes. */
  onChange: (userIds: string[]) => void;
}

/**
 * InlineMemberPicker — anchored popover body to assign one or many members.
 * Search + multi-select over the project's assignable members (workspace
 * collaborators today; project members once project-scoped perms land).
 * Persists instantly via the task_assignees relationship. The popover stays
 * open so several members can be toggled in a single pass.
 */
export function InlineMemberPicker({ members, value, onChange }: InlineMemberPickerProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => {
        if (!q) return true;
        return (
          (m.full_name ?? "").toLowerCase().includes(q) ||
          (m.email ?? "").toLowerCase().includes(q)
        );
      })
      // Assigned members surface first, then alphabetically.
      .sort((a, b) => {
        const aSel = value.includes(a.user_id) ? 0 : 1;
        const bSel = value.includes(b.user_id) ? 0 : 1;
        if (aSel !== bSel) return aSel - bSel;
        return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      });
  }, [members, query, value]);

  const toggle = (userId: string) => {
    if (value.includes(userId)) {
      onChange(value.filter((id) => id !== userId));
    } else {
      onChange([...value, userId]);
    }
  };

  // Empty state — no assignable members in this workspace yet.
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <UserPlus className="h-5 w-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">No team members yet</p>
          <p className="text-xs text-muted-foreground">
            Invite people to your workspace to assign them to tasks.
          </p>
        </div>
        <Link
          to="/team"
          className="inline-flex items-center gap-1.5 rounded-small bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite members
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>

      <div className="max-h-72 overflow-y-auto p-1.5">
        <button
          type="button"
          onClick={() => onChange([])}
          className="flex w-full items-center justify-between gap-2 rounded-small px-2.5 py-1.5 text-left text-sm hover:bg-secondary"
        >
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-border">
              <UserX className="h-3.5 w-3.5" />
            </span>
            Clear all
          </span>
          {value.length === 0 && <Check className="h-4 w-4 shrink-0 text-primary" />}
        </button>

        {filtered.map((m) => {
          const active = value.includes(m.user_id);
          return (
            <button
              key={m.user_id}
              type="button"
              onClick={() => toggle(m.user_id)}
              className="flex w-full items-center justify-between gap-2 rounded-small px-2.5 py-1.5 text-left text-sm hover:bg-secondary"
            >
              <span className="inline-flex min-w-0 items-center gap-2.5">
                <Avatar className="h-7 w-7">
                  {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name ?? ""} />}
                  <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
                    {initials(m.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate leading-tight">{m.full_name ?? "Member"}</span>
                  {m.email && (
                    <span className="truncate text-[11px] leading-tight text-muted-foreground">
                      {m.email}
                    </span>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-pill bg-secondary px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                  {roleLabel(m.role)}
                </span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </span>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="px-2.5 py-3 text-center text-xs text-muted-foreground">No members found.</p>
        )}
      </div>
    </div>
  );
}

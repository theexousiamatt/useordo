import { useMemo, useState } from "react";
import { Check, Search, UserX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
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
 * Search + multi-select. Persists instantly via the task_assignees relationship.
 * Reusable across task surfaces. The popover stays open so several members can be
 * toggled in a single pass.
 */
export function InlineMemberPicker({ members, value, onChange }: InlineMemberPickerProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      members
        .filter((m) =>
          (m.full_name ?? "").toLowerCase().includes(query.trim().toLowerCase()),
        )
        // Assigned members surface first, then the rest alphabetically by selection.
        .sort((a, b) => {
          const aSel = value.includes(a.user_id) ? 0 : 1;
          const bSel = value.includes(b.user_id) ? 0 : 1;
          if (aSel !== bSel) return aSel - bSel;
          return (a.full_name ?? "").localeCompare(b.full_name ?? "");
        }),
    [members, query, value],
  );


  const toggle = (userId: string) => {
    if (value.includes(userId)) {
      onChange(value.filter((id) => id !== userId));
    } else {
      onChange([...value, userId]);
    }
  };

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

      <div className="max-h-60 overflow-y-auto p-1.5">
        <button
          type="button"
          onClick={() => onChange([])}
          className="flex w-full items-center justify-between gap-2 rounded-small px-2.5 py-1.5 text-left text-sm hover:bg-secondary"
        >
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border">
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
              <span className="inline-flex min-w-0 items-center gap-2">
                <Avatar className="h-6 w-6">
                  {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name ?? ""} />}
                  <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
                    {initials(m.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{m.full_name ?? "Member"}</span>
              </span>
              {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
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

import { useMemo, useState } from "react";
import { Check, Search, UserX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import type { ProjectMemberProfile } from "@/hooks/useProjects";

interface InlineMemberPickerProps {
  members: ProjectMemberProfile[];
  /** Current assignee id, or null. */
  value: string | null;
  onChange: (userId: string | null) => void;
}

/**
 * InlineMemberPicker — anchored popover body to (re)assign a task.
 * Search + select. Persists instantly. Reusable across task surfaces.
 *
 * The data model carries a single assignee per task; multi-assignee support
 * would require a task_assignees join table.
 */
export function InlineMemberPicker({ members, value, onChange }: InlineMemberPickerProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      members.filter((m) =>
        (m.full_name ?? "").toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [members, query],
  );

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
          onClick={() => onChange(null)}
          className="flex w-full items-center justify-between gap-2 rounded-small px-2.5 py-1.5 text-left text-sm hover:bg-secondary"
        >
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border">
              <UserX className="h-3.5 w-3.5" />
            </span>
            Unassigned
          </span>
          {value === null && <Check className="h-4 w-4 shrink-0 text-primary" />}
        </button>

        {filtered.map((m) => {
          const active = value === m.user_id;
          return (
            <button
              key={m.user_id}
              type="button"
              onClick={() => onChange(m.user_id)}
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

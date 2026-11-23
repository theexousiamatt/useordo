import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const fallbackTones = [
  { backgroundColor: "#f4dcc9", color: "#763916" },
  { backgroundColor: "#ead9ed", color: "#68377f" },
  { backgroundColor: "#dbead9", color: "#2f5d3b" },
  { backgroundColor: "#f6e6b7", color: "#6b4a0a" },
  { backgroundColor: "#d8ecec", color: "#285762" },
  { backgroundColor: "#f5dde2", color: "#8a3f50" },
];

/** Prefer a consonant from the displayed initials so matching initials keep the same color. */
function memberAvatarTone(name: string | null, identity: string) {
  const normalized = (name ?? "").normalize("NFD").toUpperCase().replace(/[\u0300-\u036f]/g, "");
  const visibleInitials = normalized.trim().split(/\s+/).slice(0, 2).map(word => word[0] ?? "").join("");
  const consonant = visibleInitials.match(/[B-DF-HJ-NP-TV-Z]/)?.[0] ?? normalized.match(/[B-DF-HJ-NP-TV-Z]/)?.[0];
  if (consonant === "M") return { backgroundColor: "#e1dff1", color: "#5a65ff" };
  const key = consonant ?? normalized.match(/[A-Z]/)?.[0] ?? identity[0] ?? "J";
  return fallbackTones[key.charCodeAt(0) % fallbackTones.length];
}

interface Member {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function MemberAvatars({
  members,
  max = 4,
  size = "default",
}: {
  members: Member[];
  max?: number;
  size?: "sm" | "default";
}) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  const sz = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";

  return (
    <div className="flex -space-x-2">
      {shown.map((m) => (
        <Tooltip key={m.user_id}>
          <TooltipTrigger asChild>
            <Avatar className={cn(sz, "ring-2 ring-background")}>
              {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name ?? ""} />}
              <AvatarFallback className="font-bold" style={memberAvatarTone(m.full_name, m.user_id)}>
                {initials(m.full_name?.trim())}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>{m.full_name ?? "Unknown"}</TooltipContent>
        </Tooltip>
      ))}
      {extra > 0 && (
        <div
          className={cn(
            sz,
            "flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background",
          )}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

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
              <AvatarFallback className="bg-muted text-muted-foreground">
                {initials(m.full_name)}
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

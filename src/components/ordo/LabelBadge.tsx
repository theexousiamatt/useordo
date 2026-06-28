import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { labelColor } from "@/lib/labelColors";

export interface LabelBadgeProps {
  name: string;
  /** Color token (e.g. "blue"); resolved via the curated label palette. */
  color: string;
  size?: "sm" | "md";
  /** When provided, renders a removable "×" affordance. */
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

/**
 * LabelBadge — THE single label pill used everywhere in Ordo (task cards, task
 * drawer, board, list, calendar, filters, search). Color, text, hover and
 * selection are all derived from the curated palette in `labelColors.ts`.
 * Never build an alternate label visual — compose this component instead.
 */
export function LabelBadge({ name, color, size = "md", onRemove, onClick, className }: LabelBadgeProps) {
  const c = labelColor(color);
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-pill font-semibold leading-none transition-colors",
        size === "sm" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1 text-[11px]",
        c.pill,
        onClick && "cursor-pointer hover:opacity-80",
        className,
      )}
    >
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-0.5 shrink-0 opacity-60 transition-opacity hover:opacity-100"
          aria-label={`Remove ${name}`}
        >
          <X className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </button>
      )}
    </Comp>
  );
}

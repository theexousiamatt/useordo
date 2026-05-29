import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * OrdoCard — the canonical surface primitive for Ordo OS.
 * Soft elevation, large radius, calm spacing. Use for every panel/card
 * across the app instead of raw divs or generic shadcn Card.
 */
interface OrdoCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover lift + pointer affordance (for clickable cards). */
  interactive?: boolean;
  /** Visual weight: `card` (default) or larger `panel`. */
  variant?: "card" | "panel";
  /** Remove default padding when composing custom layouts. */
  flush?: boolean;
}

export const OrdoCard = forwardRef<HTMLDivElement, OrdoCardProps>(
  ({ className, interactive, variant = "card", flush, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-card text-card-foreground shadow-panel",
        variant === "panel" ? "rounded-panel" : "rounded-card",
        !flush && "p-6",
        interactive &&
          "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  ),
);
OrdoCard.displayName = "OrdoCard";

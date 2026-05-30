import { forwardRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * OrdoTextarea — canonical multiline input for Ordo forms. Matches OrdoInput
 * surface, radius, and brand focus ring.
 */
export type OrdoTextareaProps = React.ComponentPropsWithoutRef<typeof Textarea>;

export const OrdoTextarea = forwardRef<HTMLTextAreaElement, OrdoTextareaProps>(
  ({ className, ...props }, ref) => (
    <Textarea
      ref={ref}
      className={cn(
        "min-h-[96px] rounded-small border-border bg-card px-3.5 py-3 text-sm shadow-subtle",
        "placeholder:text-muted-foreground/70 resize-none",
        "focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-primary/40 focus-visible:ring-offset-0",
        "transition-colors",
        className,
      )}
      {...props}
    />
  ),
);
OrdoTextarea.displayName = "OrdoTextarea";

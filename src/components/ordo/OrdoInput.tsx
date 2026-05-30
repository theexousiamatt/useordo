import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * OrdoInput — canonical text input for all Ordo forms. Soft surface, large
 * radius, calm brand focus ring. Use across every creation/edit flow.
 */
export type OrdoInputProps = React.ComponentPropsWithoutRef<typeof Input>;

export const OrdoInput = forwardRef<HTMLInputElement, OrdoInputProps>(
  ({ className, ...props }, ref) => (
    <Input
      ref={ref}
      className={cn(
        "h-11 rounded-small border-border bg-card px-3.5 text-sm shadow-subtle",
        "placeholder:text-muted-foreground/70",
        "focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-primary/40 focus-visible:ring-offset-0",
        "transition-colors",
        className,
      )}
      {...props}
    />
  ),
);
OrdoInput.displayName = "OrdoInput";

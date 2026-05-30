import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrdoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost";
  fullWidth?: boolean;
}

/** Primary pill-shaped Ordo OS action button with built-in loading state. */
export const OrdoButton = React.forwardRef<HTMLButtonElement, OrdoButtonProps>(
  ({ loading, variant = "primary", fullWidth = true, className, children, disabled, ...props }, ref) => {
    const variants = {
      primary: "bg-foreground text-card hover:opacity-90",
      outline: "border border-border bg-card text-foreground hover:bg-secondary",
      ghost: "text-foreground hover:bg-secondary",
    };
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-pill px-6 py-3.5 text-[15px] font-medium transition-all",
          "disabled:pointer-events-none disabled:opacity-60",
          "hover:-translate-y-px active:translate-y-0",
          variants[variant],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
OrdoButton.displayName = "OrdoButton";

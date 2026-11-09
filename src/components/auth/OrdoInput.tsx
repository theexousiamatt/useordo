import * as React from "react";
import { cn } from "@/lib/utils";

interface OrdoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  rightSlot?: React.ReactNode;
}

/** Premium Ordo OS text input with label, error and shake-on-invalid treatment. */
export const OrdoInput = React.forwardRef<HTMLInputElement, OrdoInputProps>(
  ({ label, error, hint, rightSlot, id, className, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            className={cn(
              "w-full rounded-small border bg-card px-4 py-3.5 text-[15px] text-foreground transition-all",
              "placeholder:text-[hsl(var(--text-tertiary))]",
              "focus:outline-hidden focus:ring-4",
              error
                ? "border-destructive bg-destructive/5 focus:ring-destructive/10 animate-[shake_0.4s_linear]"
                : "border-border focus:border-accent focus:ring-accent/10",
              rightSlot && "pr-12",
              className,
            )}
            {...props}
          />
          {rightSlot && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">{rightSlot}</div>
          )}
        </div>
        {error ? (
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-destructive">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </p>
        ) : hint ? (
          <p className="text-[13px] text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    );
  },
);
OrdoInput.displayName = "OrdoInput";

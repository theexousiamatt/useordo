import { type FormHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * OrdoForm — canonical form layout primitives. OrdoForm provides consistent
 * vertical rhythm; OrdoFormSection groups related fields with an optional
 * heading. Use across every Ordo creation/edit flow for visual consistency.
 */
export function OrdoForm({
  className,
  children,
  ...props
}: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className={cn("space-y-6", className)} {...props}>
      {children}
    </form>
  );
}

export function OrdoFormSection({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-0.5">
          {title && (
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function OrdoFormRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

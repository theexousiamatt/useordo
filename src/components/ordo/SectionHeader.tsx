import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * SectionHeader — consistent section/group heading used inside pages and panels.
 * For full-page titles prefer PageHeader; use this for sections within a page.
 */
interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  size?: "sm" | "md";
}

export function SectionHeader({ title, description, actions, className, size = "md" }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <h2 className={cn("truncate font-semibold tracking-tight", size === "md" ? "text-lg" : "text-base")}>
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

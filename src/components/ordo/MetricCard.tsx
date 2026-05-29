import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrdoCard } from "./OrdoCard";

/**
 * MetricCard — executive-level stat presentation. Calm, premium, token-based.
 */
interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  className?: string;
}

export function MetricCard({ label, value, icon: Icon, hint, trend, className }: MetricCardProps) {
  return (
    <OrdoCard className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-small bg-secondary text-muted-foreground">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {trend && (
          <span
            className={cn(
              "mb-1 text-xs font-semibold",
              trend.direction === "up" && "text-[hsl(var(--badge-green-text))]",
              trend.direction === "down" && "text-[hsl(var(--badge-red-text))]",
              trend.direction === "flat" && "text-muted-foreground",
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </OrdoCard>
  );
}

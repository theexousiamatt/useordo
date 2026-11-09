import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface FeaturePreviewCardProps {
  badge?: { icon?: LucideIcon; label: string };
  title: string;
  description: string;
  /** Illustration / product preview rendered in the soft container. */
  preview: ReactNode;
  className?: string;
}

/**
 * FeaturePreviewCard — educational preview + explanation block used on
 * non-form onboarding steps (welcome, tour, completion). Reusable for any
 * feature-introduction surface.
 */
export function FeaturePreviewCard({ badge, title, description, preview, className }: FeaturePreviewCardProps) {
  return (
    <div className={cn("flex flex-1 flex-col gap-6", className)}>
      <div className="flex flex-1 items-center justify-center rounded-card bg-background p-6 sm:p-8">
        {preview}
      </div>
      <div className="space-y-3">
        {badge && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-pill bg-[hsl(var(--legacy-accent)/0.12)] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--legacy-accent))]">
            {badge.icon && <badge.icon className="h-3.5 w-3.5" />}
            {badge.label}
          </span>
        )}
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-prose text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/** Generic soft skeleton-style mockup used inside FeaturePreviewCard. */
export function MockupPreview({ rows = 3 }: { rows?: number }) {
  return (
    <div className="w-full max-w-[320px] rounded-card bg-card p-5 shadow-panel">
      <div className="mb-4 h-4 w-3/5 rounded-sm bg-secondary" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-small bg-secondary px-3 py-3">
            <span className="h-6 w-6 shrink-0 rounded-full bg-border" />
            <span className="h-2.5 flex-1 rounded-sm bg-border" />
          </div>
        ))}
      </div>
    </div>
  );
}

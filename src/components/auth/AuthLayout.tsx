import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

function OrdoMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-12 w-12 items-center justify-center rounded-small bg-foreground", className)}>
      <span className="h-5 w-5 rounded-full border-[3px] border-card" />
    </div>
  );
}

/** A lightweight product preview mockup shown on the auth left panel. */
function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-card shadow-panel">
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="ml-3 h-2 w-24 rounded-pill bg-secondary" />
      </div>
      <div className="space-y-3 p-4">
        {[
          { w: "w-2/3", tone: "bg-success/70" },
          { w: "w-1/2", tone: "bg-accent/70" },
          { w: "w-3/4", tone: "bg-warning/70" },
        ].map((row, i) => (
          <div key={i} className="flex items-center gap-3 rounded-small bg-secondary/60 p-3">
            <span className={cn("h-7 w-7 shrink-0 rounded-full", row.tone)} />
            <div className="flex-1 space-y-1.5">
              <span className={cn("block h-2 rounded-pill bg-foreground/15", row.w)} />
              <span className="block h-2 w-1/3 rounded-pill bg-foreground/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AuthLayoutProps {
  /** Left-panel dynamic headline. */
  panelTitle: string;
  /** Left-panel context copy. */
  panelSubtitle: string;
  /** Optional banner rendered above the form (e.g. account locked). */
  banner?: ReactNode;
  /** Hide the product preview (used on simple status screens). */
  showPreview?: boolean;
  children: ReactNode;
}

/**
 * AuthLayout — canonical two-panel Ordo OS authentication shell.
 * Desktop: identity/preview panel + form panel.
 * Mobile: single column with preview/messaging above the form.
 */
export function AuthLayout({
  panelTitle,
  panelSubtitle,
  banner,
  showPreview = true,
  children,
}: AuthLayoutProps) {
  return (
    <div className="client-os flex min-h-screen items-center justify-center bg-background p-4 sm:p-8">
      <div className="flex w-full max-w-5xl flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-10">
        {/* Left identity panel */}
        <aside className="flex flex-col justify-center lg:w-[340px] lg:shrink-0">
          <OrdoMark className="mb-6" />
          <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]">
            {panelTitle}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            {panelSubtitle}
          </p>
          {showPreview && (
            <div className="mt-8 hidden lg:block">
              <ProductPreview />
            </div>
          )}
        </aside>

        {/* Right form panel */}
        <main className="flex flex-1 flex-col overflow-hidden rounded-panel bg-card shadow-panel">
          {banner}
          <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12 lg:px-16">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

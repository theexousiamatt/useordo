import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OnboardingSidebar } from "./OnboardingSidebar";
import { OnboardingStepper } from "./OnboardingStepper";

interface OnboardingShellProps {
  current: number;
  sidebarTitle: string;
  sidebarSubtitle: string;
  /** Footer actions area (Back / Skip / Continue). */
  footer?: ReactNode;
  children: ReactNode;
}

function OrdoMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-small bg-foreground">
      <span className="h-4 w-4 rounded-full border-[3px] border-card" />
    </div>
  );
}

/**
 * OnboardingShell — canonical two-column onboarding layout for Ordo OS.
 * Desktop: left identity/stepper sidebar + right premium panel.
 * Mobile: stacked, with a horizontal progress indicator.
 * Reusable for feature introductions, AI onboarding, and module walkthroughs.
 */
export function OnboardingShell({
  current,
  sidebarTitle,
  sidebarSubtitle,
  footer,
  children,
}: OnboardingShellProps) {
  return (
    <div className="client-os flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div className="flex w-full max-w-5xl flex-col gap-6 lg:flex-row lg:gap-10">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <OnboardingSidebar current={current} title={sidebarTitle} subtitle={sidebarSubtitle} />
        </div>

        {/* Mobile header */}
        <div className="flex flex-col gap-4 lg:hidden">
          <div className="flex items-center gap-3">
            <OrdoMark />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight">{sidebarTitle}</h1>
              <p className="truncate text-sm text-muted-foreground">{sidebarSubtitle}</p>
            </div>
          </div>
          <OnboardingStepper current={current} orientation="horizontal" />
        </div>

        {/* Main panel */}
        <main
          className={cn(
            "flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-panel bg-card shadow-panel",
          )}
        >
          <div className="flex flex-1 flex-col p-6 sm:p-8">{children}</div>
          {footer && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-5 sm:px-8">
              {footer}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

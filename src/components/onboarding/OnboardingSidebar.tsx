import { OnboardingStepper } from "./OnboardingStepper";
import { OrdoIcon } from "@/components/brand";

interface OnboardingSidebarProps {
  current: number;
  /** Workspace name once created; falls back to a welcome message. */
  title: string;
  subtitle: string;
}

function OrdoMark() {
  return <OrdoIcon tone="light" className="mb-6 h-10 w-10" title="Ordo" />;
}

/**
 * OnboardingSidebar — left panel: Ordo logo, workspace identity, vertical stepper.
 * Hidden on mobile (shell renders a compact header instead).
 */
export function OnboardingSidebar({ current, title, subtitle }: OnboardingSidebarProps) {
  return (
    <aside className="flex w-[300px] shrink-0 flex-col">
      <div className="mb-8">
        <OrdoMark />
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">{subtitle}</p>
      </div>
      <OnboardingStepper current={current} />
    </aside>
  );
}

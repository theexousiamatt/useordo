import { type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarTooltipProps {
  label: string;
  /** Only show the tooltip in the collapsed icon-only state. */
  enabled: boolean;
  children: ReactNode;
}

/**
 * Wraps a sidebar nav item with a right-side tooltip when the rail is collapsed.
 * When expanded, the label is visible inline so the tooltip is disabled —
 * keying on `enabled` fully unmounts the Tooltip to avoid flicker on toggle.
 */
export function SidebarTooltip({ label, enabled, children }: SidebarTooltipProps) {
  if (!enabled) return <>{children}</>;

  return (
    <Tooltip key="collapsed" delayDuration={0} disableHoverableContent>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

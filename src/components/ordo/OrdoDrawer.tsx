import { type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * OrdoDrawer — canonical side sheet for detail views, task panels, and
 * layered workflows. Prefer this over stacked modals across Ordo OS.
 */
interface OrdoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  side?: "right" | "left";
  /** Sticky footer area for primary/secondary actions. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function OrdoDrawer({
  open,
  onOpenChange,
  title,
  description,
  side = "right",
  footer,
  children,
  className,
}: OrdoDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "client-os flex w-full flex-col gap-0 border-none bg-card p-0 shadow-hover sm:max-w-md",
          className,
        )}
      >
        {(title || description) && (
          <SheetHeader className="space-y-1 border-b border-border px-6 py-5 text-left">
            {title && <SheetTitle className="text-lg font-semibold tracking-tight">{title}</SheetTitle>}
            {description && (
              <SheetDescription className="text-sm text-muted-foreground">{description}</SheetDescription>
            )}
          </SheetHeader>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

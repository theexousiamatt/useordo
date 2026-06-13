import { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Ordo OS — universal menu framework.
 *
 * A single config-driven action model that powers right-click, the context-menu
 * keyboard key, mobile long-press (Radix ContextMenu) and the three-dot overflow
 * (DropdownMenu). Every entry point renders the EXACT same actions.
 *
 * Reuse this across Projects, Tasks, Deliverables, Clients, Files, Team, AI
 * planning, Activity and Notifications — do not invent new menu patterns.
 */

export interface OrdoMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  /** Renders with destructive styling. */
  destructive?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  /** Nested actions (e.g. "Move to…", "Change priority"). */
  submenu?: OrdoMenuItem[];
  /** Highlights the item as an AI-powered action. */
  ai?: boolean;
}

export interface OrdoMenuSection {
  id: string;
  label?: string;
  items: OrdoMenuItem[];
}

export type OrdoMenuConfig = OrdoMenuSection[];

/** Component set shared between ContextMenu and DropdownMenu primitives. */
interface Primitives {
  Item: typeof ContextMenuItem | typeof DropdownMenuItem;
  Label: typeof ContextMenuLabel | typeof DropdownMenuLabel;
  Separator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator;
  Shortcut: typeof ContextMenuShortcut | typeof DropdownMenuShortcut;
  Sub: typeof ContextMenuSub | typeof DropdownMenuSub;
  SubTrigger: typeof ContextMenuSubTrigger | typeof DropdownMenuSubTrigger;
  SubContent: typeof ContextMenuSubContent | typeof DropdownMenuSubContent;
}

const CONTEXT_PRIMS: Primitives = {
  Item: ContextMenuItem,
  Label: ContextMenuLabel,
  Separator: ContextMenuSeparator,
  Shortcut: ContextMenuShortcut,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};

const DROPDOWN_PRIMS: Primitives = {
  Item: DropdownMenuItem,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator,
  Shortcut: DropdownMenuShortcut,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

function renderItem(item: OrdoMenuItem, P: Primitives): ReactNode {
  const Icon = item.ai ? item.icon ?? Sparkles : item.icon;
  const labelNode = (
    <>
      {Icon && (
        <Icon
          className={cn(
            "mr-2 h-4 w-4 shrink-0",
            item.ai && "text-[hsl(178,100%,8%)]",
            item.destructive && "text-destructive",
          )}
        />
      )}
      <span className="truncate">{item.label}</span>
      {item.shortcut && <P.Shortcut>{item.shortcut}</P.Shortcut>}
    </>
  );

  if (item.submenu?.length) {
    return (
      <P.Sub key={item.id}>
        <P.SubTrigger className="gap-0">{labelNode}</P.SubTrigger>
        <P.SubContent className="client-os max-h-72 min-w-44 overflow-y-auto rounded-panel">
          {item.submenu.map((sub) => renderItem(sub, P))}
        </P.SubContent>
      </P.Sub>
    );
  }

  return (
    <P.Item
      key={item.id}
      disabled={item.disabled}
      onSelect={(e: Event) => {
        e.preventDefault();
        item.onSelect?.();
      }}
      className={cn(
        "cursor-pointer rounded-small",
        item.destructive && "text-destructive focus:text-destructive focus:bg-destructive/10",
      )}
    >
      {labelNode}
    </P.Item>
  );
}

function renderConfig(config: OrdoMenuConfig, P: Primitives): ReactNode {
  return config
    .filter((section) => section.items.length > 0)
    .map((section, idx) => (
      <div key={section.id}>
        {idx > 0 && <P.Separator />}
        {section.label && (
          <P.Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {section.label}
          </P.Label>
        )}
        {section.items.map((item) => renderItem(item, P))}
      </div>
    ));
}

const CONTENT_CLASS =
  "client-os max-h-[70vh] w-60 overflow-y-auto rounded-panel border-border bg-card p-1.5 shadow-hover";

/**
 * Wraps any element so right-click / two-finger click / context-menu key /
 * mobile long-press all open the same Ordo action menu.
 */
export function OrdoContextMenu({
  config,
  children,
  disabled,
}: {
  config: OrdoMenuConfig;
  children: ReactNode;
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className={CONTENT_CLASS}>
        {renderConfig(config, CONTEXT_PRIMS)}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Universal three-dot overflow trigger that opens the same action menu. */
export function OrdoOverflowMenu({
  config,
  trigger,
  align = "end",
}: {
  config: OrdoMenuConfig;
  trigger: ReactNode;
  align?: "start" | "end" | "center";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={CONTENT_CLASS}>
        {renderConfig(config, DROPDOWN_PRIMS)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

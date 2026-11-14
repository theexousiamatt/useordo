/**
 * Ordo OS — canonical reusable component library.
 * Compose these primitives across all modules instead of inventing new
 * visual patterns. See mem://design/ordo-os for the design language.
 */
export { OrdoCard } from "./OrdoCard";
export { SectionHeader } from "./SectionHeader";
export { MetricCard } from "./MetricCard";
export { OrdoDrawer } from "./OrdoDrawer";
export { OrdoTable, type OrdoColumn } from "./OrdoTable";
export { OrdoField } from "./OrdoField";
export { OrdoInput } from "./OrdoInput";
export { OrdoTextarea } from "./OrdoTextarea";
export { OrdoSelect, type OrdoSelectOption } from "./OrdoSelect";
export { OrdoMultiSelect, type OrdoMultiSelectOption } from "./OrdoMultiSelect";
export { OrdoDatePicker } from "./OrdoDatePicker";
export { OrdoForm, OrdoFormSection, OrdoFormRow } from "./OrdoForm";
export { OrdoTaskCard, type OrdoTaskCardProps, type TaskLabelChip } from "./OrdoTaskCard";
export { LabelBadge, type LabelBadgeProps } from "./LabelBadge";

// Universal interaction framework — reuse across every Ordo module.
export {
  OrdoContextMenu,
  OrdoOverflowMenu,
  type OrdoMenuConfig,
  type OrdoMenuSection,
  type OrdoMenuItem,
} from "./OrdoMenu";
export {
  OrdoCardContextMenu,
  OrdoCardOverflowMenu,
  buildTaskMenuConfig,
  type TaskMenuHandlers,
  type TaskMoveTarget,
} from "./OrdoCardContextMenu";
export {
  OrdoColumnContextMenu,
  OrdoColumnOverflowMenu,
  buildColumnMenuConfig,
  type ColumnMenuHandlers,
} from "./OrdoColumnContextMenu";
export { OrdoBulkActionMenu, type BulkActionHandlers } from "./OrdoBulkActionMenu";
export { OrdoQuickEditPanel, type QuickEditPatch } from "./OrdoQuickEditPanel";

// Inline editing primitives — reusable across Board, List, Calendar, Timeline.
export { InlineTaskTitle } from "./inline/InlineTaskTitle";
export { InlineLabelPicker } from "./inline/InlineLabelPicker";
export { InlineMemberPicker } from "./inline/InlineMemberPicker";
export { InlineDatePicker } from "./inline/InlineDatePicker";

// Re-exports of existing canonical primitives for a single import surface.
export { PageHeader } from "@/components/PageHeader";
export { EmptyState } from "@/components/states/EmptyState";
export { ErrorState } from "@/components/states/ErrorState";
export { LoadingCards, LoadingList } from "@/components/states/LoadingState";
export {
  StatusBadge,
  HealthBadge,
  DeliverableBadge,
} from "@/components/projects/ProjectBadges";
export { MemberAvatars } from "@/components/projects/MemberAvatars";

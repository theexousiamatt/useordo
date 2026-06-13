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
export { OrdoTaskCard, COLUMN_THEME, type OrdoTaskCardProps } from "./OrdoTaskCard";

// Re-exports of existing canonical primitives for a single import surface.
export { PageHeader } from "@/components/PageHeader";
export { EmptyState } from "@/components/states/EmptyState";
export { ErrorState } from "@/components/states/ErrorState";
export { LoadingCards, LoadingList } from "@/components/states/LoadingState";
export {
  StatusBadge,
  HealthBadge,
  PriorityBadge,
  DeliverableBadge,
} from "@/components/projects/ProjectBadges";
export { MemberAvatars } from "@/components/projects/MemberAvatars";

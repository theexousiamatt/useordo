/**
 * Board-wide appearance. Never infer this from a task's label, priority,
 * completion status, or stage: those properties have separate meanings.
 */
export const BOARD_THEME_OPTIONS = [
  { value: "neutral", label: "Neutral" },
  { value: "forest", label: "Forest" },
  { value: "ocean", label: "Ocean" },
  { value: "lavender", label: "Lavender" },
  { value: "rose", label: "Rose" },
  { value: "amber", label: "Amber" },
  { value: "slate", label: "Slate" },
] as const;

export type BoardTheme = (typeof BOARD_THEME_OPTIONS)[number]["value"];
export const DEFAULT_BOARD_THEME: BoardTheme = "neutral";

interface BoardThemeStyle {
  surface: string;
  border: string;
  track: string;
  bar: string;
  divider: string;
  previewSurface: string;
  previewAccent: string;
}

/** Static Tailwind tokens for the card and its light/dark variations. */
export const BOARD_THEME_STYLES: Record<BoardTheme, BoardThemeStyle> = {
  neutral: {
    surface: "bg-white dark:bg-zinc-900",
    border: "border-slate-100 dark:border-zinc-700",
    track: "bg-slate-100 dark:bg-zinc-700",
    bar: "bg-slate-500 dark:bg-slate-400",
    divider: "border-slate-100 dark:border-zinc-700",
    previewSurface: "#FFFFFF", previewAccent: "#64748B",
  },
  forest: {
    surface: "bg-[#EAF9F1] dark:bg-[#112D24]",
    border: "border-[#D1EFDF] dark:border-[#235341]",
    track: "bg-[#D5EFE2] dark:bg-[#285746]",
    bar: "bg-[#10B981] dark:bg-[#36D39A]",
    divider: "border-[#CDE8D9] dark:border-[#285746]",
    previewSurface: "#EAF9F1", previewAccent: "#10B981",
  },
  ocean: {
    surface: "bg-[#EBF4FF] dark:bg-[#142A43]",
    border: "border-[#D8E8FC] dark:border-[#2A4C71]",
    track: "bg-[#D5E6FA] dark:bg-[#2B4C70]",
    bar: "bg-[#3B82F6] dark:bg-[#69A8FF]",
    divider: "border-[#D3E4F8] dark:border-[#2B4C70]",
    previewSurface: "#EBF4FF", previewAccent: "#3B82F6",
  },
  lavender: {
    surface: "bg-[#F4EFFF] dark:bg-[#292039]",
    border: "border-[#E8DDFB] dark:border-[#50416C]",
    track: "bg-[#E8DDFC] dark:bg-[#493B63]",
    bar: "bg-[#9467E8] dark:bg-[#B597FA]",
    divider: "border-[#E6DAF8] dark:border-[#493B63]",
    previewSurface: "#F4EFFF", previewAccent: "#9467E8",
  },
  rose: {
    surface: "bg-[#FFF0F4] dark:bg-[#3A202B]",
    border: "border-[#F9DDE5] dark:border-[#704255]",
    track: "bg-[#F9DCE6] dark:bg-[#704255]",
    bar: "bg-[#E76587] dark:bg-[#FF93AE]",
    divider: "border-[#F7D8E2] dark:border-[#704255]",
    previewSurface: "#FFF0F4", previewAccent: "#E76587",
  },
  amber: {
    surface: "bg-[#FFF6E8] dark:bg-[#362A18]",
    border: "border-[#F7E8CE] dark:border-[#645032]",
    track: "bg-[#F6E6CA] dark:bg-[#645032]",
    bar: "bg-[#E9A23B] dark:bg-[#F7C46C]",
    divider: "border-[#F3E2C6] dark:border-[#645032]",
    previewSurface: "#FFF6E8", previewAccent: "#E9A23B",
  },
  slate: {
    surface: "bg-[#EAF0F4] dark:bg-[#202B35]",
    border: "border-[#DCE6EE] dark:border-[#40515D]",
    track: "bg-[#D9E4EB] dark:bg-[#40515D]",
    bar: "bg-[#647D91] dark:bg-[#9FB8CC]",
    divider: "border-[#D8E3EA] dark:border-[#40515D]",
    previewSurface: "#EAF0F4", previewAccent: "#647D91",
  },
};

/** Existing records without a theme should gracefully render as Neutral. */
export function resolveBoardTheme(value: string | null | undefined): BoardTheme {
  return BOARD_THEME_OPTIONS.find((option) => option.value === value)?.value ?? DEFAULT_BOARD_THEME;
}

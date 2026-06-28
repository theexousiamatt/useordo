/**
 * Curated label color palette for the Ordo project-scoped Label system.
 *
 * A label stores only its color token (e.g. "blue"); this module maps that token
 * to the concrete Tailwind classes that drive the pill background, text, swatch
 * and selection state. Keeping the class strings literal here ensures Tailwind
 * picks them up during content scanning. This is the single source of truth for
 * label color — never hardcode label colors anywhere else.
 */

export type LabelColor =
  | "gray"
  | "blue"
  | "green"
  | "orange"
  | "red"
  | "purple"
  | "pink"
  | "yellow"
  | "teal";

export interface LabelColorDef {
  value: LabelColor;
  label: string;
  /** Solid swatch used in the color picker. */
  swatch: string;
  /** Pill surface: tinted background + accessible text color. */
  pill: string;
  /** Ring used when a swatch is selected. */
  ring: string;
}

export const LABEL_COLORS: LabelColorDef[] = [
  { value: "gray", label: "Gray", swatch: "bg-slate-400", pill: "bg-slate-100 text-slate-700", ring: "ring-slate-400" },
  { value: "blue", label: "Blue", swatch: "bg-sky-500", pill: "bg-sky-100 text-sky-700", ring: "ring-sky-500" },
  { value: "green", label: "Green", swatch: "bg-emerald-500", pill: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-500" },
  { value: "orange", label: "Orange", swatch: "bg-orange-500", pill: "bg-orange-100 text-orange-700", ring: "ring-orange-500" },
  { value: "red", label: "Red", swatch: "bg-red-500", pill: "bg-red-100 text-red-700", ring: "ring-red-500" },
  { value: "purple", label: "Purple", swatch: "bg-violet-500", pill: "bg-violet-100 text-violet-700", ring: "ring-violet-500" },
  { value: "pink", label: "Pink", swatch: "bg-pink-500", pill: "bg-pink-100 text-pink-700", ring: "ring-pink-500" },
  { value: "yellow", label: "Yellow", swatch: "bg-amber-500", pill: "bg-amber-100 text-amber-800", ring: "ring-amber-500" },
  { value: "teal", label: "Teal", swatch: "bg-teal-500", pill: "bg-teal-100 text-teal-700", ring: "ring-teal-500" },
];

const COLOR_MAP: Record<string, LabelColorDef> = Object.fromEntries(
  LABEL_COLORS.map((c) => [c.value, c]),
);

/** Resolve a stored color token to its definition, defaulting to gray. */
export function labelColor(token: string | null | undefined): LabelColorDef {
  return (token && COLOR_MAP[token]) || COLOR_MAP.gray;
}

export const DEFAULT_LABEL_COLOR: LabelColor = "gray";

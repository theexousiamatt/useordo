import { formatDistanceToNow, format, parseISO } from "date-fns";

export const timeAgo = (d: string | Date) =>
  formatDistanceToNow(new Date(d), { addSuffix: true });

export const dateShort = (d: string | Date | null | undefined) =>
  d ? format(typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? parseISO(d) : new Date(d), "MMM d, yyyy") : "—";

export const localDateKey = (date = new Date()) => format(date, "yyyy-MM-dd");

export const initials = (name?: string | null) => {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
};

export const formatBytes = (bytes?: number | null) => {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0; let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
};

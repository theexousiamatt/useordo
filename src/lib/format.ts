import { formatDistanceToNow, format } from "date-fns";

export const timeAgo = (d: string | Date) =>
  formatDistanceToNow(new Date(d), { addSuffix: true });

export const dateShort = (d: string | Date | null | undefined) =>
  d ? format(new Date(d), "MMM d, yyyy") : "—";

export const initials = (name?: string | null) => {
  if (!name) return "?";
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

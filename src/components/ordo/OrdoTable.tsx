import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OrdoCard } from "./OrdoCard";

/**
 * OrdoTable — soft, low-noise table that feels native to Ordo OS.
 * Avoids enterprise grid aesthetics: no heavy borders, readable spacing.
 */
export interface OrdoColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

interface OrdoTableProps<T> {
  columns: OrdoColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  className?: string;
}

const alignClass = (a?: "left" | "right" | "center") =>
  a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

export function OrdoTable<T>({ columns, rows, rowKey, onRowClick, empty, className }: OrdoTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <OrdoCard className={className}>{empty}</OrdoCard>;
  }

  return (
    <OrdoCard flush className={cn("overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    alignClass(c.align),
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-border/60 last:border-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-secondary",
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-5 py-4 align-middle", alignClass(c.align), c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OrdoCard>
  );
}

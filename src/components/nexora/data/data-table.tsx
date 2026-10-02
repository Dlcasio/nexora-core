import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right";
};

/** Reusable data table with loading, error and empty states. */
export function DataTable<T extends { id: string }>({
  columns, rows, loading, error, empty, onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  error?: string | null;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c.key} className={cn("font-mono text-[10px] uppercase tracking-[0.14em]", c.align === "right" && "text-right", c.className)}>
              {c.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow><TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground"><Loader2 className="mx-auto size-4 animate-spin" /></TableCell></TableRow>
        ) : error ? (
          <TableRow><TableCell colSpan={columns.length} className="h-32 text-center text-sm text-destructive">{error}</TableCell></TableRow>
        ) : rows.length === 0 ? (
          <TableRow><TableCell colSpan={columns.length} className="h-40 text-center">{empty}</TableCell></TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.id} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn(onRowClick && "cursor-pointer")}>
              {columns.map((c) => (
                <TableCell key={c.key} className={cn(c.align === "right" && "text-right tabular-nums", c.className)}>{c.cell(row)}</TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

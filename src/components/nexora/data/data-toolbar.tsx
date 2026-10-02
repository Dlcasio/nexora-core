import { Search, X } from "lucide-react";
import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Reusable search field with clear button. */
export function SearchInput({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pl-8 pr-8" />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export type FilterOption = { value: string; label: string };

/** Reusable single-select filter. */
export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: FilterOption[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full sm:w-44">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DataToolbar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border p-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{children}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

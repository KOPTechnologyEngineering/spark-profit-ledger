import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
  placeholder?: string;
}

export default function DateRangePicker({ value, onChange, className, placeholder = "Date range" }: Props) {
  const label = value?.from
    ? value.to
      ? `${format(value.from, "dd MMM yyyy")} – ${format(value.to, "dd MMM yyyy")}`
      : `From ${format(value.from, "dd MMM yyyy")}`
    : placeholder;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("justify-start text-left font-normal", !value?.from && "text-muted-foreground")}
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {value?.from && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(undefined)} aria-label="Clear date range">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function filterByDateRange<T extends Record<string, any>>(
  items: T[],
  range: DateRange | undefined,
  dateKey: keyof T = "date" as keyof T,
): T[] {
  if (!range?.from) return items;
  const from = new Date(range.from);
  from.setHours(0, 0, 0, 0);
  const to = range.to ? new Date(range.to) : new Date(range.from);
  to.setHours(23, 59, 59, 999);
  return items.filter((item) => {
    const raw = item[dateKey] || (item as any).created_at;
    if (!raw) return false;
    const d = new Date(raw);
    return d >= from && d <= to;
  });
}

import type { Period } from "@/lib/date-filters";

const periods: Period[] = ["Daily", "Weekly", "Monthly", "Yearly", "All"];

interface PeriodSelectorProps {
  value: Period;
  onChange: (p: Period) => void;
}

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
      {periods.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${value === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

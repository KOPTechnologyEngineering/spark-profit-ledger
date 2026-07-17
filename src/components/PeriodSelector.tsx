import type { Period } from "@/lib/date-filters";
import FilterPills from "@/components/FilterPills";

const periods: Period[] = ["Daily", "Weekly", "Monthly", "Yearly", "All"];

interface PeriodSelectorProps {
  value: Period;
  onChange: (p: Period) => void;
}

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return <FilterPills options={periods} value={value} onChange={onChange} />;
}

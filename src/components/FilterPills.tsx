import { cn } from "@/lib/utils";

interface FilterPillsProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function FilterPills<T extends string>({ options, value, onChange, className }: FilterPillsProps<T>) {
  return (
    <div className={cn("flex items-center gap-1 rounded-lg bg-secondary p-1 flex-wrap", className)}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all ${
            value === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

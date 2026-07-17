import { cn } from "@/lib/utils";

const toneClasses = {
  default: "text-foreground",
  inflow: "text-inflow",
  outflow: "text-outflow",
};

interface SummaryTileProps {
  label: string;
  value: string;
  tone?: keyof typeof toneClasses;
  footnote?: string;
  className?: string;
}

export default function SummaryTile({ label, value, tone = "default", footnote, className }: SummaryTileProps) {
  return (
    <div className={cn("glass-card p-6", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-heading text-2xl font-bold", toneClasses[tone])}>{value}</p>
      {footnote && <p className="mt-1 text-xs text-muted-foreground">{footnote}</p>}
    </div>
  );
}

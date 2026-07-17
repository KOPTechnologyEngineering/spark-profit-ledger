import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  paid: "bg-inflow-muted text-inflow",
  completed: "bg-inflow-muted text-inflow",
  filed: "bg-inflow-muted text-inflow",
  ready: "bg-inflow-muted text-inflow",
  pending: "bg-warning/15 text-warning",
  due: "bg-warning/15 text-warning",
  overdue: "bg-outflow-muted text-outflow",
  rejected: "bg-outflow-muted text-outflow",
  draft: "bg-secondary text-muted-foreground",
  upcoming: "bg-secondary text-muted-foreground",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        statusStyles[status] ?? "bg-secondary text-muted-foreground",
        className,
      )}
    >
      {status}
    </span>
  );
}

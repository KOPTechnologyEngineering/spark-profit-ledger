import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  variant?: "default" | "inflow" | "outflow";
}

export default function StatCard({ title, value, change, changeType = "neutral", icon: Icon, variant = "default" }: StatCardProps) {
  const variantClasses = {
    default: "glass-card",
    inflow: "glass-card glow-green gradient-inflow",
    outflow: "glass-card glow-red gradient-outflow",
  };

  const changeColors = {
    positive: "text-inflow",
    negative: "text-outflow",
    neutral: "text-muted-foreground",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`${variantClasses[variant]} p-6`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">{value}</p>
          {change && (
            <p className={`mt-1 text-xs font-medium ${changeColors[changeType]}`}>
              {change}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-secondary p-2.5">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </motion.div>
  );
}

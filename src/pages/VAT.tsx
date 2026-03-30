import { vatData } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

export default function VAT() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">VAT Management</h1>
        <p className="text-muted-foreground">Track and file your VAT returns</p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground">Output VAT</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">£{vatData.outputVAT.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground">Input VAT</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">£{vatData.inputVAT.toLocaleString()}</p>
        </div>
        <div className="glass-card glow-red gradient-outflow p-6">
          <p className="text-sm text-muted-foreground">Net VAT Payable</p>
          <p className="mt-1 font-heading text-2xl font-bold text-outflow">£{vatData.netVAT.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground">Next Deadline</p>
          <p className="mt-1 font-heading text-xl font-bold text-warning">{vatData.nextDeadline}</p>
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="font-heading text-lg font-semibold text-foreground mb-4">VAT Return History</h3>
        <div className="space-y-3">
          {vatData.quarters.map((q, i) => (
            <motion.div
              key={q.quarter}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between rounded-lg bg-secondary/50 px-6 py-4"
            >
              <div className="flex items-center gap-3">
                {q.status === 'filed' ? (
                  <CheckCircle className="h-5 w-5 text-inflow" />
                ) : (
                  <Clock className="h-5 w-5 text-warning" />
                )}
                <span className="font-medium text-foreground">{q.quarter}</span>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Output</p>
                  <p className="font-heading text-sm font-semibold text-foreground">£{q.output.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Input</p>
                  <p className="font-heading text-sm font-semibold text-foreground">£{q.input.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Net</p>
                  <p className="font-heading text-sm font-semibold text-outflow">£{q.net.toLocaleString()}</p>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${q.status === 'filed' ? 'bg-inflow-muted text-inflow' : 'bg-warning/15 text-warning'}`}>
                  {q.status}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

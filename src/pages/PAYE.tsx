import { payeData } from "@/lib/mock-data";
import { motion } from "framer-motion";

export default function PAYE() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">PAYE Management</h1>
        <p className="text-muted-foreground">Employee payroll and tax deductions</p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground">Total Gross Pay</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">£{payeData.totalGrossPay.toLocaleString()}</p>
        </div>
        <div className="glass-card glow-red gradient-outflow p-6">
          <p className="text-sm text-muted-foreground">Income Tax</p>
          <p className="mt-1 font-heading text-2xl font-bold text-outflow">£{payeData.totalTax.toLocaleString()}</p>
        </div>
        <div className="glass-card gradient-outflow p-6">
          <p className="text-sm text-muted-foreground">National Insurance</p>
          <p className="mt-1 font-heading text-2xl font-bold text-outflow">£{payeData.totalNI.toLocaleString()}</p>
        </div>
        <div className="glass-card glow-green gradient-inflow p-6">
          <p className="text-sm text-muted-foreground">Total Net Pay</p>
          <p className="mt-1 font-heading text-2xl font-bold text-inflow">£{payeData.totalNetPay.toLocaleString()}</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-heading text-lg font-semibold text-foreground">Employee Payroll</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Gross Pay</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Tax</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">NI</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Net Pay</th>
            </tr>
          </thead>
          <tbody>
            {payeData.employees.map((emp, i) => (
              <motion.tr
                key={emp.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
              >
                <td className="px-6 py-4 text-sm font-medium text-foreground">{emp.name}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{emp.role}</td>
                <td className="px-6 py-4 text-right font-heading text-sm font-semibold text-foreground">£{emp.gross.toLocaleString()}</td>
                <td className="px-6 py-4 text-right font-heading text-sm text-outflow">£{emp.tax.toLocaleString()}</td>
                <td className="px-6 py-4 text-right font-heading text-sm text-outflow">£{emp.ni.toLocaleString()}</td>
                <td className="px-6 py-4 text-right font-heading text-sm font-semibold text-inflow">£{emp.net.toLocaleString()}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

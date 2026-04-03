import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/date-filters";

export default function PAYE() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [totals, setTotals] = useState({ gross: 0, tax: 0, ni: 0, net: 0 });

  useEffect(() => {
    supabase.from("tbl_paye_employees").select("*").order("name").then(({ data }) => {
      const emps = data || [];
      setEmployees(emps);
      setTotals({
        gross: emps.reduce((s, e) => s + Number(e.gross_pay), 0),
        tax: emps.reduce((s, e) => s + Number(e.tax), 0),
        ni: emps.reduce((s, e) => s + Number(e.ni), 0),
        net: emps.reduce((s, e) => s + Number(e.net_pay), 0),
      });
    });
  }, []);

  const exportCSV = () => {
    const header = "Employee,Role,Gross Pay,Income Tax,NI,Net Pay\n";
    const rows = employees.map((e) => `"${e.name}","${e.role}",${e.gross_pay},${e.tax},${e.ni},${e.net_pay}`);
    downloadCSV("paye_payroll.csv", header, rows);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">PAYE Management</h1>
          <p className="text-muted-foreground">Employee payroll and tax deductions</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground">Total Gross Pay</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">£{totals.gross.toLocaleString()}</p>
        </div>
        <div className="glass-card glow-red gradient-outflow p-6">
          <p className="text-sm text-muted-foreground">Income Tax</p>
          <p className="mt-1 font-heading text-2xl font-bold text-outflow">£{totals.tax.toLocaleString()}</p>
        </div>
        <div className="glass-card gradient-outflow p-6">
          <p className="text-sm text-muted-foreground">National Insurance</p>
          <p className="mt-1 font-heading text-2xl font-bold text-outflow">£{totals.ni.toLocaleString()}</p>
        </div>
        <div className="glass-card glow-green gradient-inflow p-6">
          <p className="text-sm text-muted-foreground">Total Net Pay</p>
          <p className="mt-1 font-heading text-2xl font-bold text-inflow">£{totals.net.toLocaleString()}</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-heading text-lg font-semibold text-foreground">Employee Payroll</h3>
        </div>
        {employees.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No employee records found</p>
        ) : (
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
              {employees.map((emp, i) => (
                <motion.tr key={emp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{emp.name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{emp.role}</td>
                  <td className="px-6 py-4 text-right font-heading text-sm font-semibold text-foreground">£{Number(emp.gross_pay).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-heading text-sm text-outflow">£{Number(emp.tax).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-heading text-sm text-outflow">£{Number(emp.ni).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-heading text-sm font-semibold text-inflow">£{Number(emp.net_pay).toLocaleString()}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

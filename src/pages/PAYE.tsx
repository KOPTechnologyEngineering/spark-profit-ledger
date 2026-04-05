import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/date-filters";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ISE_GRADES = [
  "Grade 1 – Trainee / Entry Level",
  "Grade 2 – Junior / Associate",
  "Grade 3 – Intermediate / Officer",
  "Grade 4 – Senior / Specialist",
  "Grade 5 – Lead / Principal",
  "Grade 6 – Manager",
  "Grade 7 – Senior Manager",
  "Grade 8 – Director",
  "Grade 9 – Executive Director",
  "Grade 10 – C-Suite / Chief Officer",
];

// UK 2025/26 tax year calculations (monthly)
function calcUKDeductions(grossAnnual: number) {
  // Income Tax
  const personalAllowance = grossAnnual > 125140 ? 0 : 12570;
  const taxable = Math.max(0, grossAnnual - personalAllowance);
  let tax = 0;
  if (taxable > 0) tax += Math.min(taxable, 37700) * 0.2;
  if (taxable > 37700) tax += Math.min(taxable - 37700, 87440) * 0.4;
  if (taxable > 125140) tax += (taxable - 125140) * 0.45;

  // Employee NI (Class 1)
  const niLower = 12570; // primary threshold
  const niUpper = 50270;
  let ni = 0;
  if (grossAnnual > niLower) ni += Math.min(grossAnnual - niLower, niUpper - niLower) * 0.08;
  if (grossAnnual > niUpper) ni += (grossAnnual - niUpper) * 0.02;

  const monthlyGross = grossAnnual / 12;
  const monthlyTax = tax / 12;
  const monthlyNI = ni / 12;
  const monthlyNet = monthlyGross - monthlyTax - monthlyNI;

  return {
    gross_pay: Math.round(monthlyGross * 100) / 100,
    tax: Math.round(monthlyTax * 100) / 100,
    ni: Math.round(monthlyNI * 100) / 100,
    net_pay: Math.round(monthlyNet * 100) / 100,
  };
}

export default function PAYE() {
  const { user } = useAuth();
  const { hasAdmin, hasEdit } = useUserRoles();
  const canEdit = hasEdit("paye");
  const canDelete = hasAdmin("paye");

  const [employees, setEmployees] = useState<any[]>([]);
  const [totals, setTotals] = useState({ gross: 0, tax: 0, ni: 0, net: 0 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", designation: "", grade: "", grossAnnual: "" });
  const [saving, setSaving] = useState(false);

  const fetchEmployees = async () => {
    const { data } = await supabase.from("tbl_paye_employees").select("*").order("name");
    const emps = data || [];
    setEmployees(emps);
    setTotals({
      gross: emps.reduce((s, e) => s + Number(e.gross_pay), 0),
      tax: emps.reduce((s, e) => s + Number(e.tax), 0),
      ni: emps.reduce((s, e) => s + Number(e.ni), 0),
      net: emps.reduce((s, e) => s + Number(e.net_pay), 0),
    });
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.grossAnnual || !form.grade) {
      toast.error("Please fill in all required fields");
      return;
    }
    const annual = parseFloat(form.grossAnnual);
    if (isNaN(annual) || annual <= 0) {
      toast.error("Enter a valid gross annual pay");
      return;
    }
    setSaving(true);
    const deductions = calcUKDeductions(annual);
    const { error } = await supabase.from("tbl_paye_employees").insert({
      user_id: user!.id,
      name: form.name.trim(),
      role: form.designation.trim(),
      designation: form.designation.trim(),
      grade: form.grade,
      ...deductions,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Employee added");
    setForm({ name: "", designation: "", grade: "", grossAnnual: "" });
    setOpen(false);
    fetchEmployees();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete employee "${name}"?`)) return;
    const { error } = await supabase.from("tbl_paye_employees").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Employee deleted");
    fetchEmployees();
  };

  const exportCSV = () => {
    const header = "Employee,Designation,Grade,Monthly Gross,Income Tax,NI,Net Pay\n";
    const rows = employees.map((e) =>
      `"${e.name}","${e.designation || e.role}","${e.grade}",${e.gross_pay},${e.tax},${e.ni},${e.net_pay}`
    );
    downloadCSV("paye_payroll.csv", header, rows);
  };

  // Preview calculation
  const preview = form.grossAnnual ? calcUKDeductions(parseFloat(form.grossAnnual) || 0) : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">PAYE Management</h1>
          <p className="text-muted-foreground">Employee payroll and tax deductions</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Employee</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Employee</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label>Full Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Smith" />
                  </div>
                  <div>
                    <Label>Designation</Label>
                    <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Accountant" />
                  </div>
                  <div>
                    <Label>ISE Grade *</Label>
                    <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                      <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                      <SelectContent>
                        {ISE_GRADES.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Gross Annual Pay (£) *</Label>
                    <Input type="number" min="0" step="100" value={form.grossAnnual} onChange={(e) => setForm({ ...form, grossAnnual: e.target.value })} placeholder="e.g. 45000" />
                  </div>
                  {preview && parseFloat(form.grossAnnual) > 0 && (
                    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-1 text-sm">
                      <p className="font-semibold text-foreground mb-2">Monthly Breakdown (auto-calculated)</p>
                      <div className="flex justify-between"><span className="text-muted-foreground">Gross Pay</span><span className="text-foreground font-medium">£{preview.gross_pay.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Income Tax</span><span className="text-outflow">-£{preview.tax.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">National Insurance</span><span className="text-outflow">-£{preview.ni.toLocaleString()}</span></div>
                      <div className="flex justify-between border-t border-border pt-1 mt-1"><span className="font-semibold text-foreground">Net Pay</span><span className="font-bold text-inflow">£{preview.net_pay.toLocaleString()}</span></div>
                    </div>
                  )}
                  <Button className="w-full" onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Add Employee"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground">Total Monthly Gross</p>
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
          <p className="p-6 text-sm text-muted-foreground text-center">No employee records found. Click "Add Employee" to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Designation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Grade</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Gross</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Tax</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">NI</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Net Pay</th>
                  {canDelete && <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => (
                  <motion.tr key={emp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{emp.name}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{emp.designation || emp.role}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{emp.grade || "—"}</td>
                    <td className="px-6 py-4 text-right font-heading text-sm font-semibold text-foreground">£{Number(emp.gross_pay).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-heading text-sm text-outflow">£{Number(emp.tax).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-heading text-sm text-outflow">£{Number(emp.ni).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-heading text-sm font-semibold text-inflow">£{Number(emp.net_pay).toLocaleString()}</td>
                    {canDelete && (
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(emp.id, emp.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

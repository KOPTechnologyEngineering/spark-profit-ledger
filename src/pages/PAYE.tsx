import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Plus, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import SummaryTile from "@/components/SummaryTile";
import ImportDialog, { type ImportColumn } from "@/components/ImportDialog";
import { downloadCSV } from "@/lib/csv";
import { formatGBP, sumAmounts } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { usePayeEmployeesData, useInvalidateFinancialData } from "@/hooks/useFinancialData";
import { calcUKDeductions } from "@/lib/tax";

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

// Default Gross Annual Pay per grade, from 2026/27 UK Civil Service pay-band
// midpoints (AA through SCS4), mapped onto the 10 grades above in ascending
// seniority. A starting point only -- the field stays editable after this.
const GRADE_DEFAULT_GROSS_ANNUAL: Record<(typeof ISE_GRADES)[number], number> = {
  "Grade 1 – Trainee / Entry Level": 23000,
  "Grade 2 – Junior / Associate": 27000,
  "Grade 3 – Intermediate / Officer": 31000,
  "Grade 4 – Senior / Specialist": 38000,
  "Grade 5 – Lead / Principal": 48500,
  "Grade 6 – Manager": 65000,
  "Grade 7 – Senior Manager": 82500,
  "Grade 8 – Director": 105000,
  "Grade 9 – Executive Director": 130000,
  "Grade 10 – C-Suite / Chief Officer": 175000,
};

const emptyForm = { name: "", designation: "", grade: "", grossAnnual: "" };

type EmployeeRow = Tables<"tbl_paye_employees">;

const PAYE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "name", label: "Name", required: true, type: "string" },
  { key: "designation", label: "Designation", type: "string", defaultValue: "" },
  { key: "grade", label: "Grade", required: true, type: "enum", enumValues: ISE_GRADES },
  { key: "gross_annual", label: "Gross Annual Pay", required: true, type: "number" },
];
const PAYE_IMPORT_SAMPLE = ["Jane Smith", "Accountant", ISE_GRADES[2], 45000];

export default function PAYE() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { hasAdmin, hasEdit } = useUserRoles();
  const canEdit = hasEdit("paye");
  const canDelete = hasAdmin("paye");
  const isAdmin = hasAdmin("paye");

  const { data: employees = [] } = usePayeEmployeesData();
  const { invalidatePayeEmployees } = useInvalidateFinancialData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const totals = {
    gross: sumAmounts(employees, "gross_pay"),
    tax: sumAmounts(employees, "tax"),
    ni: sumAmounts(employees, "ni"),
    pensionEmployee: sumAmounts(employees, "pension_employee"),
    pensionEmployer: sumAmounts(employees, "pension_employer"),
    net: sumAmounts(employees, "net_pay"),
  };

  const handleImportEmployees = async (rows: Record<string, string | number>[]) => {
    if (!user) return { error: "Not signed in" };
    const payload = rows.map((r) => {
      const annual = Number(r.gross_annual);
      const designation = String(r.designation || "");
      const deductions = calcUKDeductions(annual);
      return {
        user_id: user.id,
        name: String(r.name),
        role: designation,
        designation,
        grade: String(r.grade),
        gross_annual: annual,
        ...deductions,
      };
    });
    const { error } = await supabase.from("tbl_paye_employees").insert(payload as never);
    if (!error) invalidatePayeEmployees();
    return { error: error?.message };
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (emp: EmployeeRow) => {
    setEditId(emp.id);
    setForm({
      name: emp.name,
      designation: emp.designation || emp.role || "",
      grade: emp.grade || "",
      grossAnnual: String(emp.gross_annual || 0),
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.grossAnnual || !form.grade) {
      toast({ title: "Missing required fields", description: "Please fill in the employee's name, grade and gross annual pay.", variant: "destructive" });
      return;
    }
    const annual = parseFloat(form.grossAnnual);
    if (isNaN(annual) || annual <= 0) {
      toast({ title: "Invalid gross annual pay", description: "Please enter a gross annual pay greater than zero.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const deductions = calcUKDeductions(annual);
    const payload = {
      name: form.name.trim(),
      role: form.designation.trim(),
      designation: form.designation.trim(),
      grade: form.grade,
      gross_annual: annual,
      ...deductions,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from("tbl_paye_employees").update(payload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("tbl_paye_employees").insert({ user_id: user!.id, ...payload }));
    }
    setSaving(false);
    if (error) {
      toast({
        title: editId ? "Couldn't update employee" : "Couldn't add employee",
        description: friendlyErrorMessage(error),
        variant: "destructive",
      });
      return;
    }
    toast({ title: editId ? "Employee updated" : "Employee added" });
    setForm(emptyForm);
    setEditId(null);
    setOpen(false);
    invalidatePayeEmployees();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete employee "${name}"?`)) return;
    const { error } = await supabase.from("tbl_paye_employees").delete().eq("id", id);
    if (error) { toast({ title: "Couldn't delete employee", description: friendlyErrorMessage(error), variant: "destructive" }); return; }
    toast({ title: "Employee deleted" });
    invalidatePayeEmployees();
  };

  const exportCSV = () => {
    downloadCSV(
      "paye_payroll.csv",
      ["Employee", "Designation", "Grade", "Gross Annual", "Monthly Gross", "Income Tax", "NI", "Employee Pension", "Employer Pension", "Net Pay"],
      employees.map((e) => [e.name, e.designation || e.role, e.grade, e.gross_annual, e.gross_pay, e.tax, e.ni, e.pension_employee, e.pension_employer, e.net_pay]),
    );
  };

  const preview = form.grossAnnual ? calcUKDeductions(parseFloat(form.grossAnnual) || 0) : null;

  return (
    <div className="space-y-8">
      <PageHeader title="PAYE Management" subtitle="Employee payroll and tax deductions">
        {canEdit && (
          <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Employee</Button>
        )}
        {canEdit && (
          <ImportDialog
            title="Import Employees"
            columns={PAYE_IMPORT_COLUMNS}
            sampleRow={PAYE_IMPORT_SAMPLE}
            onImport={handleImportEmployees}
            onImported={invalidatePayeEmployees}
          />
        )}
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
      </PageHeader>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditId(null); setForm(emptyForm); } setOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Employee" : "Add Employee"}</DialogTitle>
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
              <Select
                value={form.grade}
                onValueChange={(v) => setForm({ ...form, grade: v, grossAnnual: String(GRADE_DEFAULT_GROSS_ANNUAL[v] ?? "") })}
              >
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
                <div className="flex justify-between"><span className="text-muted-foreground">Gross Pay</span><span className="text-foreground font-medium">{formatGBP(preview.gross_pay)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Income Tax</span><span className="text-outflow">-{formatGBP(preview.tax)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">National Insurance</span><span className="text-outflow">-{formatGBP(preview.ni)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Employee Pension</span><span className="text-outflow">-{formatGBP(preview.pension_employee)}</span></div>
                <div className="flex justify-between border-t border-border pt-1 mt-1"><span className="font-semibold text-foreground">Net Pay</span><span className="font-bold text-inflow">{formatGBP(preview.net_pay)}</span></div>
                <div className="flex justify-between pt-1 mt-1 border-t border-border"><span className="text-muted-foreground">Employer Pension (company cost)</span><span className="text-foreground font-medium">{formatGBP(preview.pension_employer)}</span></div>
              </div>
            )}
            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editId ? "Update Employee" : "Add Employee"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-6">
        <SummaryTile label="Total Monthly Gross" value={formatGBP(totals.gross)} />
        <SummaryTile label="Income Tax" value={formatGBP(totals.tax)} tone="outflow" className="glow-red gradient-outflow" />
        <SummaryTile label="National Insurance" value={formatGBP(totals.ni)} tone="outflow" className="gradient-outflow" />
        <SummaryTile label="Employee Pension" value={formatGBP(totals.pensionEmployee)} tone="outflow" className="gradient-outflow" />
        <SummaryTile label="Employer Pension" value={formatGBP(totals.pensionEmployer)} />
        <SummaryTile label="Total Net Pay" value={formatGBP(totals.net)} tone="inflow" className="glow-green gradient-inflow" />
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
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Annual</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Gross</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Tax</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">NI</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Employee Pension</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Employer Pension</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Net Pay</th>
                  {(canDelete || isAdmin) && <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => (
                  <motion.tr key={emp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{emp.name}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{emp.designation || emp.role}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{emp.grade || "—"}</td>
                    <td className="px-6 py-4 text-right font-heading text-sm text-muted-foreground">{formatGBP(emp.gross_annual)}</td>
                    <td className="px-6 py-4 text-right font-heading text-sm font-semibold text-foreground">{formatGBP(emp.gross_pay)}</td>
                    <td className="px-6 py-4 text-right font-heading text-sm text-outflow">{formatGBP(emp.tax)}</td>
                    <td className="px-6 py-4 text-right font-heading text-sm text-outflow">{formatGBP(emp.ni)}</td>
                    <td className="px-6 py-4 text-right font-heading text-sm text-outflow">{formatGBP(emp.pension_employee)}</td>
                    <td className="px-6 py-4 text-right font-heading text-sm text-muted-foreground">{formatGBP(emp.pension_employer)}</td>
                    <td className="px-6 py-4 text-right font-heading text-sm font-semibold text-inflow">{formatGBP(emp.net_pay)}</td>
                    {(canDelete || isAdmin) && (
                      <td className="px-6 py-4 text-right space-x-1">
                        {isAdmin && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(emp.id, emp.name)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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

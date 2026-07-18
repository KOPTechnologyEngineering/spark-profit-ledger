import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const categories = ["Revenue", "Rent", "Software", "Contractors", "Marketing", "Insurance", "Payroll", "Utilities", "Other"];
const frequencies = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;
const NO_ORG = "__none__";

interface Props {
  onSaved?: () => void;
  record?: any;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}

export default function RecurringTransactionDialog({ onSaved, record, open: controlledOpen, onOpenChange }: Props) {
  const isEdit = !!record;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"inflow" | "outflow">("outflow");
  const [category, setCategory] = useState("Rent");
  const [frequency, setFrequency] = useState<typeof frequencies[number]>("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [organizationId, setOrganizationId] = useState<string>("");
  const [vendors, setVendors] = useState<{ id: string; name: string; org_type: string }[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    supabase
      .from("tbl_organizations")
      .select("id, name, org_type")
      .in("org_type", ["vendor", "both"])
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .then(({ data }) => setVendors((data as any) || []));
  }, [open]);

  useEffect(() => {
    if (open && record) {
      setDescription(record.description || "");
      setAmount(String(record.amount ?? ""));
      setType(record.type === "inflow" ? "inflow" : "outflow");
      setCategory(record.category || "Rent");
      setFrequency(record.frequency || "monthly");
      setStartDate(record.next_run_date || new Date().toISOString().split("T")[0]);
      setEndDate(record.end_date || "");
      setOrganizationId(record.organization_id || "");
    } else if (open && !record) {
      setDescription(""); setAmount(""); setType("outflow"); setCategory("Rent");
      setFrequency("monthly"); setStartDate(new Date().toISOString().split("T")[0]); setEndDate("");
      setOrganizationId("");
    }
  }, [open, record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const fields = {
        description,
        amount: Number(amount),
        type,
        category,
        frequency,
        start_date: startDate,
        next_run_date: startDate,
        end_date: endDate || null,
        is_active: true,
        organization_id: organizationId || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("tbl_recurring_transactions").update(fields as any).eq("id", record.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tbl_recurring_transactions").insert({
          ...fields,
          user_id: user.id,
          created_by_name: user.user_metadata?.full_name || user.email || "",
        } as any);
        if (error) throw error;
      }
      toast({ title: isEdit ? "Recurring updated" : "Recurring created" });
      setOpen(false);
      onSaved?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add Recurring</Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">{isEdit ? "Edit Recurring" : "Add Recurring Transaction"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount (£)</Label>
              <Input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inflow">Inflow</SelectItem>
                  <SelectItem value="outflow">Outflow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {frequencies.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Next Payment Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>End Date (optional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Organization (vendor)</Label>
            <Select value={organizationId || NO_ORG} onValueChange={(v) => setOrganizationId(v === NO_ORG ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ORG}>None</SelectItem>
                {vendors.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}{o.org_type === "both" ? " (customer/vendor)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Update" : "Create Recurring"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ApproverSelect from "@/components/ApproverSelect";

const categories = ["Revenue", "Rent", "Software", "Contractors", "Marketing", "Insurance", "Payroll", "Utilities", "Other"];

export default function AddTransactionDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"inflow" | "outflow">("inflow");
  const [category, setCategory] = useState("Revenue");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [approver1, setApprover1] = useState("");
  const [approver2, setApprover2] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!approver1 || !approver2) {
      toast({ title: "Error", description: "Please select 2 approvers", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("tbl_transactions").insert({
        user_id: user.id,
        description,
        amount: Number(amount),
        type,
        category,
        status: "pending",
        date,
        approver1_id: approver1,
        approver2_id: approver2,
        approver1_status: "pending",
        approver2_status: "pending",
        created_by_name: user.user_metadata?.full_name || user.email || "",
      } as any);
      if (error) throw error;

      await supabase.from("tbl_notifications").insert([
        { user_id: approver1, title: "Approval Required", message: `Transaction "${description}" needs your approval (£${Number(amount).toLocaleString()})`, link: "/transactions" },
        { user_id: approver2, title: "Approval Required", message: `Transaction "${description}" needs your approval (£${Number(amount).toLocaleString()})`, link: "/transactions" },
      ] as any);

      toast({ title: "Transaction added", description: "Sent for approval" });
      setOpen(false);
      resetForm();
      onCreated?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setType("inflow");
    setCategory("Revenue");
    setDate(new Date().toISOString().split("T")[0]);
    setApprover1("");
    setApprover2("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Add Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Client payment, rent, etc." required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount (£)</Label>
              <Input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "inflow" | "outflow")}>
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
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <ApproverSelect approver1={approver1} approver2={approver2} onApprover1Change={setApprover1} onApprover2Change={setApprover2} />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Adding..." : "Submit for Approval"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

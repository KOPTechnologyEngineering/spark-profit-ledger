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
import AttachmentUpload from "@/components/AttachmentUpload";

const categories = ["Revenue", "Rent", "Software", "Contractors", "Marketing", "Insurance", "Payroll", "Utilities", "Other"];

interface AddTransactionDialogProps {
  onCreated?: () => void;
  /** When set, the dialog edits this transaction instead of creating one. Editing resets the record to pending and re-triggers approval. Mount the component only while editing (state initializes from the record once, at mount). */
  record?: any;
  /** Controlled open state — required in edit mode (there is no trigger button). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function AddTransactionDialog({ onCreated, record, open: controlledOpen, onOpenChange }: AddTransactionDialogProps) {
  const isEdit = !!record;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState(record?.description || "");
  const [amount, setAmount] = useState(record ? String(record.amount ?? "") : "");
  const [type, setType] = useState<"inflow" | "outflow">(record?.type === "outflow" ? "outflow" : "inflow");
  const [category, setCategory] = useState(record?.category || "Revenue");
  const [date, setDate] = useState(record?.date || new Date().toISOString().split("T")[0]);
  const [approver1, setApprover1] = useState(record?.approver1_id || "");
  const [approver2, setApprover2] = useState(record?.approver2_id || "");
  const [attachments, setAttachments] = useState<any[]>(Array.isArray(record?.attachments) ? record.attachments : []);
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
      const fields = {
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
        attachments: attachments,
      };

      if (isEdit) {
        const { error } = await supabase.from("tbl_transactions").update(fields as any).eq("id", record.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tbl_transactions").insert({
          user_id: user.id,
          created_by_name: user.user_metadata?.full_name || user.email || "",
          ...fields,
        } as any);
        if (error) throw error;
      }

      const verb = isEdit ? "was updated and needs your re-approval" : "needs your approval";
      await supabase.from("tbl_notifications").insert([
        { user_id: approver1, title: "Approval Required", message: `Transaction "${description}" ${verb} (£${Number(amount).toLocaleString()})`, link: "/approvals" },
        { user_id: approver2, title: "Approval Required", message: `Transaction "${description}" ${verb} (£${Number(amount).toLocaleString()})`, link: "/approvals" },
      ] as any);

      toast({ title: isEdit ? "Transaction updated" : "Transaction added", description: isEdit ? "Sent for re-approval" : "Sent for approval" });
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
    setAttachments([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Transaction
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">{isEdit ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
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

          <AttachmentUpload attachments={attachments} onAttachmentsChange={setAttachments} />

          {isEdit && (
            <p className="text-xs text-muted-foreground">Saving changes resets this transaction to pending and sends it back to both approvers.</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Save & Resubmit for Approval" : "Submit for Approval"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import { friendlyErrorMessage } from "@/lib/errors";
import ApproverSelect from "@/components/ApproverSelect";
import AttachmentUpload from "@/components/AttachmentUpload";
import { VAT_TREATMENTS, defaultVatTreatmentForCategory, type VatTreatment } from "@/lib/tax";

const categories = ["Revenue", "Rent", "Software", "Contractors", "Marketing", "Insurance", "Payroll", "Utilities", "Other"];
const NO_ORG = "__none__";

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
  const [vatTreatment, setVatTreatment] = useState<VatTreatment>(
    (record?.vat_treatment as VatTreatment) || defaultVatTreatmentForCategory(record?.category || "Revenue"),
  );
  const [date, setDate] = useState(record?.date || new Date().toISOString().split("T")[0]);
  const [approver1, setApprover1] = useState(record?.approver1_id || "");
  const [approver2, setApprover2] = useState(record?.approver2_id || "");
  const [attachments, setAttachments] = useState<any[]>(Array.isArray(record?.attachments) ? record.attachments : []);
  const [organizationId, setOrganizationId] = useState<string>(record?.organization_id || "");
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
        vat_treatment: vatTreatment,
        approver1_id: approver1,
        approver2_id: approver2,
        approver1_status: "pending",
        approver2_status: "pending",
        attachments: attachments,
        organization_id: organizationId || null,
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
      toast({
        title: isEdit ? "Couldn't update transaction" : "Couldn't add transaction",
        description: friendlyErrorMessage(error, "Please check the details and try again."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setType("inflow");
    setCategory("Revenue");
    setVatTreatment(defaultVatTreatmentForCategory("Revenue"));
    setDate(new Date().toISOString().split("T")[0]);
    setApprover1("");
    setApprover2("");
    setAttachments([]);
    setOrganizationId("");
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
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  // Only auto-apply the category default on create -- on an existing
                  // transaction this would silently overwrite a deliberate manual override.
                  if (!isEdit) setVatTreatment(defaultVatTreatmentForCategory(v));
                }}
              >
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
            <div className="space-y-2">
              <Label>VAT Treatment</Label>
              <Select value={vatTreatment} onValueChange={(v) => setVatTreatment(v as VatTreatment)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VAT_TREATMENTS.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
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

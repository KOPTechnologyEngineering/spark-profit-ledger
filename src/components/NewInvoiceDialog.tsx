import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ApproverSelect from "@/components/ApproverSelect";

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
}

export default function NewInvoiceDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [client, setClient] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, rate: 0 }]);
  const [approver1, setApprover1] = useState("");
  const [approver2, setApprover2] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  const total = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);

  const addItem = () => setItems([...items, { description: "", quantity: 1, rate: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    (updated[i] as any)[field] = value;
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!approver1 || !approver2) {
      toast({ title: "Error", description: "Please select 2 approvers", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("tbl_invoices").insert({
        user_id: user.id,
        invoice_number: invoiceNumber,
        client,
        amount: total,
        status: "pending",
        due_date: dueDate || undefined,
        items: items as any,
        approver1_id: approver1,
        approver2_id: approver2,
        approver1_status: "pending",
        approver2_status: "pending",
        created_by_name: user.user_metadata?.full_name || user.email || "",
      } as any);
      if (error) throw error;

      // Create notifications for approvers
      await supabase.from("tbl_notifications").insert([
        { user_id: approver1, title: "Approval Required", message: `Invoice ${invoiceNumber} needs your approval (£${total.toLocaleString()})`, link: "/invoices" },
        { user_id: approver2, title: "Approval Required", message: `Invoice ${invoiceNumber} needs your approval (£${total.toLocaleString()})`, link: "/invoices" },
      ] as any);

      toast({ title: "Invoice created", description: `${invoiceNumber} sent for approval` });
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
    setClient("");
    setInvoiceNumber("");
    setDueDate("");
    setItems([{ description: "", quantity: 1, rate: 0 }]);
    setApprover1("");
    setApprover2("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Create New Invoice</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-006" required />
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Company name" required />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <ApproverSelect approver1={approver1} approver2={approver2} onApprover1Change={setApprover1} onApprover2Change={setApprover2} />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" /> Add Item
              </Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-end">
                <div>
                  {i === 0 && <Label className="text-xs text-muted-foreground">Description</Label>}
                  <Input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Service" required />
                </div>
                <div>
                  {i === 0 && <Label className="text-xs text-muted-foreground">Qty</Label>}
                  <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} />
                </div>
                <div>
                  {i === 0 && <Label className="text-xs text-muted-foreground">Rate (£)</Label>}
                  <Input type="number" min={0} step={0.01} value={item.rate} onChange={(e) => updateItem(i, "rate", Number(e.target.value))} />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={items.length === 1} className="h-10 w-10">
                  <Trash2 className="h-4 w-4 text-outflow" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-heading text-xl font-bold text-foreground">£{total.toLocaleString()}</span>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Submit for Approval"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

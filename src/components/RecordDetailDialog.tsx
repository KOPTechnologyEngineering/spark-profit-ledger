import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer, CheckCircle, XCircle } from "lucide-react";
import { useProfiles } from "@/hooks/useProfiles";

interface RecordDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: any;
  type: "invoice" | "transaction";
  onUpdated?: () => void;
}

export default function RecordDetailDialog({ open, onOpenChange, record, type, onUpdated }: RecordDetailDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const profiles = useProfiles();

  if (!record) return null;

  const getApproverName = (id: string | null) => {
    if (!id) return "—";
    const p = profiles.find((p) => p.user_id === id);
    return p ? p.full_name || p.email : "Unknown";
  };

  const canApprove =
    user &&
    ((record.approver1_id === user.id && record.approver1_status === "pending") ||
      (record.approver2_id === user.id && record.approver2_status === "pending"));

  const handleApprove = async (action: "approved" | "rejected") => {
    if (!user) return;
    const table = type === "invoice" ? "tbl_invoices" : "tbl_transactions";
    const updates: any = {};

    if (record.approver1_id === user.id) updates.approver1_status = action;
    if (record.approver2_id === user.id) updates.approver2_status = action;

    // Check if both approved
    const other1 = record.approver1_id === user.id ? action : record.approver1_status;
    const other2 = record.approver2_id === user.id ? action : record.approver2_status;
    if (other1 === "approved" && other2 === "approved") {
      updates.status = type === "invoice" ? "paid" : "completed";
    }
    if (action === "rejected") {
      updates.status = "rejected";
    }

    const { error } = await supabase.from(table).update(updates).eq("id", record.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: action === "approved" ? "Approved" : "Rejected", description: `Record has been ${action}.` });
      onUpdated?.();
      onOpenChange(false);
    }
  };

  const handleDownloadCSV = () => {
    const data = type === "invoice"
      ? `Invoice Number,Client,Amount,Status,Due Date,Created By\n${record.invoice_number},${record.client},${record.amount},${record.status},${record.due_date},${record.created_by_name}`
      : `Description,Amount,Type,Category,Status,Date,Created By\n${record.description},${record.amount},${record.type},${record.category},${record.status},${record.date},${record.created_by_name}`;
    const blob = new Blob([data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_${record.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const content = type === "invoice"
      ? `<h1>Invoice ${record.invoice_number}</h1><p>Client: ${record.client}</p><p>Amount: £${Number(record.amount).toLocaleString()}</p><p>Status: ${record.status}</p><p>Due Date: ${record.due_date}</p><p>Created By: ${record.created_by_name}</p>${record.items ? `<h3>Line Items</h3><table border="1" cellpadding="6"><tr><th>Description</th><th>Qty</th><th>Rate</th></tr>${(Array.isArray(record.items) ? record.items : []).map((i: any) => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>£${i.rate}</td></tr>`).join("")}</table>` : ""}`
      : `<h1>Transaction</h1><p>Description: ${record.description}</p><p>Amount: £${Number(record.amount).toLocaleString()}</p><p>Type: ${record.type}</p><p>Category: ${record.category}</p><p>Status: ${record.status}</p><p>Date: ${record.date}</p><p>Created By: ${record.created_by_name}</p>`;
    w.document.write(`<html><head><title>${type}</title><style>body{font-family:Arial,sans-serif;padding:40px}table{border-collapse:collapse;width:100%}th{background:#f0f0f0}</style></head><body>${content}</body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {type === "invoice" ? `Invoice ${record.invoice_number}` : "Transaction Details"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {type === "invoice" ? (
            <>
              <Row label="Client" value={record.client} />
              <Row label="Amount" value={`£${Number(record.amount).toLocaleString()}`} />
              <Row label="Status" value={record.status} />
              <Row label="Due Date" value={record.due_date} />
              <Row label="Created By" value={record.created_by_name || "—"} />
              {record.items && Array.isArray(record.items) && record.items.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Line Items</p>
                  {record.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm py-1 border-b border-border/50">
                      <span>{item.description}</span>
                      <span>x{item.quantity} @ £{item.rate}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <Row label="Description" value={record.description} />
              <Row label="Amount" value={`£${Number(record.amount).toLocaleString()}`} />
              <Row label="Type" value={record.type} />
              <Row label="Category" value={record.category} />
              <Row label="Status" value={record.status} />
              <Row label="Date" value={record.date} />
              <Row label="Created By" value={record.created_by_name || "—"} />
            </>
          )}

          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase">Approvals</p>
            <div className="flex justify-between text-sm">
              <span>Approver 1: {getApproverName(record.approver1_id)}</span>
              <StatusBadge status={record.approver1_status} />
            </div>
            <div className="flex justify-between text-sm">
              <span>Approver 2: {getApproverName(record.approver2_id)}</span>
              <StatusBadge status={record.approver2_status} />
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            {canApprove && (
              <>
                <Button size="sm" className="ml-auto bg-inflow hover:bg-inflow/90" onClick={() => handleApprove("approved")}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleApprove("rejected")}>
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground capitalize">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "approved" ? "bg-inflow-muted text-inflow" : status === "rejected" ? "bg-outflow-muted text-outflow" : "bg-warning/15 text-warning";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>{status}</span>;
}

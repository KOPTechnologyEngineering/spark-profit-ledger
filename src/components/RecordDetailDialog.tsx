import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer, CheckCircle, XCircle, FileText, Image, Trash2 } from "lucide-react";
import { useProfiles, Profile } from "@/hooks/useProfiles";
import { useUserRoles } from "@/hooks/useUserRoles";

interface RecordDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: any;
  type: "invoice" | "transaction";
  onUpdated?: () => void;
}

const VAT_RATE = 0.2;

export default function RecordDetailDialog({ open, onOpenChange, record, type, onUpdated }: RecordDetailDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const profiles = useProfiles();
  const { hasAdmin } = useUserRoles();

  if (!record) return null;

  const moduleForType = type === "invoice" ? "invoices" : "transactions";
  const canDelete = hasAdmin(moduleForType);

  const getProfile = (id: string | null): Profile | undefined => {
    if (!id) return undefined;
    return profiles.find((p) => p.user_id === id);
  };

  const getApproverName = (id: string | null) => {
    const p = getProfile(id);
    return p ? p.full_name || p.email : "—";
  };

  const getDesignation = (id: string | null) => {
    const p = getProfile(id);
    return p?.designation || "";
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

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this record? This action cannot be undone.")) return;
    const table = type === "invoice" ? "tbl_invoices" : "tbl_transactions";
    const { error } = await supabase.from(table).delete().eq("id", record.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Record has been deleted." });
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

    const createdDate = record.created_at ? new Date(record.created_at).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB");

    const approver1Profile = getProfile(record.approver1_id);
    const approver2Profile = getProfile(record.approver2_id);
    const creatorProfile = profiles.find(p => p.full_name === record.created_by_name || p.email === record.created_by_name);

    const signatoryBlock = (label: string, profile: Profile | undefined, status: string, date: string) => {
      return `
        <div style="text-align:center;min-width:200px">
          <p style="font-size:11px;color:#666;margin-bottom:4px">${label}</p>
          ${profile?.signature_url ? `<img src="${profile.signature_url}" style="max-height:50px;margin:0 auto 4px" />` : `<div style="border-bottom:1px solid #333;width:160px;margin:30px auto 4px"></div>`}
          <p style="font-weight:bold;margin:2px 0">${profile?.full_name || "—"}</p>
          <p style="font-size:12px;color:#555;margin:0">${profile?.designation || ""}</p>
          <p style="font-size:11px;color:#888;margin:2px 0">Status: ${status}</p>
          <p style="font-size:11px;color:#888;margin:0">Date: ${date}</p>
        </div>
      `;
    };

    let content = "";
    if (type === "invoice") {
      const items = Array.isArray(record.items) ? record.items : [];
      const subtotal = items.reduce((s: number, i: any) => s + (i.quantity || 0) * (i.rate || 0), 0);
      const vatAmount = subtotal * VAT_RATE;
      const total = subtotal + vatAmount;

      content = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;border-bottom:3px solid #10B981;padding-bottom:20px">
          <div>
            <h1 style="margin:0;font-size:28px;color:#10B981">LedgerFlow</h1>
            <p style="color:#666;margin:4px 0;font-size:12px">Smart Accounting for Modern Business</p>
          </div>
          <div style="text-align:right">
            <h2 style="margin:0;font-size:24px;color:#333">INVOICE</h2>
            <p style="color:#666;margin:4px 0">${record.invoice_number}</p>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:24px">
          <div>
            <p style="margin:2px 0"><strong>Bill To:</strong> ${record.client}</p>
            <p style="margin:2px 0"><strong>Created By:</strong> ${record.created_by_name || "—"}</p>
            ${creatorProfile?.designation ? `<p style="margin:2px 0;color:#555;font-size:13px">${creatorProfile.designation}</p>` : ""}
          </div>
          <div style="text-align:right">
            <p style="margin:2px 0"><strong>Date:</strong> ${createdDate}</p>
            <p style="margin:2px 0"><strong>Due:</strong> ${record.due_date || "—"}</p>
            <p style="margin:2px 0"><strong>Status:</strong> ${record.status}</p>
          </div>
        </div>

        <table border="0" cellpadding="8" style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead>
            <tr style="background:#f8f9fa;border-bottom:2px solid #dee2e6">
              <th style="text-align:left">Description</th>
              <th style="text-align:center;width:80px">Qty</th>
              <th style="text-align:right;width:120px">Rate</th>
              <th style="text-align:right;width:120px">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((i: any) => `
              <tr style="border-bottom:1px solid #eee">
                <td>${i.description || ""}</td>
                <td style="text-align:center">${i.quantity || 0}</td>
                <td style="text-align:right">£${Number(i.rate || 0).toLocaleString()}</td>
                <td style="text-align:right">£${(Number(i.quantity || 0) * Number(i.rate || 0)).toLocaleString()}</td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align:right;padding-top:12px">Subtotal</td>
              <td style="text-align:right;padding-top:12px">£${subtotal.toLocaleString()}</td>
            </tr>
            <tr>
              <td colspan="3" style="text-align:right">VAT (${(VAT_RATE * 100).toFixed(0)}%)</td>
              <td style="text-align:right">£${vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr style="border-top:2px solid #333">
              <td colspan="3" style="text-align:right;font-weight:bold;padding-top:8px">Total (incl. VAT)</td>
              <td style="text-align:right;font-weight:bold;font-size:18px;padding-top:8px">£${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        ${record.notes ? `<div style="margin-bottom:20px"><p style="font-size:12px;color:#666;font-weight:bold">NOTES</p><p style="font-size:13px;color:#555">${record.notes}</p></div>` : ""}

        <div style="margin-top:60px;padding-top:20px;border-top:1px solid #eee">
          <p style="font-size:12px;color:#666;margin-bottom:16px;font-weight:bold">SIGNATORIES</p>
          <div style="display:flex;justify-content:space-around;gap:30px">
            ${signatoryBlock("Created By", creatorProfile, "—", createdDate)}
            ${signatoryBlock("Approver 1", approver1Profile, record.approver1_status, createdDate)}
            ${signatoryBlock("Approver 2", approver2Profile, record.approver2_status, createdDate)}
          </div>
        </div>

        <div style="margin-top:40px;text-align:center;border-top:1px solid #eee;padding-top:16px">
          <p style="font-size:11px;color:#999">Generated by LedgerFlow · ${new Date().toLocaleDateString("en-GB")}</p>
        </div>
      `;
    } else {
      content = `
        <div style="border-bottom:3px solid #10B981;padding-bottom:16px;margin-bottom:24px">
          <h1 style="margin:0;font-size:24px;color:#10B981">LedgerFlow</h1>
          <p style="color:#666;margin:4px 0;font-size:12px">Smart Accounting for Modern Business</p>
        </div>
        <h2>Transaction Record</h2>
        <p>Description: ${record.description}</p>
        <p>Amount: £${Number(record.amount).toLocaleString()}</p>
        <p>Type: ${record.type}</p>
        <p>Category: ${record.category}</p>
        <p>Status: ${record.status}</p>
        <p>Date: ${record.date}</p>
        <p>Created By: ${record.created_by_name || "—"}</p>
        <div style="margin-top:40px;border-top:1px solid #eee;padding-top:20px">
          <p style="font-size:12px;color:#666;font-weight:bold">SIGNATORIES</p>
          <div style="display:flex;justify-content:space-around;gap:30px;margin-top:16px">
            ${signatoryBlock("Created By", creatorProfile, "—", createdDate)}
            ${signatoryBlock("Approver 1", approver1Profile, record.approver1_status, createdDate)}
            ${signatoryBlock("Approver 2", approver2Profile, record.approver2_status, createdDate)}
          </div>
        </div>
        <div style="margin-top:40px;text-align:center;border-top:1px solid #eee;padding-top:16px">
          <p style="font-size:11px;color:#999">Generated by LedgerFlow · ${new Date().toLocaleDateString("en-GB")}</p>
        </div>
      `;
    }

    w.document.write(`<html><head><title>${type}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#333}table{border-collapse:collapse;width:100%}th{text-align:left}</style></head><body>${content}</body></html>`);
    w.document.close();
    w.print();
  };

  const handleViewAttachment = async (att: any) => {
    const { data } = await supabase.storage.from("transaction-attachments").createSignedUrl(att.path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              {(() => {
                const items = Array.isArray(record.items) ? record.items : [];
                const subtotal = items.reduce((s: number, i: any) => s + (i.quantity || 0) * (i.rate || 0), 0);
                const vat = subtotal * VAT_RATE;
                return (
                  <>
                    <Row label="Subtotal" value={`£${subtotal.toLocaleString()}`} />
                    <Row label={`VAT (${(VAT_RATE * 100).toFixed(0)}%)`} value={`£${vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                    <Row label="Total (incl. VAT)" value={`£${(subtotal + vat).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                  </>
                );
              })()}
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

          {type === "transaction" && record.attachments && Array.isArray(record.attachments) && record.attachments.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground font-medium uppercase mb-2">Attachments</p>
              <div className="space-y-1">
                {record.attachments.map((att: any, i: number) => (
                  <button key={i} onClick={() => handleViewAttachment(att)} className="flex items-center gap-2 w-full rounded-md bg-secondary px-3 py-1.5 text-sm hover:bg-secondary/80 transition-colors">
                    {att.type?.startsWith("image/") ? <Image className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                    <span className="truncate text-foreground">{att.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase">Approvals</p>
            <div className="flex justify-between text-sm">
              <div>
                <span>Approver 1: {getApproverName(record.approver1_id)}</span>
                {getDesignation(record.approver1_id) && <span className="text-xs text-muted-foreground ml-1">({getDesignation(record.approver1_id)})</span>}
              </div>
              <StatusBadge status={record.approver1_status} />
            </div>
            <div className="flex justify-between text-sm">
              <div>
                <span>Approver 2: {getApproverName(record.approver2_id)}</span>
                {getDesignation(record.approver2_id) && <span className="text-xs text-muted-foreground ml-1">({getDesignation(record.approver2_id)})</span>}
              </div>
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
            {canDelete && (
              <Button size="sm" variant="destructive" onClick={handleDelete} className={canApprove ? "" : "ml-auto"}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
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

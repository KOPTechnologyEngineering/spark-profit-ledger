import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { TEMPLATE_TYPES, renderTemplate, logActivity } from "@/lib/collections";

const SAMPLE_VARS = {
  customer_name: "Acme Ltd",
  invoice_number: "INV-001",
  invoice_amount: "£1,250.00",
  due_date: "2026-06-15",
  days_overdue: "10",
  payment_link: "https://example.com/pay",
  company_name: "KOP Ledger",
  account_manager_name: "Jane Smith",
};

export default function EmailTemplates() {
  const { user } = useAuth();
  const { hasEdit } = useUserRoles();
  const canEdit = hasEdit("invoices");
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);

  const load = async () => {
    const { data, error } = await supabase.from("tbl_collection_email_templates").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setTemplates(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (form: any) => {
    if (editing?.id) {
      await supabase.from("tbl_collection_email_templates").update(form).eq("id", editing.id);
    } else {
      await supabase.from("tbl_collection_email_templates").insert({ ...form, user_id: user!.id });
    }
    await logActivity({ action: "template_changed", detail: form.name });
    toast.success("Template saved");
    setOpen(false);
    setEditing(null);
    load();
  };

  const remove = async (t: any) => {
    if (!confirm("Delete this template?")) return;
    await supabase.from("tbl_collection_email_templates").delete().eq("id", t.id);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          Variables: <code className="text-xs">{"{{customer_name}}"}, {"{{invoice_number}}"}, {"{{invoice_amount}}"}, {"{{due_date}}"}, {"{{days_overdue}}"}, {"{{payment_link}}"}, {"{{company_name}}"}, {"{{account_manager_name}}"}</code>
        </p>
        {canEdit && (
          <Button onClick={() => { setEditing({}); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Template
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {templates.length === 0 && (
          <div className="glass-card p-6 col-span-full text-center text-sm text-muted-foreground">
            No templates yet. Create one to use in your chase reminders.
          </div>
        )}
        {templates.map((t) => (
          <div key={t.id} className="glass-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-foreground">{t.name}</h3>
                <p className="text-xs text-muted-foreground">{TEMPLATE_TYPES.find((x) => x.value === t.type)?.label || t.type}</p>
              </div>
              <Switch
                checked={t.is_active}
                onCheckedChange={async (v) => {
                  await supabase.from("tbl_collection_email_templates").update({ is_active: v }).eq("id", t.id);
                  load();
                }}
                disabled={!canEdit}
              />
            </div>
            <p className="text-xs text-foreground truncate">Subject: {t.subject}</p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setPreview(t)}>
                <Eye className="h-3 w-3 mr-1" /> Preview
              </Button>
              {canEdit && (
                <>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(t); setOpen(true); }}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(t)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Template" : "New Email Template"}</DialogTitle>
          </DialogHeader>
          <TemplateForm template={editing} onSave={save} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Subject</Label>
                <div className="rounded bg-secondary p-3 text-sm">{renderTemplate(preview.subject, SAMPLE_VARS)}</div>
              </div>
              <div>
                <Label className="text-xs">Body</Label>
                <div className="rounded bg-secondary p-3 text-sm whitespace-pre-wrap">{renderTemplate(preview.body, SAMPLE_VARS)}</div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  toast.success("Test email queued (email sending requires domain setup)");
                }}
              >
                <Send className="h-3 w-3 mr-1" /> Send test
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateForm({ template, onSave }: { template: any; onSave: (f: any) => void }) {
  const [form, setForm] = useState({
    name: template?.name || "",
    type: template?.type || "due_soon",
    subject: template?.subject || "Invoice {{invoice_number}} - {{company_name}}",
    body: template?.body || "Hello {{customer_name}},\n\nThis is a reminder about invoice {{invoice_number}} for {{invoice_amount}}, due on {{due_date}}.\n\nBest regards,\n{{company_name}}",
    is_active: template?.is_active ?? true,
  });
  return (
    <div className="space-y-3">
      <div>
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <Label>Type</Label>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {TEMPLATE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Subject</Label>
        <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
      </div>
      <div>
        <Label>Body</Label>
        <Textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
        <Label>Active</Label>
      </div>
      <Button onClick={() => onSave(form)} className="w-full">
        Save template
      </Button>
    </div>
  );
}

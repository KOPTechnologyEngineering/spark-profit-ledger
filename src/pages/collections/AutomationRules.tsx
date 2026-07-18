import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { logActivity } from "@/lib/collections";

const DEFAULT_STEPS = [
  { offset: -7, label: "7 days before due", template: "due_soon" },
  { offset: -1, label: "1 day before due", template: "due_soon" },
  { offset: 1, label: "1 day overdue", template: "overdue" },
  { offset: 7, label: "7 days overdue", template: "second_reminder" },
  { offset: 14, label: "14 days overdue", template: "internal_escalation" },
  { offset: 21, label: "21 days overdue", template: "final_reminder" },
  { offset: 30, label: "30 days overdue (high-risk)", template: "final_reminder" },
];

export default function AutomationRules() {
  const { user } = useAuth();
  const { hasEdit } = useUserRoles();
  const canEdit = hasEdit("invoices");
  const [rules, setRules] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    const { data, error } = await supabase.from("tbl_collection_rules").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setRules(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (form: any) => {
    if (editing?.id) {
      await supabase.from("tbl_collection_rules").update(form).eq("id", editing.id);
      await logActivity({ action: "rule_changed", detail: form.name });
    } else {
      await supabase.from("tbl_collection_rules").insert({ ...form, user_id: user!.id });
      await logActivity({ action: "rule_changed", detail: `Created: ${form.name}` });
    }
    toast.success("Rule saved");
    setOpen(false);
    setEditing(null);
    load();
  };

  const toggle = async (rule: any) => {
    if (!canEdit) return;
    await supabase.from("tbl_collection_rules").update({ is_active: !rule.is_active }).eq("id", rule.id);
    load();
  };

  const remove = async (rule: any) => {
    if (!confirm("Delete this rule?")) return;
    await supabase.from("tbl_collection_rules").delete().eq("id", rule.id);
    toast.success("Rule deleted");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">Configure automated invoice chasing workflows.</p>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing({ steps: DEFAULT_STEPS });
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> New Rule
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rules.length === 0 && (
          <div className="glass-card p-6 col-span-full text-center text-sm text-muted-foreground">
            No automation rules yet. Create one to start chasing invoices automatically.
          </div>
        )}
        {rules.map((r) => (
          <div key={r.id} className="glass-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-foreground">{r.name}</h3>
                <p className="text-xs text-muted-foreground">{r.description || "—"}</p>
              </div>
              <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} disabled={!canEdit} />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Segment: {r.customer_segment}</p>
              <p>Amount: £{Number(r.min_amount).toLocaleString()}+ {r.max_amount ? `to £${Number(r.max_amount).toLocaleString()}` : ""}</p>
              <p>{(r.steps || []).length} steps</p>
            </div>
            {canEdit && (
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(r); setOpen(true); }}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Rule" : "New Automation Rule"}</DialogTitle>
          </DialogHeader>
          <RuleForm rule={editing} onSave={save} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleForm({ rule, onSave }: { rule: any; onSave: (f: any) => void }) {
  const [form, setForm] = useState({
    name: rule?.name || "",
    description: rule?.description || "",
    is_active: rule?.is_active ?? true,
    customer_segment: rule?.customer_segment || "all",
    min_amount: rule?.min_amount ?? 0,
    max_amount: rule?.max_amount ?? null,
    steps: rule?.steps?.length ? rule.steps : DEFAULT_STEPS,
    stop_conditions: rule?.stop_conditions || ["paid", "disputed", "paused", "replied", "written_off"],
    internal_recipients: rule?.internal_recipients || [],
  });

  return (
    <div className="space-y-3">
      <div>
        <Label>Rule name</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Min amount (£)</Label>
          <Input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Max amount (£)</Label>
          <Input
            type="number"
            value={form.max_amount ?? ""}
            onChange={(e) => setForm({ ...form, max_amount: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>
      <div>
        <Label>Customer segment</Label>
        <Input value={form.customer_segment} onChange={(e) => setForm({ ...form, customer_segment: e.target.value })} />
      </div>
      <div>
        <Label>Workflow steps</Label>
        <div className="space-y-1 max-h-48 overflow-y-auto rounded border border-border p-2">
          {form.steps.map((s: any, i: number) => (
            <div key={i} className="flex gap-2 items-center text-xs">
              <Input
                type="number"
                value={s.offset}
                onChange={(e) => {
                  const next = [...form.steps];
                  next[i] = { ...s, offset: Number(e.target.value) };
                  setForm({ ...form, steps: next });
                }}
                className="w-20"
              />
              <span>days · template:</span>
              <Input
                value={s.template}
                onChange={(e) => {
                  const next = [...form.steps];
                  next[i] = { ...s, template: e.target.value };
                  setForm({ ...form, steps: next });
                }}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setForm({ ...form, steps: form.steps.filter((_: any, j: number) => j !== i) })}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => setForm({ ...form, steps: [...form.steps, { offset: 0, label: "", template: "overdue" }] })}
        >
          <Plus className="h-3 w-3 mr-1" /> Add step
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
        <Label>Active</Label>
      </div>
      <Button onClick={() => onSave(form)} className="w-full">
        Save rule
      </Button>
    </div>
  );
}

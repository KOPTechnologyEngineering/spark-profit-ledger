import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const DEFAULTS = {
  default_sender_email: "",
  internal_recipients: [] as string[],
  grace_period_days: 0,
  max_reminders: 5,
  escalation_thresholds: { finance: 14, manager: 21, director: 30, legal: 60 },
  pause_on_reply: true,
  stop_when_paid: true,
  business_days_only: true,
};

export default function CollectionsSettings() {
  const { user } = useAuth();
  const { hasEdit } = useUserRoles();
  const canEdit = hasEdit("invoices");
  const [form, setForm] = useState<any>(DEFAULTS);
  const [recipients, setRecipients] = useState("");
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("tbl_collection_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setId(data.id);
        setForm(data);
        setRecipients(((data.internal_recipients as string[]) || []).join(", "));
      }
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    const payload = {
      ...form,
      internal_recipients: recipients.split(",").map((s) => s.trim()).filter(Boolean),
      user_id: user.id,
    };
    if (id) {
      await supabase.from("tbl_collection_settings").update(payload).eq("id", id);
    } else {
      const { data } = await supabase.from("tbl_collection_settings").insert(payload).select().single();
      if (data) setId(data.id);
    }
    toast.success("Settings saved");
  };

  return (
    <div className="glass-card p-6 space-y-4 max-w-2xl">
      <div>
        <Label>Default sender email</Label>
        <Input
          value={form.default_sender_email}
          onChange={(e) => setForm({ ...form, default_sender_email: e.target.value })}
          placeholder="billing@yourcompany.com"
          disabled={!canEdit}
        />
      </div>
      <div>
        <Label>Internal notification recipients (comma-separated)</Label>
        <Textarea
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          rows={2}
          placeholder="finance@co.com, manager@co.com"
          disabled={!canEdit}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Grace period (days)</Label>
          <Input
            type="number"
            value={form.grace_period_days}
            onChange={(e) => setForm({ ...form, grace_period_days: Number(e.target.value) })}
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>Max reminders</Label>
          <Input
            type="number"
            value={form.max_reminders}
            onChange={(e) => setForm({ ...form, max_reminders: Number(e.target.value) })}
            disabled={!canEdit}
          />
        </div>
      </div>
      <div>
        <Label>Escalation thresholds (days overdue)</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {(["finance", "manager", "director", "legal"] as const).map((k) => (
            <div key={k}>
              <Label className="text-xs capitalize">{k}</Label>
              <Input
                type="number"
                value={form.escalation_thresholds?.[k] ?? 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    escalation_thresholds: { ...form.escalation_thresholds, [k]: Number(e.target.value) },
                  })
                }
                disabled={!canEdit}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <Label>Pause chasing on customer reply</Label>
          <Switch checked={form.pause_on_reply} onCheckedChange={(v) => setForm({ ...form, pause_on_reply: v })} disabled={!canEdit} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Stop chasing when paid</Label>
          <Switch checked={form.stop_when_paid} onCheckedChange={(v) => setForm({ ...form, stop_when_paid: v })} disabled={!canEdit} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Business working days only</Label>
          <Switch checked={form.business_days_only} onCheckedChange={(v) => setForm({ ...form, business_days_only: v })} disabled={!canEdit} />
        </div>
      </div>
      {canEdit && (
        <Button onClick={save} className="w-full">
          Save settings
        </Button>
      )}
    </div>
  );
}

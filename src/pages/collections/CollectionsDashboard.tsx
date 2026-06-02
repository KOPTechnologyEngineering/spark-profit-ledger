import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Clock, Mail, TrendingUp, Users, Calendar, XCircle, Send, CheckCircle2, Timer, Percent } from "lucide-react";
import StatCard from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { daysOverdue, ageBracket, syncChaseQueue } from "@/lib/collections";

export default function CollectionsDashboard() {
  const { user } = useAuth();
  const [invs, setInvs] = useState<any[]>([]);
  const [escalations, setEsc] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [promises, setPromises] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await syncChaseQueue(user.id);
      const [inv, esc, rem, pr] = await Promise.all([
        supabase.from("tbl_invoices").select("id, invoice_number, client, amount, due_date, status"),
        supabase.from("tbl_collection_escalations").select("*").neq("status", "resolved"),
        supabase.from("tbl_collection_reminders").select("status, created_at, delivered_at, failed_at, sent_at"),
        supabase.from("tbl_collection_payment_promises").select("*"),
      ]);
      setInvs(inv.data || []);
      setEsc(esc.data || []);
      setReminders(rem.data || []);
      setPromises(pr.data || []);
    })();
  }, [user]);

  const unpaid = invs.filter((i) => i.status !== "paid");
  const overdue = unpaid.filter((i) => daysOverdue(i.due_date) > 0);
  const totalOverdueAmt = overdue.reduce((s, i) => s + Number(i.amount), 0);
  const dueIn7 = unpaid.filter((i) => {
    const d = daysOverdue(i.due_date);
    return d <= 0 && d >= -7;
  });
  const failedReminders = reminders.filter((r) => r.status === "failed").length;
  const today = new Date().toISOString().slice(0, 10);
  const promisedToday = promises.filter((p) => p.status === "active" && p.promised_date === today).length;
  const paid = invs.filter((i) => i.status === "paid").length;
  const successRate = invs.length ? Math.round((paid / invs.length) * 100) : 0;

  // Age brackets
  const brackets: Record<string, { count: number; amount: number }> = {
    "1-7": { count: 0, amount: 0 },
    "8-14": { count: 0, amount: 0 },
    "15-30": { count: 0, amount: 0 },
    "31-60": { count: 0, amount: 0 },
    "60+": { count: 0, amount: 0 },
  };
  overdue.forEach((i) => {
    const b = ageBracket(daysOverdue(i.due_date));
    if (brackets[b]) {
      brackets[b].count++;
      brackets[b].amount += Number(i.amount);
    }
  });

  // Top overdue customers
  const byCust = new Map<string, number>();
  overdue.forEach((i) => byCust.set(i.client, (byCust.get(i.client) ?? 0) + Number(i.amount)));
  const topCust = Array.from(byCust.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxBracket = Math.max(1, ...Object.values(brackets).map((b) => b.amount));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Overdue Invoices" value={String(overdue.length)} icon={AlertCircle} variant="outflow" />
        <StatCard title="Total Overdue" value={`£${totalOverdueAmt.toLocaleString()}`} icon={TrendingUp} variant="outflow" />
        <StatCard title="Due in 7 days" value={String(dueIn7.length)} icon={Calendar} />
        <StatCard title="Escalated" value={String(escalations.length)} icon={AlertTriangle} variant="outflow" />
        <StatCard title="High-risk Customers" value={String(topCust.filter(([, v]) => v > 5000).length)} icon={Users} />
        <StatCard title="Failed Reminders" value={String(failedReminders)} icon={XCircle} variant="outflow" />
        <StatCard title="Promises Due Today" value={String(promisedToday)} icon={Clock} />
        <StatCard title="Collection Success" value={`${successRate}%`} icon={Mail} variant="inflow" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-6">
          <h3 className="font-heading text-lg font-semibold text-foreground">Overdue by Age Bracket</h3>
          <div className="mt-4 space-y-3">
            {Object.entries(brackets).map(([k, v]) => (
              <div key={k}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{k} days</span>
                  <span className="font-medium text-foreground">
                    {v.count} · £{v.amount.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-outflow" style={{ width: `${(v.amount / maxBracket) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="font-heading text-lg font-semibold text-foreground">Top Overdue Customers</h3>
          <div className="mt-4 space-y-3">
            {topCust.length === 0 && <p className="text-sm text-muted-foreground">No overdue customers.</p>}
            {topCust.map(([name, amt]) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-sm text-foreground truncate">{name}</span>
                <span className="font-heading font-semibold text-outflow">£{amt.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="font-heading text-lg font-semibold text-foreground">Reminder Activity</h3>
          <div className="mt-4 flex items-baseline gap-6">
            <div>
              <p className="text-3xl font-heading font-bold text-foreground">{reminders.length}</p>
              <p className="text-xs text-muted-foreground">Total reminders sent</p>
            </div>
            <div>
              <p className="text-3xl font-heading font-bold text-outflow">{failedReminders}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="font-heading text-lg font-semibold text-foreground">Escalation Activity</h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {["open", "in_progress", "resolved", "cancelled"].map((s) => {
              const c = escalations.filter((e: any) => e.status === s).length;
              return (
                <div key={s} className="rounded-lg bg-secondary p-3">
                  <p className="text-xs text-muted-foreground capitalize">{s.replace("_", " ")}</p>
                  <p className="font-heading text-xl font-bold text-foreground">{c}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

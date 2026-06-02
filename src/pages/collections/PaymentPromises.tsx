import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logActivity } from "@/lib/collections";

const STATUSES = ["active", "broken", "paid", "renegotiated", "escalated"];

export default function PaymentPromises() {
  const { hasEdit } = useUserRoles();
  const canEdit = hasEdit("invoices");
  const [list, setList] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    const { data } = await supabase
      .from("tbl_collection_payment_promises")
      .select("*")
      .order("promised_date", { ascending: true });
    // Auto-mark broken
    const today = new Date().toISOString().slice(0, 10);
    const broken = (data || []).filter((p) => p.status === "active" && p.promised_date < today);
    for (const p of broken) {
      await supabase.from("tbl_collection_payment_promises").update({ status: "broken" }).eq("id", p.id);
      await supabase.from("tbl_collection_chase_items").update({ status: "overdue" }).eq("id", p.chase_item_id);
      await logActivity({ invoice_id: p.invoice_id, chase_item_id: p.chase_item_id, action: "payment_promise_broken" });
    }
    if (broken.length) {
      const fresh = await supabase.from("tbl_collection_payment_promises").select("*").order("promised_date", { ascending: true });
      setList(fresh.data || []);
    } else {
      setList(data || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (p: any, status: string) => {
    await supabase.from("tbl_collection_payment_promises").update({ status }).eq("id", p.id);
    await logActivity({ invoice_id: p.invoice_id, action: `promise_${status}` });
    toast.success("Updated");
    load();
  };

  const filtered = list.filter((p) => filter === "all" || p.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-lg bg-secondary p-1 flex-wrap">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all ${
              filter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="sticky top-0 bg-card border-b border-border">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 hidden sm:table-cell">Contact</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No payment promises.
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3 font-medium">{p.customer_name}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{p.contact_person || "—"}</td>
                  <td className="px-4 py-3">{p.promised_date}</td>
                  <td className="px-4 py-3">£{Number(p.amount_promised).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs capitalize ${p.status === "broken" ? "bg-outflow-muted text-outflow" : p.status === "paid" ? "bg-inflow-muted text-inflow" : "bg-secondary"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && p.status === "active" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => updateStatus(p, "paid")}>
                          Paid
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(p, "renegotiated")}>
                          Renegotiate
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

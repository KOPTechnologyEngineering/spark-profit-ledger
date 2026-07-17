import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/PageHeader";
import RecordDetailDialog from "@/components/RecordDetailDialog";
import { formatGBP } from "@/lib/format";
import { CheckCircle, Clock } from "lucide-react";

interface PendingItem {
  id: string;
  type: "invoice" | "transaction";
  label: string;
  amount: number;
  status: string;
  date: string;
  approverRole: string;
  raw: Tables<"tbl_invoices"> | Tables<"tbl_transactions">;
}

export default function Approvals() {
  const { user } = useAuth();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PendingItem | null>(null);

  const fetchPending = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: invoices }, { data: transactions }] = await Promise.all([
      supabase
        .from("tbl_invoices")
        .select("*")
        .or(`approver1_id.eq.${user.id},approver2_id.eq.${user.id}`),
      supabase
        .from("tbl_transactions")
        .select("*")
        .or(`approver1_id.eq.${user.id},approver2_id.eq.${user.id}`),
    ]);

    const mapped: PendingItem[] = [];

    (invoices || []).forEach((inv) => {
      const isPending =
        (inv.approver1_id === user.id && inv.approver1_status === "pending") ||
        (inv.approver2_id === user.id && inv.approver2_status === "pending");
      if (!isPending) return;
      const role = inv.approver1_id === user.id ? "Approver 1" : "Approver 2";
      mapped.push({
        id: inv.id,
        type: "invoice",
        label: `Invoice ${inv.invoice_number} — ${inv.client}`,
        amount: inv.amount,
        status: inv.status,
        date: inv.created_at,
        approverRole: role,
        raw: inv,
      });
    });

    (transactions || []).forEach((txn) => {
      const isPending =
        (txn.approver1_id === user.id && txn.approver1_status === "pending") ||
        (txn.approver2_id === user.id && txn.approver2_status === "pending");
      if (!isPending) return;
      const role = txn.approver1_id === user.id ? "Approver 1" : "Approver 2";
      mapped.push({
        id: txn.id,
        type: "transaction",
        label: txn.description,
        amount: txn.amount,
        status: txn.status,
        date: txn.created_at,
        approverRole: role,
        raw: txn,
      });
    });

    mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(mapped);
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
  }, [user]);

  return (
    <div className="space-y-6">
      <PageHeader title="Approvals" subtitle="Items pending your approval" />

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="h-12 w-12 text-inflow mb-4" />
            <p className="text-lg font-medium text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground">You have no pending approvals.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setSelected(item)}
            >
              <CardContent className="flex items-center justify-between py-4 px-5">
                <div className="flex items-center gap-3 min-w-0">
                  <Clock className="h-5 w-5 text-warning shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.approverRole} · {new Date(item.date).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className="capitalize">
                    {item.type}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">
                    {formatGBP(item.amount)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RecordDetailDialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        record={selected?.raw ?? null}
        type={selected?.type ?? "invoice"}
        onUpdated={fetchPending}
      />
    </div>
  );
}

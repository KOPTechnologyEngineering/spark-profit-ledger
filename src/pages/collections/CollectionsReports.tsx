import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { daysOverdue, ageBracket } from "@/lib/collections";
import { downloadCSV } from "@/lib/date-filters";
import DateRangePicker from "@/components/DateRangePicker";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";

const REPORTS = [
  { id: "overdue", label: "Overdue invoices" },
  { id: "aged", label: "Aged receivables" },
  { id: "customer", label: "Customer debt" },
  { id: "activity", label: "Chase activity" },
  { id: "escalations", label: "Escalations" },
  { id: "promises", label: "Promise-to-pay" },
  { id: "disputes", label: "Disputes" },
  { id: "risk", label: "Bad debt risk" },
];

export default function CollectionsReports() {
  const [report, setReport] = useState("overdue");
  const [data, setData] = useState<any[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    (async () => {
      let rows: any[] = [];
      if (report === "overdue" || report === "aged" || report === "customer" || report === "risk") {
        const { data: invs } = await supabase.from("tbl_invoices").select("invoice_number, client, amount, due_date, status").neq("status", "paid");
        rows = (invs || [])
          .filter((i) => !from || i.due_date >= from)
          .filter((i) => !to || i.due_date <= to)
          .map((i) => ({ ...i, days_overdue: daysOverdue(i.due_date), bracket: ageBracket(daysOverdue(i.due_date)) }));
        if (report === "customer") {
          const byCust = new Map<string, number>();
          rows.forEach((r) => byCust.set(r.client, (byCust.get(r.client) ?? 0) + Number(r.amount)));
          rows = Array.from(byCust.entries()).map(([client, total]) => ({ client, total_owed: total }));
        }
        if (report === "risk") {
          rows = rows.filter((r) => r.days_overdue > 30);
        }
      } else if (report === "activity") {
        const { data: r } = await supabase.from("tbl_collection_reminders").select("*").order("created_at", { ascending: false });
        rows = (r || []).filter((x) => !from || x.created_at >= from).filter((x) => !to || x.created_at <= to);
      } else if (report === "escalations") {
        const { data: r } = await supabase.from("tbl_collection_escalations").select("*").order("created_at", { ascending: false });
        rows = r || [];
      } else if (report === "promises") {
        const { data: r } = await supabase.from("tbl_collection_payment_promises").select("*");
        rows = r || [];
      } else if (report === "disputes") {
        const { data: r } = await supabase.from("tbl_collection_disputes").select("*");
        rows = r || [];
      }
      setData(rows);
    })();
  }, [report, from, to]);

  const exportCSV = () => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const header = keys.join(",") + "\n";
    const rows = data.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","));
    downloadCSV(`${report}-report.csv`, header, rows);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={report} onChange={(e) => setReport(e.target.value)} className="rounded-lg bg-secondary px-3 py-2 text-sm">
          {REPORTS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg bg-secondary px-3 py-2 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg bg-secondary px-3 py-2 text-sm" />
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data.length}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          {data.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No data for this report.</p>
          ) : (
            <table className="w-full text-sm min-w-[700px]">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  {Object.keys(data[0]).map((k) => (
                    <th key={k} className="px-4 py-3">
                      {k.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    {Object.keys(data[0]).map((k) => (
                      <td key={k} className="px-4 py-3 text-foreground">
                        {typeof row[k] === "object" ? JSON.stringify(row[k]) : String(row[k] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

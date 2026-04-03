import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { type Period, filterByPeriod } from "@/lib/date-filters";
import { format } from "date-fns";

interface Props {
  period?: Period;
}

export default function CashflowChart({ period = "All" }: Props) {
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("tbl_transactions").select("amount, type, date").order("date", { ascending: true });
      if (!data || data.length === 0) { setChartData([]); return; }

      const filtered = filterByPeriod(data, period);

      const groupKey = period === "Daily" ? "HH:00" : period === "Weekly" ? "EEE" : "MMM yy";
      const grouped: Record<string, { inflow: number; outflow: number }> = {};

      filtered.forEach((t) => {
        const key = format(new Date(t.date), groupKey);
        if (!grouped[key]) grouped[key] = { inflow: 0, outflow: 0 };
        if (t.type === "inflow") grouped[key].inflow += Number(t.amount);
        else grouped[key].outflow += Number(t.amount);
      });

      setChartData(Object.entries(grouped).map(([month, vals]) => ({ month, ...vals })));
    };
    load();
  }, [period]);

  return (
    <div className="glass-card p-6">
      <h3 className="font-heading text-lg font-semibold text-foreground">Cash Flow Overview</h3>
      <p className="text-sm text-muted-foreground">Inflow vs outflow from transactions</p>
      <div className="mt-4 h-72">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No transaction data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="inflowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outflowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
              <XAxis dataKey="month" stroke="hsl(215, 20%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} tickFormatter={(v) => `£${v / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(222, 47%, 9%)", border: "1px solid hsl(222, 30%, 18%)", borderRadius: "0.75rem", color: "hsl(210, 40%, 96%)" }}
                formatter={(value: number) => [`£${value.toLocaleString()}`, ""]}
              />
              <Area type="monotone" dataKey="inflow" stroke="hsl(160, 84%, 39%)" fill="url(#inflowGradient)" strokeWidth={2} name="Inflow" />
              <Area type="monotone" dataKey="outflow" stroke="hsl(0, 84%, 60%)" fill="url(#outflowGradient)" strokeWidth={2} name="Outflow" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

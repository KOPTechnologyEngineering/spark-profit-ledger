import { monthlyData } from "@/lib/mock-data";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function CashflowChart() {
  return (
    <div className="glass-card p-6">
      <h3 className="font-heading text-lg font-semibold text-foreground">Cash Flow Overview</h3>
      <p className="text-sm text-muted-foreground">Last 6 months inflow vs outflow</p>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlyData}>
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
              contentStyle={{
                backgroundColor: "hsl(222, 47%, 9%)",
                border: "1px solid hsl(222, 30%, 18%)",
                borderRadius: "0.75rem",
                color: "hsl(210, 40%, 96%)",
              }}
              formatter={(value: number) => [`£${value.toLocaleString()}`, ""]}
            />
            <Area type="monotone" dataKey="inflow" stroke="hsl(160, 84%, 39%)" fill="url(#inflowGradient)" strokeWidth={2} name="Inflow" />
            <Area type="monotone" dataKey="outflow" stroke="hsl(0, 84%, 60%)" fill="url(#outflowGradient)" strokeWidth={2} name="Outflow" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

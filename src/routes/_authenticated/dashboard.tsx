import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { listTransactions, formatCurrency } from "@/lib/finance";
import { TrendingUp, TrendingDown, Wallet, Calendar } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const CHART_COLORS = ["#0d7a5f", "#c9a84c", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899", "#10b981", "#64748b"];

function Dashboard() {
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", "all"],
    queryFn: () => listTransactions(),
  });

  const stats = useMemo(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let monthExp = 0, monthInc = 0, yearExp = 0, yearInc = 0;
    const byCat: Record<string, { name: string; value: number; color: string }> = {};
    const byMonth: Record<string, { month: string; receitas: number; despesas: number }> = {};

    for (const t of txs) {
      const d = new Date(t.occurred_at);
      if (d >= yearStart) {
        if (t.type === "expense") yearExp += t.amount; else yearInc += t.amount;
      }
      if (d >= monthStart) {
        if (t.type === "expense") monthExp += t.amount; else monthInc += t.amount;
      }
      if (t.type === "expense" && d >= yearStart) {
        const key = t.category?.name ?? "Sem categoria";
        const color = t.category?.color ?? "#64748b";
        byCat[key] = { name: key, value: (byCat[key]?.value ?? 0) + t.amount, color };
      }
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth[mk]) byMonth[mk] = { month: mk, receitas: 0, despesas: 0 };
      if (t.type === "expense") byMonth[mk].despesas += t.amount;
      else byMonth[mk].receitas += t.amount;
    }

    const months = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
    const cats = Object.values(byCat).sort((a, b) => b.value - a.value);

    return { monthExp, monthInc, yearExp, yearInc, cats, months };
  }, [txs]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral das suas finanças</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi title="Receitas do mês" value={stats.monthInc} icon={TrendingUp} tone="success" />
        <Kpi title="Despesas do mês" value={stats.monthExp} icon={TrendingDown} tone="destructive" />
        <Kpi title="Saldo do mês" value={stats.monthInc - stats.monthExp} icon={Wallet} tone="primary" />
        <Kpi title="Saldo do ano" value={stats.yearInc - stats.yearExp} icon={Calendar} tone="gold" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Despesas por categoria (ano)</h2>
          {stats.cats.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma despesa registrada</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={stats.cats} dataKey="value" nameKey="name" outerRadius={100} label={(e) => e.name}>
                  {stats.cats.map((c, i) => (
                    <Cell key={i} fill={c.color || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Receitas vs Despesas (últimos 6 meses)</h2>
          {stats.months.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem dados ainda</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="receitas" fill="#0d7a5f" name="Receitas" />
                <Bar dataKey="despesas" fill="#c9a84c" name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
    </div>
  );
}

function Kpi({ title, value, icon: Icon, tone }: { title: string; value: number; icon: any; tone: "success" | "destructive" | "primary" | "gold" }) {
  const toneClass = {
    success: "text-success bg-success/10",
    destructive: "text-destructive bg-destructive/10",
    primary: "text-primary bg-primary/10",
    gold: "text-gold-foreground bg-gold/20",
  }[tone];
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(value)}</p>
        </div>
        <div className={`p-2 rounded-md ${toneClass}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}

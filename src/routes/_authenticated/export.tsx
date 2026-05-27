import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { listTransactions, formatCurrency, SOURCES } from "@/lib/finance";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/export")({
  component: ExportPage,
});

function ExportPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<"all" | "expense" | "income">("all");
  const [loading, setLoading] = useState<"xlsx" | "pdf" | null>(null);

  const fetchData = async () => {
    return await listTransactions({
      from,
      to,
      type: type === "all" ? undefined : type,
    });
  };

  const exportXLSX = async () => {
    setLoading("xlsx");
    try {
      const rows = await fetchData();
      const data = rows.map((t) => ({
        Data: new Date(t.occurred_at).toLocaleDateString("pt-BR"),
        Tipo: t.type === "income" ? "Receita" : "Despesa",
        Categoria: t.category?.name ?? "",
        Fonte: SOURCES.find((s) => s.value === t.source)?.label ?? t.source,
        Descrição: t.description ?? "",
        Moeda: t.currency,
        Valor: t.amount,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");
      XLSX.writeFile(wb, `financas_${from}_a_${to}.xlsx`);
      toast.success("Excel gerado");
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    } finally { setLoading(null); }
  };

  const exportPDF = async () => {
    setLoading("pdf");
    try {
      const rows = await fetchData();
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Relatório Financeiro", 14, 18);
      doc.setFontSize(10);
      doc.text(`Período: ${from} a ${to}`, 14, 26);

      const totalExp = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
      const totalInc = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
      doc.text(`Receitas: ${formatCurrency(totalInc)}   Despesas: ${formatCurrency(totalExp)}   Saldo: ${formatCurrency(totalInc - totalExp)}`, 14, 32);

      autoTable(doc, {
        startY: 38,
        head: [["Data", "Tipo", "Categoria", "Fonte", "Descrição", "Valor"]],
        body: rows.map((t) => [
          new Date(t.occurred_at).toLocaleDateString("pt-BR"),
          t.type === "income" ? "Receita" : "Despesa",
          t.category?.name ?? "",
          SOURCES.find((s) => s.value === t.source)?.label ?? t.source,
          t.description ?? "",
          `${t.type === "income" ? "+" : "-"} ${formatCurrency(t.amount, t.currency)}`,
        ]),
        headStyles: { fillColor: [13, 122, 95] },
        styles: { fontSize: 8 },
      });
      doc.save(`financas_${from}_a_${to}.pdf`);
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    } finally { setLoading(null); }
  };

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Exportar dados</h1>
        <p className="text-muted-foreground">Baixe seus lançamentos em Excel ou PDF</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={exportXLSX} disabled={!!loading}>
            <FileSpreadsheet className="size-4 mr-2" />
            {loading === "xlsx" ? "Gerando..." : "Exportar Excel"}
          </Button>
          <Button onClick={exportPDF} disabled={!!loading} variant="secondary">
            <FileText className="size-4 mr-2" />
            {loading === "pdf" ? "Gerando..." : "Exportar PDF"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 bg-muted/50">
        <div className="flex gap-3 items-start">
          <Download className="size-5 text-muted-foreground mt-0.5" />
          <div className="text-sm text-muted-foreground">
            O arquivo será gerado com base nos filtros acima e baixado automaticamente.
            Administradores veem dados de todos os usuários.
          </div>
        </div>
      </Card>
    </div>
  );
}

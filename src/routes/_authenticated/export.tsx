import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, MessageCircle, Mail } from "lucide-react";
import { listTransactions, formatCurrency, SOURCES, getAppSetting, computeInstallmentStats } from "@/lib/finance";
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
  const [loading, setLoading] = useState<"xlsx" | "pdf" | "wa" | "mail" | null>(null);
  const [waPhone, setWaPhone] = useState("");
  const [mailTo, setMailTo] = useState("");
  const [defaultWa, setDefaultWa] = useState("");
  const [defaultMail, setDefaultMail] = useState("");

  useEffect(() => {
    getAppSetting<{ admin_phone?: string }>("whatsapp").then((v) => {
      if (v?.admin_phone) { setDefaultWa(v.admin_phone); setWaPhone(v.admin_phone); }
    });
    getAppSetting<{ reply_to?: string }>("email").then((v) => {
      if (v?.reply_to) { setDefaultMail(v.reply_to); setMailTo(v.reply_to); }
    });
  }, []);

  const fetchData = async () => {
    return await listTransactions({
      from, to,
      type: type === "all" ? undefined : type,
    });
  };

  const buildSummary = (rows: any[]) => {
    const totalExp = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
    const totalInc = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
    const inst = computeInstallmentStats(rows);
    const lines = [
      `📊 *Relatório Financeiro*`,
      `Período: ${new Date(from).toLocaleDateString("pt-BR")} → ${new Date(to).toLocaleDateString("pt-BR")}`,
      ``,
      `💰 Receitas: ${formatCurrency(totalInc)}`,
      `💸 Despesas: ${formatCurrency(totalExp)}`,
      `💼 Saldo: ${formatCurrency(totalInc - totalExp)}`,
      ``,
      `🧾 Lançamentos: ${rows.length}`,
    ];
    if (inst.totalCount > 0) {
      lines.push(
        ``,
        `💳 *Compras parceladas*`,
        `Total: ${formatCurrency(inst.totalAmount)} (${inst.totalCount} parcelas)`,
        `Pagas: ${formatCurrency(inst.paidAmount)} (${inst.paidCount})`,
        `A pagar: ${formatCurrency(inst.remainingAmount)} (${inst.remainingCount})`,
      );
    }
    return lines.join("\n");
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
        Parcela: t.installment_number ? `${t.installment_number}` : "",
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

      const inst = computeInstallmentStats(rows);
      let startY = 38;
      if (inst.totalCount > 0) {
        doc.text(`Parcelado — Total: ${formatCurrency(inst.totalAmount)} | Pagas: ${formatCurrency(inst.paidAmount)} (${inst.paidCount}) | A pagar: ${formatCurrency(inst.remainingAmount)} (${inst.remainingCount})`, 14, 38);
        startY = 44;
      }

      autoTable(doc, {
        startY,
        head: [["Data", "Tipo", "Categoria", "Fonte", "Parcela", "Descrição", "Valor"]],
        body: rows.map((t) => [
          new Date(t.occurred_at).toLocaleDateString("pt-BR"),
          t.type === "income" ? "Receita" : "Despesa",
          t.category?.name ?? "",
          SOURCES.find((s) => s.value === t.source)?.label ?? t.source,
          t.installment_number ? `${t.installment_number}` : "",
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

  const sendWhatsApp = async () => {
    setLoading("wa");
    try {
      const rows = await fetchData();
      const summary = buildSummary(rows);
      const phone = waPhone.replace(/\D/g, "");
      const url = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(summary)}`
        : `https://wa.me/?text=${encodeURIComponent(summary)}`;
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    } finally { setLoading(null); }
  };

  const sendEmail = async () => {
    setLoading("mail");
    try {
      const rows = await fetchData();
      const summary = buildSummary(rows).replace(/\*/g, "");
      const subject = `Relatório Financeiro ${from} a ${to}`;
      const url = `mailto:${encodeURIComponent(mailTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`;
      window.location.href = url;
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    } finally { setLoading(null); }
  };

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Exportar / Enviar</h1>
        <p className="text-muted-foreground">Baixe ou compartilhe seus lançamentos</p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">Filtros</h2>
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
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">Baixar arquivo</h2>
        <div className="flex flex-wrap gap-3">
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

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><MessageCircle className="size-4 text-success" /> Enviar resumo por WhatsApp</h2>
        <div className="space-y-2">
          <Label>Telefone do destinatário (com DDI, só números)</Label>
          <Input
            placeholder={defaultWa || "Ex: 5511999999999"}
            value={waPhone}
            onChange={(e) => setWaPhone(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Deixe vazio para escolher o destinatário no WhatsApp. O resumo será aberto no WhatsApp Web/App para envio.
          </p>
        </div>
        <Button onClick={sendWhatsApp} disabled={!!loading} className="bg-success text-success-foreground hover:bg-success/90">
          <MessageCircle className="size-4 mr-2" />
          {loading === "wa" ? "Abrindo..." : "Abrir WhatsApp com resumo"}
        </Button>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Mail className="size-4 text-primary" /> Enviar resumo por E-mail</h2>
        <div className="space-y-2">
          <Label>E-mail do destinatário</Label>
          <Input
            type="email"
            placeholder={defaultMail || "destinatario@exemplo.com"}
            value={mailTo}
            onChange={(e) => setMailTo(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Abre seu cliente de e-mail padrão com o resumo pronto. Para envio automatizado pelo servidor, peça ao administrador para configurar nas Configurações.
          </p>
        </div>
        <Button onClick={sendEmail} disabled={!!loading || !mailTo} variant="secondary">
          <Mail className="size-4 mr-2" />
          {loading === "mail" ? "Abrindo..." : "Compor e-mail"}
        </Button>
      </Card>

      <Card className="p-6 bg-muted/50">
        <div className="flex gap-3 items-start">
          <Download className="size-5 text-muted-foreground mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Administradores veem dados de todos os usuários nos relatórios.
          </div>
        </div>
      </Card>
    </div>
  );
}

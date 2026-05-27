import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listCategories, listTransactions, formatCurrency, SOURCES, CURRENCIES, type TransactionType, type PaymentSource } from "@/lib/finance";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

const txSchema = z.object({
  type: z.enum(["expense", "income"]),
  amount: z.number().positive(),
  currency: z.string().min(3),
  category_id: z.string().uuid().nullable(),
  source: z.enum(["pix", "dinheiro", "credito", "debito", "transferencia", "boleto", "outro"]),
  description: z.string().max(500).optional(),
  occurred_at: z.string(),
});

function TransactionsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filters, setFilters] = useState<{ type?: TransactionType; source?: PaymentSource; categoryId?: string }>({});
  const [open, setOpen] = useState(false);

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => listTransactions(filters),
  });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Lançamento removido");
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lançamentos</h1>
          <p className="text-muted-foreground">Receitas e despesas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Novo lançamento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
            <TxForm
              categories={categories}
              userId={user!.id}
              onSaved={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["transactions"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Select value={filters.type ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, type: v === "all" ? undefined : (v as TransactionType) }))}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.source ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, source: v === "all" ? undefined : (v as PaymentSource) }))}>
          <SelectTrigger><SelectValue placeholder="Fonte" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fontes</SelectItem>
            {SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.categoryId ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, categoryId: v === "all" ? undefined : v }))}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Fonte</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : txs.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum lançamento</TableCell></TableRow>
            ) : (
              txs.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.occurred_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <Badge variant={t.type === "income" ? "default" : "secondary"} className={t.type === "income" ? "bg-success text-success-foreground" : "bg-destructive/10 text-destructive"}>
                      {t.type === "income" ? "Receita" : "Despesa"}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.category?.name ?? "—"}</TableCell>
                  <TableCell>{SOURCES.find((s) => s.value === t.source)?.label ?? t.source}</TableCell>
                  <TableCell className="max-w-xs truncate">{t.description ?? "—"}</TableCell>
                  <TableCell className={`text-right font-medium ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                    {t.type === "income" ? "+" : "-"} {formatCurrency(t.amount, t.currency)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => delMut.mutate(t.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function TxForm({ categories, userId, onSaved }: { categories: any[]; userId: string; onSaved: () => void }) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [categoryId, setCategoryId] = useState<string>("");
  const [source, setSource] = useState<PaymentSource>("pix");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const filteredCats = categories.filter((c) => c.type === type);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = txSchema.safeParse({
      type, amount: parseFloat(amount), currency, category_id: categoryId || null,
      source, description: description || undefined, occurred_at: date,
    });
    if (!parsed.success) {
      toast.error("Dados inválidos", { description: parsed.error.issues[0]?.message });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("transactions").insert({ ...parsed.data, user_id: userId });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar", { description: error.message }); return; }
    toast.success("Lançamento salvo");
    onSaved();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => { setType(v as TransactionType); setCategoryId(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2 col-span-2">
          <Label>Valor</Label>
          <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Moeda</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {filteredCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Fonte / Forma de pagamento</Label>
        <Select value={source} onValueChange={(v) => setSource(v as PaymentSource)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
    </form>
  );
}

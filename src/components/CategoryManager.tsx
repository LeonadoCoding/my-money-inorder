import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listCategories, type Category, type TransactionType } from "@/lib/finance";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, X, Check } from "lucide-react";

const DEFAULT_COLOR = "#0d7a5f";

export function CategoryManager() {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);
  const [editType, setEditType] = useState<TransactionType>("expense");

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listCategories());
    } catch (e: any) {
      toast.error("Erro ao carregar", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const canEdit = (c: Category) => isAdmin || (!c.is_global && c.user_id === user?.id);

  const create = async () => {
    if (!name.trim()) {
      toast.error("Informe um nome");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("categories").insert({
      name: name.trim(),
      type,
      color,
      user_id: user!.id,
      is_global: false,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Categoria criada");
    setName("");
    setColor(DEFAULT_COLOR);
    load();
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor(c.color ?? DEFAULT_COLOR);
    setEditType(c.type);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    if (!editName.trim()) {
      toast.error("Informe um nome");
      return;
    }
    const { error } = await supabase
      .from("categories")
      .update({ name: editName.trim(), color: editColor, type: editType })
      .eq("id", id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Categoria atualizada");
    setEditingId(null);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Categoria excluída");
    load();
  };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="font-semibold">Categorias</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie suas categorias de gastos e receitas.
          {!isAdmin && " Categorias globais são apenas para visualização."}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_180px_120px_auto] items-end">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input
            value={name}
            placeholder="Ex.: Academia"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Cor</Label>
          <Input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 p-1"
          />
        </div>
        <Button onClick={create} disabled={submitting}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Cor</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhuma categoria
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => {
                const editing = editingId === c.id;
                const editable = canEdit(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      {editing ? (
                        <Input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="h-8 w-12 p-1"
                        />
                      ) : (
                        <div
                          className="h-5 w-5 rounded-full border"
                          style={{ backgroundColor: c.color ?? DEFAULT_COLOR }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      ) : (
                        c.name
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <Select
                          value={editType}
                          onValueChange={(v) => setEditType(v as TransactionType)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="expense">Despesa</SelectItem>
                            <SelectItem value="income">Receita</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={c.type === "expense" ? "destructive" : "default"}>
                          {c.type === "expense" ? "Despesa" : "Receita"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.is_global ? (
                        <Badge variant="secondary">Global</Badge>
                      ) : (
                        <Badge variant="outline">Pessoal</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editing ? (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => saveEdit(c.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : editable ? (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Lançamentos vinculados ficarão sem categoria. Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove(c.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

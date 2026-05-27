import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

type UserRow = {
  id: string;
  display_name: string | null;
  active: boolean;
  created_at: string;
  role: "admin" | "user";
};

function AdminUsersPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, navigate]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async (): Promise<UserRow[]> => {
      const [{ data: profs, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (e1) throw e1; if (e2) throw e2;
      return (profs ?? []).map((p: any) => ({
        ...p,
        role: (roles?.find((r: any) => r.user_id === p.id)?.role ?? "user") as "admin" | "user",
      }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "user" }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Papel atualizado"); },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ active }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Status atualizado"); },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  if (!isAdmin) return null;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Usuários</h1>
        <p className="text-muted-foreground">Gerencie níveis de acesso</p>
      </div>

      <Card className="p-6 bg-muted/50">
        <p className="text-sm text-muted-foreground">
          Para cadastrar um novo usuário, peça à pessoa para se inscrever em <strong>/signup</strong>.
          Ela aparecerá aqui automaticamente. Você pode então promover a admin ou desativar a conta.
        </p>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.display_name ?? "—"}</TableCell>
                <TableCell>{new Date(u.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <Badge variant={u.active ? "default" : "secondary"} className={u.active ? "bg-success text-success-foreground" : ""}>
                    {u.active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select value={u.role} onValueChange={(v) => setRole.mutate({ userId: u.id, role: v as any })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => toggleActive.mutate({ userId: u.id, active: !u.active })}>
                    {u.active ? "Desativar" : "Ativar"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

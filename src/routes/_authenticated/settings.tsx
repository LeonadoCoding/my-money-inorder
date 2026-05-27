import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CategoryManager } from "@/components/CategoryManager";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, displayName, isAdmin, refreshRole } = useAuth();
  const [name, setName] = useState(displayName ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user!.id);
    setSaving(false);
    if (error) { toast.error("Erro", { description: error.message }); return; }
    toast.success("Perfil atualizado");
    refreshRole();
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Perfil e preferências</p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">Perfil</h2>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label>Nome de exibição</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Nível de acesso</Label>
          <Input value={isAdmin ? "Administrador" : "Usuário"} disabled />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </Card>

      {isAdmin && (
        <Card className="p-6 bg-gold/10 border-gold/30">
          <h2 className="font-semibold mb-2">Você é administrador</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie usuários e níveis de acesso na seção <strong>Usuários</strong> do menu lateral.
          </p>
        </Card>
      )}
    </div>
  );
}

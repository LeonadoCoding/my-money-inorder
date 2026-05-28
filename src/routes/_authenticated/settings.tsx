import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CategoryManager } from "@/components/CategoryManager";
import { THEMES, getAppSetting, setAppSetting } from "@/lib/finance";
import { toast } from "sonner";
import { Check, Palette, MessageCircle, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, displayName, isAdmin, theme, themesAllowed, setTheme, refreshRole } = useAuth();
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
        <p className="text-muted-foreground">Perfil, tema e preferências</p>
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

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Palette className="size-4" /> Tema da interface</h2>
        {!themesAllowed && (
          <p className="text-sm text-muted-foreground">
            A personalização de tema foi desabilitada pelo administrador para a sua conta.
          </p>
        )}
        <div className={`grid grid-cols-2 md:grid-cols-5 gap-3 ${!themesAllowed ? "opacity-50 pointer-events-none" : ""}`}>
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value).then(() => toast.success(`Tema "${t.label}" aplicado`))}
              className={`relative p-4 rounded-lg border-2 text-left transition ${theme === t.value ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"}`}
            >
              <div className={`theme-${t.value} mb-2 flex gap-1`}>
                <span style={{ background: "var(--primary)" }} className="size-4 rounded-full" />
                <span style={{ background: "var(--accent)" }} className="size-4 rounded-full" />
                <span style={{ background: "var(--background)" }} className="size-4 rounded-full border border-border" />
              </div>
              <p className="text-sm font-medium">{t.label}</p>
              {theme === t.value && <Check className="size-4 text-primary absolute top-2 right-2" />}
            </button>
          ))}
        </div>
      </Card>

      <CategoryManager />

      {isAdmin && <AdminSettings />}
    </div>
  );
}

function AdminSettings() {
  const [waPhone, setWaPhone] = useState("");
  const [waMsg, setWaMsg] = useState("");
  const [mailReply, setMailReply] = useState("");
  const [mailPrefix, setMailPrefix] = useState("");
  const [themesEnabled, setThemesEnabled] = useState(true);
  const [users, setUsers] = useState<Array<{ id: string; display_name: string | null; themes_allowed: boolean }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const wa = await getAppSetting<any>("whatsapp");
      const em = await getAppSetting<any>("email");
      const th = await getAppSetting<any>("themes");
      setWaPhone(wa?.admin_phone ?? "");
      setWaMsg(wa?.default_message ?? "");
      setMailReply(em?.reply_to ?? "");
      setMailPrefix(em?.subject_prefix ?? "");
      setThemesEnabled(th?.enabled_globally ?? true);
      const { data } = await supabase.from("profiles").select("id, display_name, themes_allowed");
      setUsers((data as any[]) ?? []);
    })();
  }, []);

  const saveWa = async () => {
    setSaving(true);
    try {
      await setAppSetting("whatsapp", { admin_phone: waPhone, default_message: waMsg });
      toast.success("Config WhatsApp salva");
    } catch (e: any) { toast.error("Erro", { description: e.message }); }
    finally { setSaving(false); }
  };

  const saveMail = async () => {
    setSaving(true);
    try {
      await setAppSetting("email", { reply_to: mailReply, subject_prefix: mailPrefix });
      toast.success("Config E-mail salva");
    } catch (e: any) { toast.error("Erro", { description: e.message }); }
    finally { setSaving(false); }
  };

  const toggleUserTheme = async (id: string, allowed: boolean) => {
    const { error } = await supabase.from("profiles").update({ themes_allowed: allowed }).eq("id", id);
    if (error) { toast.error("Erro", { description: error.message }); return; }
    setUsers((u) => u.map((x) => x.id === id ? { ...x, themes_allowed: allowed } : x));
    toast.success("Permissão atualizada");
  };

  const toggleGlobal = async (v: boolean) => {
    setThemesEnabled(v);
    await setAppSetting("themes", { enabled_globally: v });
    toast.success(`Temas ${v ? "habilitados" : "desabilitados"} globalmente`);
  };

  return (
    <>
      <Card className="p-6 space-y-4 border-gold/30">
        <h2 className="font-semibold flex items-center gap-2"><MessageCircle className="size-4 text-success" /> WhatsApp (Admin)</h2>
        <p className="text-sm text-muted-foreground">
          Telefone padrão para envio rápido de relatórios. Para integração com a API oficial do WhatsApp Business (Meta), é necessário aprovar uma conta Business e configurar tokens — quando precisar, peça para adicionarmos.
        </p>
        <div className="space-y-2">
          <Label>Telefone do administrador (DDI + DDD + número)</Label>
          <Input placeholder="5511999999999" value={waPhone} onChange={(e) => setWaPhone(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Mensagem padrão</Label>
          <Input value={waMsg} onChange={(e) => setWaMsg(e.target.value)} />
        </div>
        <Button onClick={saveWa} disabled={saving}>Salvar WhatsApp</Button>
      </Card>

      <Card className="p-6 space-y-4 border-gold/30">
        <h2 className="font-semibold flex items-center gap-2"><Mail className="size-4 text-primary" /> Servidor de E-mail (Admin)</h2>
        <p className="text-sm text-muted-foreground">
          Endereço de resposta e prefixo de assunto usados nos envios. Para envio automatizado pelo servidor (sem abrir cliente de e-mail), é possível ativar o serviço de e-mail nativo — peça para configurarmos quando quiser.
        </p>
        <div className="space-y-2">
          <Label>Endereço de resposta (reply-to)</Label>
          <Input type="email" placeholder="financas@empresa.com" value={mailReply} onChange={(e) => setMailReply(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Prefixo do assunto</Label>
          <Input placeholder="[Finanças]" value={mailPrefix} onChange={(e) => setMailPrefix(e.target.value)} />
        </div>
        <Button onClick={saveMail} disabled={saving}>Salvar E-mail</Button>
      </Card>

      <Card className="p-6 space-y-4 border-gold/30">
        <h2 className="font-semibold flex items-center gap-2"><Palette className="size-4" /> Controle de Temas (Admin)</h2>
        <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
          <div>
            <p className="text-sm font-medium">Habilitar temas personalizados globalmente</p>
            <p className="text-xs text-muted-foreground">Quando desabilitado, ninguém pode trocar de tema.</p>
          </div>
          <Switch checked={themesEnabled} onCheckedChange={toggleGlobal} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Permissão por usuário</p>
          <div className="border border-border rounded-md divide-y divide-border">
            {users.length === 0 && <p className="text-sm text-muted-foreground p-3">Nenhum usuário</p>}
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3">
                <span className="text-sm">{u.display_name ?? u.id.slice(0, 8)}</span>
                <Switch checked={u.themes_allowed} onCheckedChange={(v) => toggleUserTheme(u.id, v)} />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}

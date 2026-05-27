import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, ArrowLeftRight, Download, Settings, LogOut, Wallet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/export", label: "Exportar", icon: Download },
  { to: "/settings", label: "Configurações", icon: Settings },
];

export function AppShell() {
  const { displayName, isAdmin, signOut, user } = useAuth();
  const navigate = useNavigate();
  const { location } = useRouterState();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-6 py-6 flex items-center gap-2 border-b border-sidebar-border">
          <div className="rounded-md bg-gold p-2 text-gold-foreground">
            <Wallet className="size-5" />
          </div>
          <div>
            <div className="font-semibold leading-tight">Meu Dinheiro</div>
            <div className="text-xs text-sidebar-foreground/70">Organizado</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-gold"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin/users"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                location.pathname.startsWith("/admin")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-gold"
                  : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
              )}
            >
              <Users className="size-4" />
              Usuários
            </Link>
          )}
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
          <div className="px-3 text-xs">
            <div className="font-medium truncate">{displayName ?? user?.email}</div>
            <div className="text-sidebar-foreground/60">{isAdmin ? "Administrador" : "Usuário"}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={handleSignOut}>
            <LogOut className="size-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

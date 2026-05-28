import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  displayName: string | null;
  theme: string;
  themesAllowed: boolean;
  setTheme: (t: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

const THEME_CLASSES = ["theme-emerald", "theme-midnight", "theme-sunset", "theme-arctic", "theme-noir"];

function applyTheme(theme: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  THEME_CLASSES.forEach((c) => root.classList.remove(c));
  root.classList.add(`theme-${theme}`);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [theme, setThemeState] = useState<string>("emerald");
  const [themesAllowed, setThemesAllowed] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("display_name, theme, themes_allowed").eq("id", uid).maybeSingle(),
    ]);
    setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    setDisplayName(profile?.display_name ?? null);
    const t = (profile as any)?.theme ?? "emerald";
    const allowed = (profile as any)?.themes_allowed ?? true;
    setThemeState(t);
    setThemesAllowed(allowed);
    applyTheme(allowed ? t : "emerald");
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setIsAdmin(false);
        setDisplayName(null);
        applyTheme("emerald");
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const setTheme = async (t: string) => {
    if (!user) return;
    if (!themesAllowed) return;
    setThemeState(t);
    applyTheme(t);
    await supabase.from("profiles").update({ theme: t }).eq("id", user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshRole = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <Ctx.Provider value={{ user, session, loading, isAdmin, displayName, theme, themesAllowed, setTheme, signOut, refreshRole }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

import { supabase } from "@/integrations/supabase/client";

export type TransactionType = "expense" | "income";
export type PaymentSource = "pix" | "dinheiro" | "credito" | "debito" | "transferencia" | "boleto" | "credito_parcelado" | "outro";

export const SOURCES: { value: PaymentSource; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "credito", label: "Cartão de crédito" },
  { value: "credito_parcelado", label: "Crédito parcelado" },
  { value: "debito", label: "Cartão de débito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

export const CURRENCIES = ["BRL", "USD", "EUR", "GBP"];

export const THEMES = [
  { value: "emerald", label: "Emerald Prestige" },
  { value: "midnight", label: "Midnight Indigo" },
  { value: "sunset", label: "Sunset Blaze" },
  { value: "arctic", label: "Arctic Frost" },
  { value: "noir", label: "Noir & Gold" },
];

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
  color: string | null;
  icon: string | null;
  is_global: boolean;
  user_id: string | null;
};

export type Transaction = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category_id: string | null;
  source: PaymentSource;
  description: string | null;
  occurred_at: string;
  created_at: string;
  installment_purchase_id: string | null;
  installment_number: number | null;
  category?: Category | null;
};

export type InstallmentPurchase = {
  id: string;
  user_id: string;
  total_amount: number;
  installments_count: number;
  currency: string;
  category_id: string | null;
  description: string | null;
  start_date: string;
  created_at: string;
};

export const formatCurrency = (n: number, currency = "BRL") => {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) throw error;
  return data as Category[];
}

export async function listTransactions(filters?: {
  from?: string;
  to?: string;
  type?: TransactionType;
  categoryId?: string;
  source?: PaymentSource;
}): Promise<Transaction[]> {
  let q = supabase.from("transactions").select("*, category:categories(*)").order("occurred_at", { ascending: false });
  if (filters?.from) q = q.gte("occurred_at", filters.from);
  if (filters?.to) q = q.lte("occurred_at", filters.to);
  if (filters?.type) q = q.eq("type", filters.type);
  if (filters?.categoryId) q = q.eq("category_id", filters.categoryId);
  if (filters?.source) q = q.eq("source", filters.source);
  const { data, error } = await q;
  if (error) throw error;
  return (data as any[]).map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[];
}

export async function listInstallmentPurchases(): Promise<InstallmentPurchase[]> {
  const { data, error } = await supabase.from("installment_purchases").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data as any[]).map((p) => ({ ...p, total_amount: Number(p.total_amount) })) as InstallmentPurchase[];
}

/**
 * Creates a parent installment_purchase and N child transactions (one per month).
 * Example: total=300, count=3, start=2026-01-15 → 100 each on 2026-01-15, 2026-02-15, 2026-03-15.
 */
export async function createInstallmentPurchase(params: {
  userId: string;
  totalAmount: number;
  installmentsCount: number;
  currency: string;
  categoryId: string | null;
  description: string | null;
  startDate: string; // YYYY-MM-DD
}) {
  const perInstallment = Math.round((params.totalAmount / params.installmentsCount) * 100) / 100;
  // adjust last installment to absorb rounding diff
  const totalRounded = perInstallment * params.installmentsCount;
  const diff = Math.round((params.totalAmount - totalRounded) * 100) / 100;

  const { data: parent, error: pErr } = await supabase
    .from("installment_purchases")
    .insert({
      user_id: params.userId,
      total_amount: params.totalAmount,
      installments_count: params.installmentsCount,
      currency: params.currency,
      category_id: params.categoryId,
      description: params.description,
      start_date: params.startDate,
    })
    .select()
    .single();
  if (pErr) throw pErr;

  const [yy, mm, dd] = params.startDate.split("-").map(Number);
  const rows = Array.from({ length: params.installmentsCount }, (_, i) => {
    const d = new Date(yy, mm - 1 + i, dd);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const amount = i === params.installmentsCount - 1 ? perInstallment + diff : perInstallment;
    return {
      user_id: params.userId,
      type: "expense" as const,
      amount,
      currency: params.currency,
      category_id: params.categoryId,
      source: "credito_parcelado" as const,
      description: params.description ? `${params.description} (${i + 1}/${params.installmentsCount})` : `Parcela ${i + 1}/${params.installmentsCount}`,
      occurred_at: dateStr,
      installment_purchase_id: parent.id,
      installment_number: i + 1,
    };
  });

  const { error: tErr } = await supabase.from("transactions").insert(rows);
  if (tErr) throw tErr;
  return parent;
}

export type InstallmentStats = {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paidCount: number;
  remainingCount: number;
  totalCount: number;
};

export function computeInstallmentStats(txs: Transaction[]): InstallmentStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inst = txs.filter((t) => t.installment_purchase_id);
  let paidAmount = 0, remainingAmount = 0, paidCount = 0, remainingCount = 0;
  for (const t of inst) {
    const d = new Date(t.occurred_at);
    if (d <= today) { paidAmount += t.amount; paidCount += 1; }
    else { remainingAmount += t.amount; remainingCount += 1; }
  }
  return {
    totalAmount: paidAmount + remainingAmount,
    paidAmount,
    remainingAmount,
    paidCount,
    remainingCount,
    totalCount: inst.length,
  };
}

export async function getAppSetting<T = any>(key: string): Promise<T | null> {
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) return null;
  return (data?.value ?? null) as T | null;
}

export async function setAppSetting(key: string, value: any) {
  const { error } = await supabase.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

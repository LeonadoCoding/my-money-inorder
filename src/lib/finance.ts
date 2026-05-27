import { supabase } from "@/integrations/supabase/client";

export type TransactionType = "expense" | "income";
export type PaymentSource = "pix" | "dinheiro" | "credito" | "debito" | "transferencia" | "boleto" | "outro";

export const SOURCES: { value: PaymentSource; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "credito", label: "Cartão de crédito" },
  { value: "debito", label: "Cartão de débito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

export const CURRENCIES = ["BRL", "USD", "EUR", "GBP"];

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
  category?: Category | null;
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

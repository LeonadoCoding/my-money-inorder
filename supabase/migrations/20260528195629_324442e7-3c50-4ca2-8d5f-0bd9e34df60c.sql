
-- 1. Add new payment_source enum value
ALTER TYPE payment_source ADD VALUE IF NOT EXISTS 'credito_parcelado';

-- 2. Installment purchases (parent record)
CREATE TABLE public.installment_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  installments_count integer NOT NULL CHECK (installments_count BETWEEN 2 AND 60),
  currency text NOT NULL DEFAULT 'BRL',
  category_id uuid,
  description text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_purchases TO authenticated;
GRANT ALL ON public.installment_purchases TO service_role;

ALTER TABLE public.installment_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IP: read own" ON public.installment_purchases FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "IP: insert own" ON public.installment_purchases FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "IP: update own" ON public.installment_purchases FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "IP: delete own" ON public.installment_purchases FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- 3. Link transactions to installment purchases
ALTER TABLE public.transactions
  ADD COLUMN installment_purchase_id uuid REFERENCES public.installment_purchases(id) ON DELETE CASCADE,
  ADD COLUMN installment_number integer;

CREATE INDEX idx_transactions_installment ON public.transactions(installment_purchase_id);

-- 4. Theme preference on profiles + admin-controlled enablement
ALTER TABLE public.profiles
  ADD COLUMN theme text NOT NULL DEFAULT 'emerald',
  ADD COLUMN themes_allowed boolean NOT NULL DEFAULT true;

-- 5. App settings (admin-managed key/value)
CREATE TABLE public.app_settings (
  key text NOT NULL PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings: read all authenticated" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Settings: admin insert" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Settings: admin update" ON public.app_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Settings: admin delete" ON public.app_settings FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Seed default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('whatsapp', '{"admin_phone": "", "default_message": "Relatório financeiro"}'),
  ('email', '{"reply_to": "", "subject_prefix": "[Finanças]"}'),
  ('themes', '{"enabled_globally": true, "allowed": ["emerald","midnight","sunset","arctic","noir"]}')
ON CONFLICT (key) DO NOTHING;

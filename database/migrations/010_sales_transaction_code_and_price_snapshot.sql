-- ---------------------------------------------------------------------------
-- Sales transaction code + sold price snapshot
-- ---------------------------------------------------------------------------
-- Run in Supabase SQL Editor.
--
-- Adds:
-- 1) sales.transaction_code: daily running ID format MMDDYYNN (e.g. 04082601)
-- 2) sales.unit_price: snapshot of product price at sell time
-- 3) RPC helper: next_sales_transaction_code()
--
-- Notes:
-- - Sequence is global per day (all branches combined).
-- - Day boundary uses Asia/Manila timezone for MMDDYY formatting.

CREATE TABLE IF NOT EXISTS public.sales_daily_counters (
  sales_date date PRIMARY KEY,
  last_value integer NOT NULL CHECK (last_value >= 0)
);

CREATE OR REPLACE FUNCTION public.next_sales_transaction_code(p_ts timestamptz DEFAULT now())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date;
  v_next integer;
BEGIN
  v_date := (p_ts AT TIME ZONE 'Asia/Manila')::date;

  INSERT INTO public.sales_daily_counters (sales_date, last_value)
  VALUES (v_date, 1)
  ON CONFLICT (sales_date)
  DO UPDATE SET last_value = public.sales_daily_counters.last_value + 1
  RETURNING last_value INTO v_next;

  RETURN to_char(v_date, 'MMDDYY') || lpad(v_next::text, 2, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_sales_transaction_code(timestamptz) TO authenticated;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS transaction_code text,
  ADD COLUMN IF NOT EXISTS unit_price numeric(14,2);

-- Backfill sold price from current product price where missing.
UPDATE public.sales s
SET unit_price = p.price
FROM public.products p
WHERE p.id = s.product_id
  AND s.unit_price IS NULL;

ALTER TABLE public.sales
  ALTER COLUMN unit_price SET NOT NULL;

-- Backfill transaction codes deterministically by sale timestamp.
WITH numbered AS (
  SELECT
    s.id,
    (s.created_at AT TIME ZONE 'Asia/Manila')::date AS local_date,
    row_number() OVER (
      PARTITION BY (s.created_at AT TIME ZONE 'Asia/Manila')::date
      ORDER BY s.created_at, s.id
    ) AS rn
  FROM public.sales s
)
UPDATE public.sales s
SET transaction_code = to_char(n.local_date, 'MMDDYY') || lpad(n.rn::text, 2, '0')
FROM numbered n
WHERE n.id = s.id
  AND s.transaction_code IS NULL;

ALTER TABLE public.sales
  ALTER COLUMN transaction_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_transaction_code ON public.sales (transaction_code);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales (created_at);

CREATE OR REPLACE FUNCTION public.sales_before_insert_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.transaction_code IS NULL OR btrim(NEW.transaction_code) = '' THEN
    NEW.transaction_code := public.next_sales_transaction_code(NEW.created_at);
  END IF;

  IF NEW.unit_price IS NULL THEN
    SELECT p.price INTO NEW.unit_price
    FROM public.products p
    WHERE p.id = NEW.product_id;
  END IF;

  IF NEW.unit_price IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve unit price for product %', NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_before_insert_defaults ON public.sales;
CREATE TRIGGER trg_sales_before_insert_defaults
  BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sales_before_insert_defaults();

NOTIFY pgrst, 'reload schema';

-- Sales & Inventory — run in Supabase SQL Editor (PostgreSQL 15+)
-- After first signup, promote owner: UPDATE profiles SET role = 'owner' WHERE email = 'you@example.com';

-- Extensions (Supabase usually has these enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

INSERT INTO public.branches (name) VALUES
  ('Calumpang Branch'),
  ('Palengke Branch')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  first_name text,
  last_name text,
  role text NOT NULL DEFAULT 'salesman' CHECK (role IN ('owner', 'salesman'))
);

CREATE TABLE public.salesman_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE CASCADE,
  UNIQUE (user_id)
);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  name text NOT NULL
);

CREATE TABLE public.subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories (id) ON DELETE CASCADE,
  name text NOT NULL
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  category_id uuid REFERENCES public.categories (id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.subcategories (id) ON DELETE SET NULL,
  name text NOT NULL,
  price numeric(14, 2),
  image_url text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE CASCADE,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, branch_id)
);

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  sold_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Auth: profile on signup (default salesman)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'salesman');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Inventory rows for every branch when a product is created
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_inventory_for_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.inventory (product_id, branch_id, stock)
  VALUES (NEW.id, NEW.branch_id, 0)
  ON CONFLICT (product_id, branch_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_seed_inventory ON public.products;
CREATE TRIGGER trg_product_seed_inventory
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.seed_inventory_for_product();

-- ---------------------------------------------------------------------------
-- Sales: validate stock then deduct (SECURITY DEFINER bypasses RLS on inventory)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sales_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock integer;
BEGIN
  SELECT i.stock INTO v_stock
  FROM public.inventory i
  WHERE i.product_id = NEW.product_id AND i.branch_id = NEW.branch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No inventory row for this product at this branch';
  END IF;

  IF v_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock (available %)', v_stock;
  END IF;

  IF NEW.branch_id <> (SELECT p.branch_id FROM public.products p WHERE p.id = NEW.product_id) THEN
    RAISE EXCEPTION 'Sale branch must match the product''s branch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sales_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.inventory
  SET stock = stock - NEW.quantity,
      updated_at = now()
  WHERE product_id = NEW.product_id AND branch_id = NEW.branch_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_before_insert ON public.sales;
CREATE TRIGGER trg_sales_before_insert
  BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sales_before_insert();

DROP TRIGGER IF EXISTS trg_sales_after_insert ON public.sales;
CREATE TRIGGER trg_sales_after_insert
  AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sales_after_insert();

-- ---------------------------------------------------------------------------
-- Helper: current user is owner
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.my_branch_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sb.branch_id
  FROM public.salesman_branches sb
  WHERE sb.user_id = auth.uid()
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- branches: readable by authenticated; write owner only
CREATE POLICY branches_select ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY branches_write ON public.branches FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

-- profiles
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_owner());
CREATE POLICY profiles_update_owner ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- salesman_branches
CREATE POLICY sb_select ON public.salesman_branches FOR SELECT TO authenticated
  USING (public.is_owner() OR user_id = auth.uid());
CREATE POLICY sb_write ON public.salesman_branches FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- categories
CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated
  USING (public.is_owner() OR branch_id = public.my_branch_id());
CREATE POLICY categories_write ON public.categories FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- subcategories
CREATE POLICY subcategories_select ON public.subcategories FOR SELECT TO authenticated
  USING (
    public.is_owner()
    OR EXISTS (
      SELECT 1
      FROM public.categories c
      WHERE c.id = category_id
        AND c.branch_id = public.my_branch_id()
    )
  );
CREATE POLICY subcategories_write ON public.subcategories FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- products (salesmen only see products for their branch)
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated
  USING (public.is_owner() OR branch_id = public.my_branch_id());
CREATE POLICY products_write ON public.products FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- inventory
CREATE POLICY inventory_select ON public.inventory FOR SELECT TO authenticated
  USING (
    public.is_owner()
    OR branch_id = public.my_branch_id()
  );
CREATE POLICY inventory_write ON public.inventory FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- sales
CREATE POLICY sales_select ON public.sales FOR SELECT TO authenticated
  USING (
    public.is_owner()
    OR sold_by = auth.uid()
  );

CREATE POLICY sales_insert_owner ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner()
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.branch_id = branch_id
    )
  );

CREATE POLICY sales_insert_salesman ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_owner()
    AND sold_by = auth.uid()
    AND branch_id = public.my_branch_id()
    AND EXISTS (
      SELECT 1 FROM public.salesman_branches sb
      WHERE sb.user_id = auth.uid() AND sb.branch_id = branch_id
    )
  );

CREATE POLICY sales_write_owner ON public.sales FOR UPDATE TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE POLICY sales_delete_owner ON public.sales FOR DELETE TO authenticated
  USING (public.is_owner());

-- ---------------------------------------------------------------------------
-- PostGraphile: optional comments for GraphQL naming
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.branches IS E'@name branches';
COMMENT ON TABLE public.profiles IS E'@omit all\nProfiles link auth users to app roles.';
COMMENT ON FUNCTION public.is_owner() IS E'@omit';

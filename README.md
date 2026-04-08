# Sales & Inventory (Nuxt 3 + Supabase)

Two-branch inventory (Calumpang / Palengke), owner vs salesman roles, POS sales with automatic stock deduction.

## Configure Supabase

1. Create a Supabase project.
2. In the SQL editor, run `database/schema.sql` (fresh database).
3. **If you already ran an older schema without `products.branch_id`**, also run `database/migrations/002_products_branch_id.sql` so each product is tied to one branch.
4. Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_KEY` (anon key from **Project Settings → API**).

### Branches (owner)

- Use the **Branch** buttons at the **top of the sidebar** to switch between Calumpang and Palengke. Everything (products list, new products, inventory, POS, dashboard low-stock) uses **that** branch until you switch.
- **Salesmen** are assigned one branch in **Team**; their sales always deduct stock for that branch (no sidebar switch).

### Login and passwords (important)

Passwords are **not** stored in `public.profiles`. Supabase Auth keeps credentials in **`auth.users`** (hashed). The `profiles` table only stores `id`, `email`, and `role`, linked to `auth.users`.

**To sign in:**

1. In the dashboard go to **Authentication → Users → Add user → Create new user**, set **email** and **password**, and confirm. That creates `auth.users` and the `handle_new_user` trigger creates the matching **`profiles`** row (default role `salesman`).
2. Promote your account to owner in the SQL editor:

```sql
update public.profiles
set role = 'owner'
where email = 'you@example.com';
```

**If you only inserted a row into `profiles` via SQL** (without creating a user under Authentication), there is **no password** and login cannot work. Create the user in **Authentication → Users** instead (or use **Authentication → Providers → Email** and sign up from the app if you add a sign-up flow later).

**If login still fails:** under **Authentication → Providers**, ensure **Email** is enabled.

## Local app

```bash
npm install
npm run dev
```

## PostGraphile (optional GraphQL)

Point `DATABASE_URL` at your Supabase Postgres connection string, then:

```bash
npm run postgraphile
```

Or use `docker-compose.postgraphile.yml` with the same variable.

## Production build

```bash
npm run build
npm run preview
```

## If the app spins forever in the browser

- Ensure `.env` exists with valid `SUPABASE_URL` and `SUPABASE_KEY` (anon). Missing values break the Supabase client and can block hydration.
- Restart `npm run dev` after changing `.env`.

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

### Confirmation emails point to localhost

Supabase builds links in signup/reset emails from **Authentication → URL Configuration**:

1. Set **Site URL** to your live app (e.g. `https://your-app.vercel.app`), not `http://localhost:3000`.
2. Under **Redirect URLs**, add your production URL and paths you use after auth, e.g. `https://your-app.vercel.app/**` and `https://your-app.vercel.app/login`.

On Vercel, set **`NUXT_PUBLIC_SITE_URL`** to the same production URL (optional if you rely on auto `VERCEL_URL`, but recommended for a custom domain). Team signup passes that URL as `email_redirect_to` so new users land on production `/login` after confirming email.

Redeploy after changing env vars. Old emails already sent still contain the old link; create a new user or resend confirmation to test.

### Team member create fails (“Signup response was incomplete”)

Add **`SUPABASE_SERVICE_ROLE_KEY`** (Project Settings → API → `service_role`, server-only) to `.env` and Vercel. The Team page uses a server route to create users with the admin API so the owner session is not replaced and Supabase returns a reliable user id. Without it, the app falls back to public signup, which often returns the user at the top level of the JSON (not under `user`) when email confirmation is enabled.

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

# HMUK

One login page for everyone. After signing in, users are automatically sent
to `/dashboard` and admins to `/admin`, based on a `role` column in the
database — not based on which page they visited.

## 1. Create a Supabase project
1. Go to https://supabase.com/dashboard and create a new project.
2. Go to **Settings → API** and copy the Project URL and the `anon` `public` key.
3. Go to **Authentication → URL Configuration** and set:
   - Site URL: `http://localhost:3000` (add your Vercel URL after deploying)
   - Redirect URLs: add `http://localhost:3000/auth/callback` (and your Vercel URL + `/auth/callback` later)

## 2. Set up the database
1. In Supabase, go to **SQL Editor → New query**.
2. Paste in everything from `supabase/setup.sql` in this project and click **Run**.

This creates a `profiles` table with a `role` column (`user` or `admin`),
and a trigger that automatically adds a row with `role = 'user'` every time
someone signs up. Nobody can make themselves an admin through the app.

## 3. Make someone an admin
In Supabase, go to **Table Editor → profiles**, find their row, and change
`role` from `user` to `admin`. That's it — next time they log in (or refresh),
they'll land on `/admin` instead of `/dashboard`.

## 4. Run locally
```bash
npm install
cp .env.local.example .env.local
# paste your Supabase URL + anon key into .env.local
npm run dev
```
Visit http://localhost:3000.

## 5. Deploy to Vercel
1. Push this project to a GitHub repo.
2. Import it at https://vercel.com/new.
3. In **Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.
5. Back in Supabase, add your production URL (e.g. `https://your-app.vercel.app/auth/callback`) to **Authentication → URL Configuration**, and update the Site URL too.

## How the role check works (two layers)
- **`middleware.ts`** runs on every request and blocks a logged-in regular
  user from reaching `/admin` by typing the URL directly — they get bounced
  to `/dashboard`.
- **`app/admin/page.tsx`** checks the role again on the server before
  rendering anything, as a second layer in case the route is ever reached
  another way.

Row Level Security on the `profiles` table also means a user can only ever
read their *own* role — they can't query anyone else's.

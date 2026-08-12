-- Run this in Supabase: SQL Editor -> New query -> paste -> Run

-- Admins need to see every member's accounts and profile info to
-- review contributions/loans and manage the member list — not just
-- their own row.
create policy "Admins can view all coop accounts"
  on public.coop_accounts for select
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

create policy "Admins can view all profiles"
  on public.profiles for select
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Admins can now edit the settings (interest rates, account limit)
-- from the app instead of only via Table Editor.
create policy "Admins can update settings"
  on public.app_settings for update
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

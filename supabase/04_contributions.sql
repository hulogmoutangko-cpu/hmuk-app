-- Run this in Supabase: SQL Editor -> New query -> paste -> Run
-- Builds on top of setup.sql and 02_profiles_and_coop_accounts.sql.

-- ============================================================
-- 1. Penalties (referenced by contributions.penalty_id)
-- ============================================================
create table if not exists public.penalties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(12, 2) not null default 0,
  description text,
  created_at timestamp with time zone default now()
);

alter table public.penalties enable row level security;

create policy "Signed-in users can view penalties"
  on public.penalties for select
  using (auth.role() = 'authenticated');

create policy "Only admins manage penalties"
  on public.penalties for all
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

-- ============================================================
-- 2. Contributions — one per payment, tied to a coop_account
-- ============================================================
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.coop_accounts(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  signature_url text not null,
  pay_date date not null,
  post_date date,
  penalty_id uuid references public.penalties(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  updated_by uuid references public.profiles(id),
  created_at timestamp with time zone not null default now()
);

alter table public.contributions enable row level security;

-- Members see contributions on their own accounts; admins see everything
create policy "View own contributions, or all if admin"
  on public.contributions for select
  using (
    exists (
      select 1 from public.coop_accounts ca
      where ca.id = contributions.account_id
      and ca.profile_id = auth.uid()
    )
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Members can submit a payment for their own account, always starting
-- as 'pending' with no post_date — only an admin can post/approve it
create policy "Members can submit a contribution for their own account"
  on public.contributions for insert
  with check (
    exists (
      select 1 from public.coop_accounts ca
      where ca.id = account_id
      and ca.profile_id = auth.uid()
    )
    and status = 'pending'
    and post_date is null
  );

-- Only admins can approve/reject/edit a contribution after it's submitted
create policy "Only admins can update contributions"
  on public.contributions for update
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

create policy "Only admins can delete contributions"
  on public.contributions for delete
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Auto-fill updated_by (whoever makes the change) and post_date
-- (the day it gets approved) — no need for the app to set these itself
create or replace function public.contributions_before_update()
returns trigger as $$
begin
  new.updated_by = auth.uid();

  if new.status = 'approved' and old.status <> 'approved' then
    new.post_date = current_date;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists contributions_before_update_trigger on public.contributions;

create trigger contributions_before_update_trigger
  before update on public.contributions
  for each row execute procedure public.contributions_before_update();

-- ============================================================
-- 3. Storage bucket for payment signatures
--    Upload path: <user-id>/<filename>, same pattern as avatars/signatures
-- ============================================================
insert into storage.buckets (id, name, public)
values ('contribution-signatures', 'contribution-signatures', true)
on conflict (id) do nothing;

create policy "Contribution signatures are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'contribution-signatures');

create policy "Users can upload their own contribution signature"
  on storage.objects for insert
  with check (
    bucket_id = 'contribution-signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

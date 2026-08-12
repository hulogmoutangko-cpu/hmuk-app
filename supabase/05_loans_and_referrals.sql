-- Run this in Supabase: SQL Editor -> New query -> paste -> Run
-- Builds on top of setup.sql, 02_profiles_and_coop_accounts.sql,
-- 03_signup_metadata.sql, and 04_contributions.sql.

-- ============================================================
-- 1. Interest rate settings (admin will edit these via a
--    settings page later — for now, edit app_settings directly)
-- ============================================================
alter table public.app_settings
  add column if not exists member_loan_interest_rate numeric(5, 2) not null default 5.00,
  add column if not exists referral_fee_rate numeric(5, 2) not null default 1.00;
  -- member_loan_interest_rate: monthly %, e.g. 5.00 = 5%/month
  -- referral_fee_rate: extra monthly % added on top for a referred
  --   non-member borrower, e.g. 1.00 = +1%/month, paid to the referrer

-- ============================================================
-- 2. Referral code per member
-- ============================================================
alter table public.profiles
  add column if not exists referral_code text unique;

-- Backfill existing accounts that signed up before this column existed
update public.profiles
set referral_code = upper(substr(md5(random()::text || id::text), 1, 8))
where referral_code is null;

-- New signups now also get a referral code automatically
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, first_name, last_name, referral_code)
  values (
    new.id,
    new.email,
    'user',
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    upper(substr(md5(random()::text || new.id::text), 1, 8))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Helper functions so the public referral page can look up a member
-- by their code without needing broad read access to the profiles table
create or replace function public.referral_code_owner(code text)
returns uuid as $$
  select id from public.profiles where referral_code = code;
$$ language sql security definer stable;

create or replace function public.get_referrer_name(code text)
returns table(first_name text, last_name text) as $$
  select first_name, last_name from public.profiles where referral_code = code;
$$ language sql security definer stable;

create or replace function public.get_loan_rates()
returns table(base_rate numeric, referral_rate numeric) as $$
  select member_loan_interest_rate, referral_fee_rate
  from public.app_settings where id = 1;
$$ language sql security definer stable;

grant execute on function public.referral_code_owner(text) to anon, authenticated;
grant execute on function public.get_referrer_name(text) to anon, authenticated;
grant execute on function public.get_loan_rates() to anon, authenticated;

-- ============================================================
-- 3. Loans — either a member borrowing on their own account,
--    or a non-member borrowing after being referred by a member
-- ============================================================
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.coop_accounts(id) on delete cascade,
  borrower_type text not null default 'member'
    check (borrower_type in ('member', 'non_member')),
  borrower_name text,
  borrower_contact text,
  referred_by uuid references public.profiles(id),
  referral_code_used text,
  principal_amount numeric(12, 2) not null check (principal_amount > 0),
  base_interest_rate numeric(5, 2) not null,
  referral_fee_rate numeric(5, 2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'active', 'completed')),
  applied_at timestamp with time zone not null default now(),
  approved_at timestamp with time zone,
  updated_by uuid references public.profiles(id),
  constraint loan_borrower_shape check (
    (borrower_type = 'member' and account_id is not null and referred_by is null)
    or
    (borrower_type = 'non_member' and account_id is null and referred_by is not null and borrower_name is not null)
  )
);

alter table public.loans enable row level security;

create policy "View own loans, referred loans, or all if admin"
  on public.loans for select
  using (
    exists (
      select 1 from public.coop_accounts ca
      where ca.id = loans.account_id and ca.profile_id = auth.uid()
    )
    or referred_by = auth.uid()
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create policy "Members can apply for a loan on their own account"
  on public.loans for insert
  with check (
    borrower_type = 'member'
    and referred_by is null
    and exists (
      select 1 from public.coop_accounts ca
      where ca.id = account_id and ca.profile_id = auth.uid()
    )
    and status = 'pending'
    and base_interest_rate = (select base_rate from public.get_loan_rates())
    and referral_fee_rate = 0
  );

create policy "Anyone can apply for a referred non-member loan"
  on public.loans for insert
  with check (
    borrower_type = 'non_member'
    and account_id is null
    and borrower_name is not null
    and referral_code_used is not null
    and referred_by = public.referral_code_owner(referral_code_used)
    and status = 'pending'
    and base_interest_rate = (select base_rate from public.get_loan_rates())
    and referral_fee_rate = (select referral_rate from public.get_loan_rates())
  );

create policy "Only admins can update loans"
  on public.loans for update
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

create policy "Only admins can delete loans"
  on public.loans for delete
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

create or replace function public.loans_before_update()
returns trigger as $$
begin
  new.updated_by = auth.uid();
  if new.status = 'approved' and old.status <> 'approved' and new.approved_at is null then
    new.approved_at = now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists loans_before_update_trigger on public.loans;

create trigger loans_before_update_trigger
  before update on public.loans
  for each row execute procedure public.loans_before_update();

-- ============================================================
-- 4. Monthly interest — logged per loan, then the base portion
--    (excluding referral fees) is split across all member accounts
--    proportional to their total approved contributions
-- ============================================================
create table if not exists public.loan_interest_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  period_month date not null,
  interest_amount numeric(12, 2) not null,
  referral_amount numeric(12, 2) not null default 0,
  pool_amount numeric(12, 2) not null,
  posted_by uuid references public.profiles(id),
  posted_at timestamp with time zone not null default now(),
  unique (loan_id, period_month)
);

alter table public.loan_interest_payments enable row level security;

create policy "View interest on own/referred loans, or all if admin"
  on public.loan_interest_payments for select
  using (
    exists (
      select 1 from public.loans l
      join public.coop_accounts ca on ca.id = l.account_id
      where l.id = loan_interest_payments.loan_id and ca.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.loans l
      where l.id = loan_interest_payments.loan_id and l.referred_by = auth.uid()
    )
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create table if not exists public.member_interest_shares (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.coop_accounts(id) on delete cascade,
  period_month date not null,
  amount numeric(12, 2) not null,
  posted_by uuid references public.profiles(id),
  posted_at timestamp with time zone not null default now(),
  unique (account_id, period_month)
);

alter table public.member_interest_shares enable row level security;

create policy "View own interest shares, or all if admin"
  on public.member_interest_shares for select
  using (
    exists (
      select 1 from public.coop_accounts ca
      where ca.id = member_interest_shares.account_id and ca.profile_id = auth.uid()
    )
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Admin-triggered: logs this month's interest per loan, then splits
-- the base (non-referral) portion across all accounts by contribution
-- share. Safe to re-run for the same month — already-posted rows are
-- skipped via the unique constraints above.
create or replace function public.post_monthly_interest(target_month date)
returns void as $$
declare
  v_total_pool numeric(14, 2);
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Only an admin can post monthly interest.';
  end if;

  insert into public.loan_interest_payments
    (loan_id, period_month, interest_amount, referral_amount, pool_amount, posted_by)
  select
    l.id,
    target_month,
    round(l.principal_amount * l.base_interest_rate / 100, 2),
    round(l.principal_amount * l.referral_fee_rate / 100, 2),
    round(l.principal_amount * l.base_interest_rate / 100, 2),
    auth.uid()
  from public.loans l
  where l.status in ('approved', 'active')
  on conflict (loan_id, period_month) do nothing;

  select coalesce(sum(pool_amount), 0) into v_total_pool
  from public.loan_interest_payments
  where period_month = target_month;

  if v_total_pool > 0 then
    insert into public.member_interest_shares (account_id, period_month, amount, posted_by)
    select
      ca.id,
      target_month,
      round(v_total_pool * (coalesce(sum(c.amount), 0) / nullif(totals.grand_total, 0)), 2),
      auth.uid()
    from public.coop_accounts ca
    left join public.contributions c
      on c.account_id = ca.id and c.status = 'approved'
    cross join (
      select coalesce(sum(amount), 0) as grand_total
      from public.contributions
      where status = 'approved'
    ) totals
    group by ca.id, totals.grand_total
    having coalesce(sum(c.amount), 0) > 0
    on conflict (account_id, period_month) do nothing;
  end if;
end;
$$ language plpgsql security definer;

grant execute on function public.post_monthly_interest(date) to authenticated;

create index if not exists idx_loans_account_id on public.loans(account_id);
create index if not exists idx_loans_referred_by on public.loans(referred_by);
create index if not exists idx_contributions_account_id on public.contributions(account_id);

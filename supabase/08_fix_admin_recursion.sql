-- Run this in Supabase: SQL Editor -> New query -> paste -> Run
-- Fixes "infinite recursion detected in policy for relation profiles".
--
-- The cause: the "Admins can view all profiles" policy (on the profiles
-- table) checked the caller's role by querying profiles again — so
-- checking the policy required re-checking the policy, forever.
--
-- The fix: a SECURITY DEFINER function bypasses RLS internally, so it
-- can safely check the role without looping back through the policy.
-- This replaces every admin-check policy that used the same pattern.

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable set search_path = public;

grant execute on function public.is_admin() to anon, authenticated;

-- profiles (this is the one that was actually causing the recursion)
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- coop_accounts
drop policy if exists "Admins can view all coop accounts" on public.coop_accounts;
create policy "Admins can view all coop accounts"
  on public.coop_accounts for select
  using (public.is_admin());

-- app_settings
drop policy if exists "Admins can update settings" on public.app_settings;
create policy "Admins can update settings"
  on public.app_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- penalties
drop policy if exists "Only admins manage penalties" on public.penalties;
create policy "Only admins manage penalties"
  on public.penalties for all
  using (public.is_admin())
  with check (public.is_admin());

-- contributions
drop policy if exists "View own contributions, or all if admin" on public.contributions;
create policy "View own contributions, or all if admin"
  on public.contributions for select
  using (
    exists (
      select 1 from public.coop_accounts ca
      where ca.id = contributions.account_id
      and ca.profile_id = auth.uid()
    )
    or public.is_admin()
  );

drop policy if exists "Only admins can update contributions" on public.contributions;
create policy "Only admins can update contributions"
  on public.contributions for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Only admins can delete contributions" on public.contributions;
create policy "Only admins can delete contributions"
  on public.contributions for delete
  using (public.is_admin());

-- loans
drop policy if exists "View own loans, referred loans, or all if admin" on public.loans;
create policy "View own loans, referred loans, or all if admin"
  on public.loans for select
  using (
    exists (
      select 1 from public.coop_accounts ca
      where ca.id = loans.account_id and ca.profile_id = auth.uid()
    )
    or referred_by = auth.uid()
    or public.is_admin()
  );

drop policy if exists "Only admins can update loans" on public.loans;
create policy "Only admins can update loans"
  on public.loans for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Only admins can delete loans" on public.loans;
create policy "Only admins can delete loans"
  on public.loans for delete
  using (public.is_admin());

-- post_monthly_interest: same check, now via the helper function
create or replace function public.post_monthly_interest(target_month date)
returns void as $$
declare
  v_total_pool numeric(14, 2);
begin
  if not public.is_admin() then
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

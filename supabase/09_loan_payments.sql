-- Run this in Supabase: SQL Editor -> New query -> paste -> Run

-- ============================================================
-- 1. loan_payments — a repayment toward a loan, split into how
--    much goes to principal vs interest
-- ============================================================
create table if not exists public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  principal_portion numeric(12, 2) not null default 0 check (principal_portion >= 0),
  interest_portion numeric(12, 2) not null default 0 check (interest_portion >= 0),
  total_amount numeric(12, 2) generated always as (principal_portion + interest_portion) stored,
  signature_url text,
  pay_date date not null,
  post_date date,
  submitted_by text not null check (submitted_by in ('member', 'non_member', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  updated_by uuid references public.profiles(id),
  created_at timestamp with time zone not null default now(),
  constraint payment_has_amount check (principal_portion > 0 or interest_portion > 0)
);

alter table public.loan_payments enable row level security;

create policy "View own loan payments, or all if admin"
  on public.loan_payments for select
  using (
    exists (
      select 1 from public.loans l
      join public.coop_accounts ca on ca.id = l.account_id
      where l.id = loan_payments.loan_id and ca.profile_id = auth.uid()
    )
    or public.is_admin()
  );

-- A member paying toward their own loan — always starts pending
create policy "Members can submit a payment on their own loan"
  on public.loan_payments for insert
  with check (
    submitted_by = 'member'
    and status = 'pending'
    and post_date is null
    and signature_url is not null
    and exists (
      select 1 from public.loans l
      join public.coop_accounts ca on ca.id = l.account_id
      where l.id = loan_id and ca.profile_id = auth.uid()
    )
  );

-- A non-member paying via their public loan payment link — no login,
-- so this is scoped to loans that are actually non-member loans
create policy "Non-members can submit a payment on a referred loan"
  on public.loan_payments for insert
  with check (
    submitted_by = 'non_member'
    and status = 'pending'
    and post_date is null
    and signature_url is not null
    and exists (
      select 1 from public.loans l
      where l.id = loan_id and l.borrower_type = 'non_member'
    )
  );

-- Admin recording a payment directly (e.g. cash received in person) —
-- can be entered already-approved, no signature required
create policy "Admins can record a payment on any loan"
  on public.loan_payments for insert
  with check (public.is_admin());

create policy "Only admins can update loan payments"
  on public.loan_payments for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Only admins can delete loan payments"
  on public.loan_payments for delete
  using (public.is_admin());

-- Auto-fill updated_by / post_date when an admin approves a
-- member/non-member-submitted payment
create or replace function public.loan_payments_before_update()
returns trigger as $$
begin
  new.updated_by = auth.uid();
  if new.status = 'approved' and old.status <> 'approved' and new.post_date is null then
    new.post_date = current_date;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists loan_payments_before_update_trigger on public.loan_payments;

create trigger loan_payments_before_update_trigger
  before update on public.loan_payments
  for each row execute procedure public.loan_payments_before_update();

-- Once a loan's approved principal payments cover the full principal,
-- mark the loan completed automatically
create or replace function public.loan_payments_after_change()
returns trigger as $$
declare
  v_principal_paid numeric(14, 2);
  v_principal_amount numeric(14, 2);
begin
  if new.status = 'approved' then
    select coalesce(sum(principal_portion), 0) into v_principal_paid
    from public.loan_payments
    where loan_id = new.loan_id and status = 'approved';

    select principal_amount into v_principal_amount
    from public.loans where id = new.loan_id;

    if v_principal_amount is not null and v_principal_paid >= v_principal_amount then
      update public.loans set status = 'completed'
      where id = new.loan_id and status <> 'completed';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists loan_payments_after_change_trigger on public.loan_payments;

create trigger loan_payments_after_change_trigger
  after insert or update on public.loan_payments
  for each row execute procedure public.loan_payments_after_change();

-- ============================================================
-- 2. Public lookup for the non-member payment link — returns
--    balance info for a specific loan without exposing the table,
--    and only ever for non-member loans (never a member's own loan)
-- ============================================================
create or replace function public.get_public_loan_info(p_loan_id uuid)
returns table(
  id uuid,
  borrower_name text,
  principal_amount numeric,
  base_interest_rate numeric,
  referral_fee_rate numeric,
  status text,
  principal_paid numeric
) as $$
  select
    l.id,
    l.borrower_name,
    l.principal_amount,
    l.base_interest_rate,
    l.referral_fee_rate,
    l.status,
    coalesce((
      select sum(principal_portion) from public.loan_payments lp
      where lp.loan_id = l.id and lp.status = 'approved'
    ), 0) as principal_paid
  from public.loans l
  where l.id = p_loan_id and l.borrower_type = 'non_member';
$$ language sql security definer stable;

grant execute on function public.get_public_loan_info(uuid) to anon, authenticated;

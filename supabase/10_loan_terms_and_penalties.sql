-- Run this in Supabase: SQL Editor -> New query -> paste -> Run

-- ============================================================
-- 1. Loan term, in months. Interest is flat per month (not
--    reducing-balance), so total interest = monthly interest x term.
-- ============================================================
alter table public.loans
  add column if not exists term_months integer not null default 1
    check (term_months > 0);

-- ============================================================
-- 2. Automatic due-now calculator.
--    Assumes equal principal installments + a flat monthly interest
--    charge, paid in order (oldest installment first). Given how much
--    has been paid in total, it works out which installment is next,
--    and if it's overdue, applies the grace/penalty/extra-month rules:
--      - 0-15 days late:  +5% penalty (once)
--      - 16+ days late:   treated as another month owed — adds one more
--                         month's interest, and the penalty steps up
--                         another +5% (so 16-45 days late = 10% total,
--                         46-75 = 15%, and so on every extra 30 days)
-- ============================================================
create or replace function public.get_loan_due_now(p_loan_id uuid)
returns table (
  installment_number int,
  due_date date,
  principal_due numeric,
  interest_due numeric,
  extra_interest_due numeric,
  penalty_due numeric,
  total_due numeric,
  days_late int,
  loan_status text
) as $$
declare
  v_loan record;
  v_principal_per numeric(14, 2);
  v_interest_per numeric(14, 2);
  v_installment_cost numeric(14, 2);
  v_total_paid numeric(14, 2);
  v_installments_paid int;
  v_next_installment int;
  v_due_date date;
  v_days_late int;
  v_extra_cycles int;
  v_penalty numeric(14, 2);
  v_extra_interest numeric(14, 2);
  v_status text;
begin
  select * into v_loan from public.loans where id = p_loan_id;
  if not found then
    return;
  end if;

  if v_loan.approved_at is null then
    return query select
      null::int, null::date, 0::numeric, 0::numeric, 0::numeric,
      0::numeric, 0::numeric, 0::int, v_loan.status;
    return;
  end if;

  v_principal_per := round(v_loan.principal_amount / v_loan.term_months, 2);
  v_interest_per := round(
    v_loan.principal_amount * (v_loan.base_interest_rate + v_loan.referral_fee_rate) / 100,
    2
  );
  v_installment_cost := v_principal_per + v_interest_per;

  select coalesce(sum(principal_portion + interest_portion), 0) into v_total_paid
  from public.loan_payments
  where loan_id = p_loan_id and status = 'approved';

  v_installments_paid := floor(v_total_paid / nullif(v_installment_cost, 0));
  v_next_installment := v_installments_paid + 1;

  if v_next_installment > v_loan.term_months then
    return query select
      v_loan.term_months, null::date, 0::numeric, 0::numeric, 0::numeric,
      0::numeric, 0::numeric, 0::int, 'completed';
    return;
  end if;

  v_due_date := (v_loan.approved_at::date + (v_next_installment || ' months')::interval)::date;
  v_days_late := greatest(0, current_date - v_due_date);

  if v_days_late <= 0 then
    v_status := 'upcoming';
    v_penalty := 0;
    v_extra_interest := 0;
  elsif v_days_late <= 15 then
    v_status := 'grace';
    v_penalty := round(v_loan.principal_amount * 5 / 100, 2);
    v_extra_interest := 0;
  else
    v_extra_cycles := 1 + floor((v_days_late - 16) / 30);
    v_status := 'overdue';
    v_penalty := round(v_loan.principal_amount * (5 * (v_extra_cycles + 1)) / 100, 2);
    v_extra_interest := round(v_interest_per * v_extra_cycles, 2);
  end if;

  return query select
    v_next_installment,
    v_due_date,
    v_principal_per,
    v_interest_per,
    v_extra_interest,
    v_penalty,
    v_principal_per + v_interest_per + v_extra_interest + v_penalty,
    v_days_late,
    v_status;
end;
$$ language plpgsql security definer stable;

grant execute on function public.get_loan_due_now(uuid) to anon, authenticated;

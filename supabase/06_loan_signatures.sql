-- Run this in Supabase: SQL Editor -> New query -> paste -> Run

alter table public.loans
  add column if not exists signature_url text;

drop policy if exists "Members can apply for a loan on their own account" on public.loans;

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
    and signature_url is not null
  );

drop policy if exists "Anyone can apply for a referred non-member loan" on public.loans;

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
    and signature_url is not null
  );

-- Bucket for loan signatures. Member applications upload to
-- <user-id>/<file>; public referral applicants (no login) upload to
-- referral/<file> since there's no user id to key off of.
insert into storage.buckets (id, name, public)
values ('loan-signatures', 'loan-signatures', true)
on conflict (id) do nothing;

create policy "Loan signatures are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'loan-signatures');

create policy "Members can upload their own loan signature"
  on storage.objects for insert
  with check (
    bucket_id = 'loan-signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can upload a referral loan signature"
  on storage.objects for insert
  with check (
    bucket_id = 'loan-signatures'
    and (storage.foldername(name))[1] = 'referral'
  );

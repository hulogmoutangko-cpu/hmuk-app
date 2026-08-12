-- Run this in Supabase: SQL Editor -> New query -> paste -> Run
-- Safe to run once. Builds on top of supabase/setup.sql.

-- ============================================================
-- 1. Extend profiles with name, picture, signature
-- ============================================================
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists profile_picture_url text,
  add column if not exists signature_url text;

-- Let users edit their own profile...
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ...but never their own role, even though the policy above allows
-- updating the row. This trigger blocks the role column specifically
-- unless the request comes from the service_role key (e.g. an admin
-- action, or you editing it directly in Table Editor).
create or replace function public.prevent_role_self_change()
returns trigger as $$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    raise exception 'Only an admin can change a role.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists prevent_role_self_change_trigger on public.profiles;

create trigger prevent_role_self_change_trigger
  before update on public.profiles
  for each row execute procedure public.prevent_role_self_change();

-- ============================================================
-- 2. App-wide settings (admin will edit this via a settings page later)
-- ============================================================
create table if not exists public.app_settings (
  id int primary key default 1,
  max_coop_accounts int not null default 3,
  constraint single_row check (id = 1)
);

insert into public.app_settings (id, max_coop_accounts)
values (1, 3)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

create policy "Signed-in users can read settings"
  on public.app_settings for select
  using (auth.role() = 'authenticated');

-- No update policy for regular users on purpose. Until the admin
-- settings page exists, change the limit directly in Table Editor
-- (that uses the service_role key and bypasses RLS).

-- ============================================================
-- 3. coop_accounts — extra accounts a regular user can add,
--    up to app_settings.max_coop_accounts
-- ============================================================
create table if not exists public.coop_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  account_name text not null,
  created_at timestamp with time zone default now()
);

alter table public.coop_accounts enable row level security;

create policy "Users can view their own coop accounts"
  on public.coop_accounts for select
  using (profile_id = auth.uid());

create policy "Users can add coop accounts up to their limit"
  on public.coop_accounts for insert
  with check (
    profile_id = auth.uid()
    and (select role from public.profiles where id = auth.uid()) = 'user'
    and (
      select count(*) from public.coop_accounts where profile_id = auth.uid()
    ) < (select max_coop_accounts from public.app_settings where id = 1)
  );

create policy "Users can rename their own coop accounts"
  on public.coop_accounts for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "Users can delete their own coop accounts"
  on public.coop_accounts for delete
  using (profile_id = auth.uid());

-- ============================================================
-- 4. Storage buckets for profile pictures & signatures
--    Files should be uploaded as: <user-id>/<filename>
--    e.g. 4f2a.../photo.png — the folder name IS the owner check.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can replace their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Signature images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'signatures');

create policy "Users can upload their own signature"
  on storage.objects for insert
  with check (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can replace their own signature"
  on storage.objects for update
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

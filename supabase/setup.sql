-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run

-- 1. Table to hold each user's role
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamp with time zone default now()
);

-- 2. Row Level Security: users can read their own profile only
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- 3. Auto-create a profile row (role = 'user') every time someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- To make someone an admin afterwards, run:
-- update public.profiles set role = 'admin' where email = 'someone@example.com';

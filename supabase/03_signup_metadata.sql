-- Run this in Supabase: SQL Editor -> New query -> paste -> Run
-- Updates the auto-create trigger so first_name/last_name (sent from
-- the signup form) land in profiles immediately, instead of being blank.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, first_name, last_name)
  values (
    new.id,
    new.email,
    'user',
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  );
  return new;
end;
$$ language plpgsql security definer;

-- No need to re-create the trigger itself — it already points at this
-- function, so replacing the function body is enough.

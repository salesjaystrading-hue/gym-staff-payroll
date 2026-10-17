-- Stores each login's email on the profile so the admin's Users screen can show it.
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;
-- handle_new_user() was also updated to copy the email; see the applied `profiles_email` migration.

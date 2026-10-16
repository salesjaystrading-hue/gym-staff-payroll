-- Slice 1: roles, gyms, employees, manager permissions, audit log, RLS
create schema if not exists private;
grant usage on schema private to authenticated;

create type public.app_role as enum ('admin', 'gym_manager', 'staff');

-- ---------- tables ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  phone text,
  email text,
  opening_time time,
  closing_time time,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gym_settings (
  gym_id uuid primary key references public.gyms (id) on delete cascade,
  deduction_method text not null default 'daily' check (deduction_method in ('daily', 'shift', 'hourly')),
  salary_divisor text not null default 'fixed_30' check (salary_divisor in ('fixed_30', 'calendar_days', 'working_days')),
  late_marks_per_half_day int check (late_marks_per_half_day is null or late_marks_per_half_day > 0),
  overtime_enabled boolean not null default false,
  overtime_rate numeric(8, 2) not null default 0 check (overtime_rate >= 0),
  updated_at timestamptz not null default now()
);

create table public.manager_gym_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  primary key (user_id, gym_id)
);

create table public.manager_permissions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  can_manage_employees boolean not null default true,
  can_view_salaries boolean not null default false,
  can_configure_salary boolean not null default false,
  can_edit_attendance boolean not null default true,
  can_approve_leave boolean not null default true,
  can_approve_payroll boolean not null default false
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  user_id uuid unique references public.profiles (id) on delete set null,
  gym_id uuid not null references public.gyms (id),
  full_name text not null,
  phone text,
  designation text,
  joining_date date not null,
  weekly_off smallint not null default 0 check (weekly_off between 0 and 6), -- 0 = Sunday
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employees_gym_idx on public.employees (gym_id);

-- salary lives in its own table so it can be hidden from managers without permission
-- and keeps dated revision history (new row = new revision, never edited)
create table public.employee_salaries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  monthly_salary numeric(12, 2) not null check (monthly_salary >= 0),
  effective_from date not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (employee_id, effective_from)
);

create table public.employee_gym_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  gym_id uuid not null references public.gyms (id),
  from_date date not null default current_date,
  to_date date
);
create index employee_gym_history_emp_idx on public.employee_gym_history (employee_id);

create table public.audit_log (
  id bigserial primary key,
  actor uuid,
  table_name text not null,
  record_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- ---------- helper functions (private schema, not exposed over the API) ----------
create function private.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() = 'admin', false)
$$;

create function private.manages_gym(g uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case private.my_role()
    when 'admin' then true
    when 'gym_manager' then exists (
      select 1 from public.manager_gym_access a where a.user_id = auth.uid() and a.gym_id = g)
    else false
  end
$$;

create function private.has_perm(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case private.my_role()
    when 'admin' then true
    when 'gym_manager' then coalesce((
      select case p
        when 'can_manage_employees' then mp.can_manage_employees
        when 'can_view_salaries' then mp.can_view_salaries
        when 'can_configure_salary' then mp.can_configure_salary
        when 'can_edit_attendance' then mp.can_edit_attendance
        when 'can_approve_leave' then mp.can_approve_leave
        when 'can_approve_payroll' then mp.can_approve_payroll
        else false end
      from public.manager_permissions mp where mp.user_id = auth.uid()), false)
    else false
  end
$$;

create function private.own_employee_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select e.id from public.employees e
  join public.profiles p on p.id = e.user_id
  where e.user_id = auth.uid() and p.is_active
$$;

create function private.own_gym_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select e.gym_id from public.employees e where e.user_id = auth.uid()
$$;

create function private.employee_gym(eid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select gym_id from public.employees where id = eid
$$;

grant execute on all functions in schema private to authenticated;

-- ---------- triggers ----------
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger gyms_touch before update on public.gyms
  for each row execute function private.touch_updated_at();
create trigger employees_touch before update on public.employees
  for each row execute function private.touch_updated_at();
create trigger gym_settings_touch before update on public.gym_settings
  for each row execute function private.touch_updated_at();

create function private.create_gym_settings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.gym_settings (gym_id) values (new.id);
  return new;
end $$;
create trigger gyms_default_settings after insert on public.gyms
  for each row execute function private.create_gym_settings();

-- only admins may link an employee to a login account
create function private.guard_employee_user_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.user_id is not null)
     or (tg_op = 'UPDATE' and new.user_id is distinct from old.user_id) then
    if not private.is_admin() then
      raise exception 'Only an admin can link an employee to a login account';
    end if;
  end if;
  return new;
end $$;
create trigger employees_guard_link before insert or update on public.employees
  for each row execute function private.guard_employee_user_link();

-- keep gym assignment history when an employee is added or moved
create function private.track_employee_gym() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.employee_gym_history (employee_id, gym_id, from_date)
    values (new.id, new.gym_id, new.joining_date);
  elsif new.gym_id is distinct from old.gym_id then
    update public.employee_gym_history set to_date = current_date
      where employee_id = new.id and to_date is null;
    insert into public.employee_gym_history (employee_id, gym_id, from_date)
    values (new.id, new.gym_id, current_date);
  end if;
  return new;
end $$;
create trigger employees_track_gym after insert or update on public.employees
  for each row execute function private.track_employee_gym();

-- audit log
create function private.log_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  r := to_jsonb(coalesce(new, old));
  insert into public.audit_log (actor, table_name, record_id, action, old_data, new_data)
  values (auth.uid(), tg_table_name, coalesce(r ->> 'id', r ->> 'user_id'), tg_op,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit_gyms after insert or update or delete on public.gyms
  for each row execute function private.log_change();
create trigger audit_gym_settings after update on public.gym_settings
  for each row execute function private.log_change();
create trigger audit_employees after insert or update or delete on public.employees
  for each row execute function private.log_change();
create trigger audit_employee_salaries after insert or update or delete on public.employee_salaries
  for each row execute function private.log_change();
create trigger audit_manager_permissions after insert or update or delete on public.manager_permissions
  for each row execute function private.log_change();
create trigger audit_manager_gym_access after insert or delete on public.manager_gym_access
  for each row execute function private.log_change();
create trigger audit_profiles after update or delete on public.profiles
  for each row execute function private.log_change();

-- new login -> profile. Role comes from app_metadata (only settable server-side).
-- The very first account becomes admin; everyone else defaults to staff.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.app_role;
begin
  r := coalesce(
    (new.raw_app_meta_data ->> 'role')::public.app_role,
    case when exists (select 1 from public.profiles) then 'staff'::public.app_role
         else 'admin'::public.app_role end);
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), r);
  if r = 'gym_manager' then
    insert into public.manager_permissions (user_id) values (new.id);
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.gyms enable row level security;
alter table public.gym_settings enable row level security;
alter table public.manager_gym_access enable row level security;
alter table public.manager_permissions enable row level security;
alter table public.employees enable row level security;
alter table public.employee_salaries enable row level security;
alter table public.employee_gym_history enable row level security;
alter table public.audit_log enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- gyms: admin all, manager assigned, staff own gym; writes admin only
create policy gyms_select on public.gyms for select to authenticated
  using (private.manages_gym(id) or id = private.own_gym_id());
create policy gyms_insert on public.gyms for insert to authenticated
  with check (private.is_admin());
create policy gyms_update on public.gyms for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- gym settings: managers need the configure-salary permission to change rules
create policy gym_settings_select on public.gym_settings for select to authenticated
  using (private.manages_gym(gym_id));
create policy gym_settings_update on public.gym_settings for update to authenticated
  using (private.manages_gym(gym_id) and private.has_perm('can_configure_salary'))
  with check (private.manages_gym(gym_id) and private.has_perm('can_configure_salary'));

-- manager access + permissions: admin writes, manager reads own
create policy mga_select on public.manager_gym_access for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy mga_insert on public.manager_gym_access for insert to authenticated
  with check (private.is_admin());
create policy mga_delete on public.manager_gym_access for delete to authenticated
  using (private.is_admin());

create policy mp_select on public.manager_permissions for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy mp_insert on public.manager_permissions for insert to authenticated
  with check (private.is_admin());
create policy mp_update on public.manager_permissions for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- employees: no delete policy -> can only be deactivated
create policy employees_select on public.employees for select to authenticated
  using (private.manages_gym(gym_id) or id = private.own_employee_id());
create policy employees_insert on public.employees for insert to authenticated
  with check (private.manages_gym(gym_id) and private.has_perm('can_manage_employees'));
create policy employees_update on public.employees for update to authenticated
  using (private.manages_gym(gym_id) and private.has_perm('can_manage_employees'))
  with check (private.manages_gym(gym_id) and private.has_perm('can_manage_employees'));

-- salaries: hidden unless admin, own record, or manager with view permission
create policy salaries_select on public.employee_salaries for select to authenticated
  using (
    employee_id = private.own_employee_id()
    or (private.manages_gym(private.employee_gym(employee_id)) and private.has_perm('can_view_salaries'))
  );
create policy salaries_insert on public.employee_salaries for insert to authenticated
  with check (private.manages_gym(private.employee_gym(employee_id)) and private.has_perm('can_configure_salary'));

create policy egh_select on public.employee_gym_history for select to authenticated
  using (private.manages_gym(gym_id) or employee_id = private.own_employee_id());

create policy audit_select on public.audit_log for select to authenticated
  using (private.is_admin());

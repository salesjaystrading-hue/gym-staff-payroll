-- Phases 2-6: shifts, attendance, QR, leave, payroll, advances, incentives (tables + RLS)
alter table public.gym_settings
  add column late_grace_minutes int not null default 10 check (late_grace_minutes >= 0),
  add column paid_leaves_per_month numeric(4, 1) not null default 1 check (paid_leaves_per_month >= 0);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null, -- earlier than start_time means the shift crosses midnight
  is_active boolean not null default true,
  unique (gym_id, name)
);

alter table public.employees
  add column shift_id uuid references public.shifts (id),
  add column device_id text; -- the one phone allowed to check in

create table public.gym_holidays (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  holiday_date date not null,
  name text not null,
  primary key (gym_id, holiday_date)
);

create type public.attendance_status as enum
  ('present', 'late', 'half_day', 'absent', 'paid_leave', 'unpaid_leave', 'weekly_off', 'holiday');

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  gym_id uuid not null references public.gyms (id),
  work_date date not null, -- for overnight shifts: the date the shift started
  check_in timestamptz,
  check_out timestamptz,
  status public.attendance_status not null,
  source text not null check (source in ('qr', 'manual', 'leave')),
  note text,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date),
  check (source <> 'manual' or length(trim(coalesce(note, ''))) > 0),
  check (check_out is null or check_in is null or check_out > check_in)
);
create index attendance_gym_date_idx on public.attendance (gym_id, work_date);

create table public.gym_qr_tokens (
  token text primary key,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  expires_at timestamptz not null
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  gym_id uuid not null references public.gyms (id),
  from_date date not null,
  to_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approved_type text check (approved_type in ('paid', 'unpaid')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  check (to_date >= from_date and to_date - from_date <= 62)
);

create table public.advances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  gym_id uuid not null references public.gyms (id),
  amount numeric(12, 2) not null check (amount > 0),
  issued_on date not null default current_date,
  monthly_recovery numeric(12, 2) not null check (monthly_recovery > 0),
  note text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.incentives (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  gym_id uuid not null references public.gyms (id),
  month date not null check (month = date_trunc('month', month)::date),
  kind text not null default 'bonus',
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  month date not null check (month = date_trunc('month', month)::date),
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  deduction_method text not null,
  salary_divisor text not null,
  overtime_enabled boolean not null,
  overtime_rate numeric(8, 2) not null,
  late_marks_per_half_day int,
  generated_by uuid references public.profiles (id),
  generated_at timestamptz not null default now(),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  unique (gym_id, month)
);

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs (id) on delete cascade,
  gym_id uuid not null references public.gyms (id),
  employee_id uuid not null references public.employees (id),
  monthly_salary numeric(12, 2) not null,
  divisor numeric(5, 1) not null,
  present_days numeric(5, 1) not null default 0,
  late_count int not null default 0,
  absent_units numeric(7, 2) not null default 0,
  unpaid_leave_days numeric(5, 1) not null default 0,
  paid_leave_days numeric(5, 1) not null default 0,
  deduction_amount numeric(12, 2) not null default 0,
  overtime_hours numeric(7, 2) not null default 0,
  overtime_amount numeric(12, 2) not null default 0,
  incentive_amount numeric(12, 2) not null default 0,
  advance_recovery numeric(12, 2) not null default 0,
  net_salary numeric(12, 2) not null,
  flags jsonb not null default '{}'::jsonb,
  unique (run_id, employee_id)
);

create table public.advance_recoveries (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references public.advances (id),
  payroll_item_id uuid not null references public.payroll_items (id),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (advance_id, payroll_item_id) -- the same recovery can never be taken twice
);

create table public.payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs (id),
  gym_id uuid not null references public.gyms (id),
  employee_id uuid not null references public.employees (id),
  kind text not null check (kind in ('earning', 'deduction')),
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.payroll_payments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.payroll_items (id),
  gym_id uuid not null references public.gyms (id),
  employee_id uuid not null references public.employees (id),
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null,
  method text not null check (method in ('bank', 'upi', 'cash')),
  reference text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
create function private.clock() returns timestamptz
language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('app.fake_now', true), '')::timestamptz, now())
$$;

create function private.local_today() returns date
language sql stable set search_path = '' as $$
  select (private.clock() at time zone 'Asia/Kolkata')::date
$$;

create function private.is_locked(g uuid, d date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.payroll_runs r
    where r.gym_id = g and r.month = date_trunc('month', d)::date and r.status in ('approved', 'paid'))
$$;

create function private.staff_can_see_run(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.payroll_items i join public.payroll_runs r on r.id = i.run_id
    where r.id = rid and i.employee_id = private.own_employee_id() and r.status in ('approved', 'paid'))
$$;

create function private.item_final(item uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select i.net_salary
    + coalesce((select sum(a.amount) from public.payroll_adjustments a where a.run_id = i.run_id and a.employee_id = i.employee_id and a.kind = 'earning'), 0)
    - coalesce((select sum(a.amount) from public.payroll_adjustments a where a.run_id = i.run_id and a.employee_id = i.employee_id and a.kind = 'deduction'), 0)
  from public.payroll_items i where i.id = item
$$;

-- ---------- triggers ----------
create function private.guard_locked_month() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(coalesce(new, old));
begin
  if private.is_locked((r ->> 'gym_id')::uuid, coalesce((r ->> 'work_date')::date, (r ->> 'month')::date)) then
    raise exception 'Payroll for this month is approved and locked. Add a payroll adjustment instead.';
  end if;
  return coalesce(new, old);
end $$;
create trigger attendance_lock before insert or update or delete on public.attendance
  for each row execute function private.guard_locked_month();
create trigger incentives_lock before insert or delete on public.incentives
  for each row execute function private.guard_locked_month();

create trigger attendance_touch before update on public.attendance
  for each row execute function private.touch_updated_at();

create function private.prepare_adjustment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  select r.gym_id into g from public.payroll_runs r where r.id = new.run_id;
  if g is null or not exists (select 1 from public.payroll_items i where i.run_id = new.run_id and i.employee_id = new.employee_id) then
    raise exception 'That employee is not in this payroll run';
  end if;
  new.gym_id := g;
  new.created_by := auth.uid();
  return new;
end $$;
create trigger adjustments_prepare before insert on public.payroll_adjustments
  for each row execute function private.prepare_adjustment();

create function private.reopen_paid_run() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.payroll_runs set status = 'approved' where id = new.run_id and status = 'paid';
  return new;
end $$;
create trigger adjustments_reopen after insert on public.payroll_adjustments
  for each row execute function private.reopen_paid_run();

create trigger audit_shifts after insert or update or delete on public.shifts for each row execute function private.log_change();
create trigger audit_holidays after insert or delete on public.gym_holidays for each row execute function private.log_change();
create trigger audit_attendance after insert or update or delete on public.attendance for each row execute function private.log_change();
create trigger audit_leave after insert or update on public.leave_requests for each row execute function private.log_change();
create trigger audit_advances after insert or update on public.advances for each row execute function private.log_change();
create trigger audit_incentives after insert or delete on public.incentives for each row execute function private.log_change();
create trigger audit_runs after insert or update on public.payroll_runs for each row execute function private.log_change();
create trigger audit_adjustments after insert on public.payroll_adjustments for each row execute function private.log_change();
create trigger audit_payments after insert on public.payroll_payments for each row execute function private.log_change();

-- ---------- view: one row per payslip with adjustments and payments rolled in ----------
create view public.payroll_item_view with (security_invoker = true) as
select x.*, x.net_salary + x.adj_earning - x.adj_deduction as final_net
from (
  select i.*, r.month, r.status as run_status,
    coalesce((select sum(a.amount) from public.payroll_adjustments a where a.run_id = i.run_id and a.employee_id = i.employee_id and a.kind = 'earning'), 0) as adj_earning,
    coalesce((select sum(a.amount) from public.payroll_adjustments a where a.run_id = i.run_id and a.employee_id = i.employee_id and a.kind = 'deduction'), 0) as adj_deduction,
    coalesce((select sum(p.amount) from public.payroll_payments p where p.item_id = i.id), 0) as paid_amount
  from public.payroll_items i join public.payroll_runs r on r.id = i.run_id
) x;

-- ---------- RLS ----------
alter table public.shifts enable row level security;
alter table public.gym_holidays enable row level security;
alter table public.attendance enable row level security;
alter table public.gym_qr_tokens enable row level security;
alter table public.leave_requests enable row level security;
alter table public.advances enable row level security;
alter table public.incentives enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;
alter table public.advance_recoveries enable row level security;
alter table public.payroll_adjustments enable row level security;
alter table public.payroll_payments enable row level security;

create policy shifts_select on public.shifts for select to authenticated
  using (private.manages_gym(gym_id) or gym_id = private.own_gym_id());
create policy shifts_insert on public.shifts for insert to authenticated
  with check (private.manages_gym(gym_id) and private.has_perm('can_manage_employees'));
create policy shifts_update on public.shifts for update to authenticated
  using (private.manages_gym(gym_id) and private.has_perm('can_manage_employees'))
  with check (private.manages_gym(gym_id) and private.has_perm('can_manage_employees'));

create policy holidays_select on public.gym_holidays for select to authenticated
  using (private.manages_gym(gym_id) or gym_id = private.own_gym_id());
create policy holidays_insert on public.gym_holidays for insert to authenticated
  with check (private.manages_gym(gym_id) and private.has_perm('can_manage_employees'));
create policy holidays_delete on public.gym_holidays for delete to authenticated
  using (private.manages_gym(gym_id) and private.has_perm('can_manage_employees'));

create policy attendance_select on public.attendance for select to authenticated
  using (private.manages_gym(gym_id) or employee_id = private.own_employee_id());
create policy attendance_insert on public.attendance for insert to authenticated
  with check (private.manages_gym(gym_id) and private.has_perm('can_edit_attendance')
    and source = 'manual' and gym_id = private.employee_gym(employee_id));
create policy attendance_update on public.attendance for update to authenticated
  using (private.manages_gym(gym_id) and private.has_perm('can_edit_attendance'))
  with check (private.manages_gym(gym_id) and private.has_perm('can_edit_attendance')
    and source = 'manual' and gym_id = private.employee_gym(employee_id));

create policy leave_select on public.leave_requests for select to authenticated
  using (private.manages_gym(gym_id) or employee_id = private.own_employee_id());
create policy leave_insert on public.leave_requests for insert to authenticated
  with check (employee_id = private.own_employee_id() and gym_id = private.own_gym_id()
    and status = 'pending' and approved_type is null and decided_by is null);

create policy advances_select on public.advances for select to authenticated
  using ((private.manages_gym(gym_id) and (private.has_perm('can_configure_salary') or private.has_perm('can_approve_payroll')))
    or employee_id = private.own_employee_id());
create policy advances_insert on public.advances for insert to authenticated
  with check (private.manages_gym(gym_id) and private.has_perm('can_configure_salary')
    and gym_id = private.employee_gym(employee_id));

create policy recoveries_select on public.advance_recoveries for select to authenticated
  using (exists (select 1 from public.advances a where a.id = advance_id));

create policy incentives_select on public.incentives for select to authenticated
  using ((private.manages_gym(gym_id) and (private.has_perm('can_configure_salary') or private.has_perm('can_approve_payroll')))
    or employee_id = private.own_employee_id());
create policy incentives_insert on public.incentives for insert to authenticated
  with check (private.manages_gym(gym_id) and private.has_perm('can_configure_salary')
    and gym_id = private.employee_gym(employee_id));
create policy incentives_delete on public.incentives for delete to authenticated
  using (private.manages_gym(gym_id) and private.has_perm('can_configure_salary'));

create policy runs_select on public.payroll_runs for select to authenticated
  using ((private.manages_gym(gym_id) and (private.has_perm('can_approve_payroll') or private.has_perm('can_view_salaries')))
    or private.staff_can_see_run(id));
create policy items_select on public.payroll_items for select to authenticated
  using ((private.manages_gym(gym_id) and (private.has_perm('can_approve_payroll') or private.has_perm('can_view_salaries')))
    or (employee_id = private.own_employee_id() and private.staff_can_see_run(run_id)));
create policy adjustments_select on public.payroll_adjustments for select to authenticated
  using ((private.manages_gym(gym_id) and (private.has_perm('can_approve_payroll') or private.has_perm('can_view_salaries')))
    or (employee_id = private.own_employee_id() and private.staff_can_see_run(run_id)));
create policy adjustments_insert on public.payroll_adjustments for insert to authenticated
  with check (private.manages_gym(gym_id) and private.has_perm('can_approve_payroll'));
create policy payments_select on public.payroll_payments for select to authenticated
  using ((private.manages_gym(gym_id) and (private.has_perm('can_approve_payroll') or private.has_perm('can_view_salaries')))
    or employee_id = private.own_employee_id());

grant execute on all functions in schema private to authenticated;

-- Duty roster: per-day overrides (day off or a different shift) on top of each employee's normal shift and weekly off.
create table public.roster (
  employee_id uuid not null references public.employees (id) on delete cascade,
  gym_id uuid not null references public.gyms (id),
  work_date date not null,
  shift_id uuid references public.shifts (id),
  is_off boolean not null default false,
  created_by uuid references public.profiles (id),
  primary key (employee_id, work_date),
  check (is_off = (shift_id is null))
);
create index roster_gym_date on public.roster (gym_id, work_date);
alter table public.roster enable row level security;
create policy roster_select on public.roster for select to authenticated
  using (private.manages_gym(gym_id) or employee_id = private.own_employee_id());
create policy roster_write on public.roster for all to authenticated
  using (private.manages_gym(gym_id) and private.has_perm('can_edit_attendance'))
  with check (private.manages_gym(gym_id) and private.has_perm('can_edit_attendance') and gym_id = private.employee_gym(employee_id));
create trigger roster_lock before insert or update or delete on public.roster
  for each row execute function private.guard_locked_month();
create trigger audit_roster after insert or update or delete on public.roster
  for each row execute function private.log_change();

-- The migration then patched three functions in place (qr_check_in, approve_leave, generate_payroll):
--  * qr_check_in: uses the rostered shift for the day (late marking), else the employee's shift.
--  * approve_leave: a roster day off / working day replaces the weekly off for that date.
--  * generate_payroll: roster day off / working day overrides weekly off; a rostered shift sets that day's hours.
-- Verified: 30,000 salary, Nov 2026, no attendance, weekly off Sunday, roster off on 2 weekdays and working on 1 Sunday
--          -> 24 absent days, deduction 24,000.

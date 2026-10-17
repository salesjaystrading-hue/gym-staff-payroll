-- Attendance correction requests and salary advance requests.
create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  gym_id uuid not null references public.gyms (id),
  work_date date not null,
  check_in timestamptz,
  check_out timestamptz,
  reason text not null check (length(trim(reason)) > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
alter table public.attendance_corrections enable row level security;
create policy corr_select on public.attendance_corrections for select to authenticated
  using (private.manages_gym(gym_id) or employee_id = private.own_employee_id());
create policy corr_insert on public.attendance_corrections for insert to authenticated
  with check (employee_id = private.own_employee_id() and gym_id = private.own_gym_id()
    and status = 'pending' and decided_by is null);

create table public.advance_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  gym_id uuid not null references public.gyms (id),
  amount numeric(12, 2) not null check (amount > 0),
  monthly_recovery numeric(12, 2) check (monthly_recovery > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  advance_id uuid references public.advances (id),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
alter table public.advance_requests enable row level security;
create policy advreq_select on public.advance_requests for select to authenticated
  using ((private.manages_gym(gym_id) and (private.has_perm('can_configure_salary') or private.has_perm('can_approve_payroll')))
    or employee_id = private.own_employee_id());
create policy advreq_insert on public.advance_requests for insert to authenticated
  with check (employee_id = private.own_employee_id() and gym_id = private.own_gym_id()
    and status = 'pending' and advance_id is null and decided_by is null);

create function public.decide_correction(p_id uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.attendance_corrections%rowtype;
begin
  select * into c from public.attendance_corrections where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if c.status <> 'pending' then raise exception 'This request was already decided'; end if;
  if not (private.manages_gym(c.gym_id) and private.has_perm('can_edit_attendance')) then raise exception 'Not allowed'; end if;
  if p_approve then
    insert into public.attendance (employee_id, gym_id, work_date, check_in, check_out, status, source, note, updated_by)
    values (c.employee_id, c.gym_id, c.work_date, c.check_in, c.check_out, 'present', 'manual', 'Correction: ' || c.reason, auth.uid())
    on conflict (employee_id, work_date) do update set
      check_in = coalesce(excluded.check_in, public.attendance.check_in),
      check_out = coalesce(excluded.check_out, public.attendance.check_out),
      status = case when public.attendance.status in ('absent', 'unpaid_leave') then 'present'::public.attendance_status else public.attendance.status end,
      source = 'manual', note = excluded.note, updated_by = auth.uid(), updated_at = now();
  end if;
  update public.attendance_corrections
    set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now(), decision_note = p_note
    where id = p_id;
end $$;

create function public.decide_advance_request(p_id uuid, p_approve boolean, p_amount numeric, p_monthly numeric, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.advance_requests%rowtype; v_adv uuid;
begin
  select * into r from public.advance_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'This request was already decided'; end if;
  if not (private.manages_gym(r.gym_id) and (private.has_perm('can_configure_salary') or private.has_perm('can_approve_payroll'))) then raise exception 'Not allowed'; end if;
  if p_approve then
    if coalesce(p_amount, 0) <= 0 or coalesce(p_monthly, 0) <= 0 then raise exception 'Enter the amount and monthly recovery'; end if;
    insert into public.advances (employee_id, gym_id, amount, issued_on, monthly_recovery, note, created_by)
    values (r.employee_id, r.gym_id, p_amount, private.local_today(), p_monthly, 'Approved request', auth.uid())
    returning id into v_adv;
  end if;
  update public.advance_requests
    set status = case when p_approve then 'approved' else 'rejected' end, advance_id = v_adv,
        decided_by = auth.uid(), decided_at = now(), decision_note = p_note
    where id = p_id;
end $$;

revoke all on function public.decide_correction(uuid, boolean, text) from public, anon;
revoke all on function public.decide_advance_request(uuid, boolean, numeric, numeric, text) from public, anon;
grant execute on function public.decide_correction(uuid, boolean, text) to authenticated;
grant execute on function public.decide_advance_request(uuid, boolean, numeric, numeric, text) to authenticated;

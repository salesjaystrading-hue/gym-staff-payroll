-- Phases 2-6: callable functions (QR check-in, leave, payroll). All run with the caller's identity checked inside.

create function public.rotate_gym_qr(p_gym uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare t text := replace(gen_random_uuid()::text, '-', '');
begin
  if not (private.manages_gym(p_gym) and private.has_perm('can_edit_attendance')) then
    raise exception 'Not allowed';
  end if;
  delete from public.gym_qr_tokens where expires_at < now() - interval '5 minutes';
  insert into public.gym_qr_tokens (token, gym_id, expires_at) values (t, p_gym, now() + interval '75 seconds');
  return t;
end $$;

create function public.qr_check_in(p_token text, p_device text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_tok public.gym_qr_tokens%rowtype;
  v_emp public.employees%rowtype;
  v_sh public.shifts%rowtype;
  v_has_shift boolean := false;
  v_att public.attendance%rowtype;
  v_now timestamptz := private.clock();
  v_local timestamp := private.clock() at time zone 'Asia/Kolkata';
  v_wd date;
  v_grace int;
  v_status public.attendance_status := 'present';
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_device is null or length(p_device) < 8 then
    return jsonb_build_object('ok', false, 'message', 'This phone could not be recognised. Reload and try again.');
  end if;

  select * into v_tok from public.gym_qr_tokens where token = p_token and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'message', 'This QR code has expired. Scan the code currently on the screen.');
  end if;

  select * into v_emp from public.employees where user_id = auth.uid() and is_active;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Your login is not linked to an active employee record.');
  end if;
  if v_emp.gym_id <> v_tok.gym_id then
    return jsonb_build_object('ok', false, 'message', 'This QR code belongs to a different gym.');
  end if;

  if v_emp.device_id is null then
    update public.employees set device_id = p_device where id = v_emp.id;
  elsif v_emp.device_id <> p_device then
    return jsonb_build_object('ok', false, 'message', 'This is not your registered phone. Ask your manager to reset it.');
  end if;

  v_wd := v_local::date;
  if v_emp.shift_id is not null then
    select * into v_sh from public.shifts where id = v_emp.shift_id;
    v_has_shift := found;
    if v_has_shift and v_sh.end_time < v_sh.start_time and v_local::time < v_sh.end_time then
      v_wd := v_wd - 1; -- overnight shift: still belongs to the day it started
    end if;
  end if;

  if private.is_locked(v_emp.gym_id, v_wd) then
    return jsonb_build_object('ok', false, 'message', 'This month is closed for payroll. Ask your manager.');
  end if;

  select * into v_att from public.attendance where employee_id = v_emp.id and work_date = v_wd;
  if not found then
    select late_grace_minutes into v_grace from public.gym_settings where gym_id = v_emp.gym_id;
    if v_has_shift and v_local > (v_wd + v_sh.start_time) + make_interval(mins => v_grace) then
      v_status := 'late';
    end if;
    insert into public.attendance (employee_id, gym_id, work_date, check_in, status, source)
    values (v_emp.id, v_emp.gym_id, v_wd, v_now, v_status, 'qr');
    return jsonb_build_object('ok', true, 'action', 'check_in', 'status', v_status,
      'message', 'Checked in at ' || to_char(v_local, 'HH12:MI AM') || case when v_status = 'late' then ' (late)' else '' end);
  end if;

  if v_att.check_in is null then
    return jsonb_build_object('ok', false, 'message', 'Your manager has already marked today as ' || replace(v_att.status::text, '_', ' ') || '.');
  end if;
  if v_att.check_out is null then
    if v_now - v_att.check_in < interval '10 minutes' then
      return jsonb_build_object('ok', false, 'message', 'You are already checked in. Scan again when you leave.');
    end if;
    update public.attendance set check_out = v_now where id = v_att.id;
    return jsonb_build_object('ok', true, 'action', 'check_out',
      'message', 'Checked out at ' || to_char(v_local, 'HH12:MI AM'));
  end if;
  return jsonb_build_object('ok', false, 'message', 'You have already checked out for today.');
end $$;

create function public.approve_leave(p_id uuid, p_type text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare lr public.leave_requests%rowtype; emp public.employees%rowtype; d date;
begin
  select * into lr from public.leave_requests where id = p_id for update;
  if not found then raise exception 'Leave request not found'; end if;
  if lr.status <> 'pending' then raise exception 'This request was already decided'; end if;
  if not (private.manages_gym(lr.gym_id) and private.has_perm('can_approve_leave')) then raise exception 'Not allowed'; end if;
  if p_type not in ('paid', 'unpaid') then raise exception 'Choose paid or unpaid'; end if;
  select * into emp from public.employees where id = lr.employee_id;

  for d in select g::date from generate_series(lr.from_date::timestamp, lr.to_date::timestamp, interval '1 day') g loop
    continue when extract(dow from d)::int = emp.weekly_off
      or exists (select 1 from public.gym_holidays h where h.gym_id = lr.gym_id and h.holiday_date = d);
    insert into public.attendance (employee_id, gym_id, work_date, status, source, note, updated_by)
    values (lr.employee_id, lr.gym_id, d,
      (case when p_type = 'paid' then 'paid_leave' else 'unpaid_leave' end)::public.attendance_status,
      'leave', 'Leave approved', auth.uid())
    on conflict (employee_id, work_date) do update
      set status = excluded.status, source = 'leave', note = 'Leave approved', updated_by = auth.uid(), updated_at = now()
      where public.attendance.check_in is null;
  end loop;

  update public.leave_requests
    set status = 'approved', approved_type = p_type, decided_by = auth.uid(), decided_at = now(), decision_note = p_note
    where id = p_id;
end $$;

create function public.reject_leave(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare lr public.leave_requests%rowtype;
begin
  select * into lr from public.leave_requests where id = p_id for update;
  if not found then raise exception 'Leave request not found'; end if;
  if lr.status <> 'pending' then raise exception 'This request was already decided'; end if;
  if not (private.manages_gym(lr.gym_id) and private.has_perm('can_approve_leave')) then raise exception 'Not allowed'; end if;
  update public.leave_requests
    set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = p_id;
end $$;

create function public.cancel_leave(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.leave_requests set status = 'cancelled'
    where id = p_id and status = 'pending' and employee_id = private.own_employee_id();
  if not found then raise exception 'Only your own pending requests can be cancelled'; end if;
end $$;

create function public.generate_payroll(p_gym uuid, p_month date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_m date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_today date := private.local_today();
  v_eff_end date := least((date_trunc('month', p_month) + interval '1 month - 1 day')::date, private.local_today());
  s public.gym_settings%rowtype;
  v_run uuid; v_run_status text;
  e record; v_d date; v_sh public.shifts%rowtype; v_att public.attendance%rowtype;
  v_has_att boolean; v_sh_hours numeric; v_worked numeric;
  v_sal_end numeric; v_sal_d numeric; v_first_sal numeric; v_div numeric; v_daily numeric; v_last_daily numeric;
  v_ded numeric; v_abs numeric; v_late int; v_unmarked int; v_missing int; v_present numeric; v_paid numeric; v_unpaid numeric;
  v_ot_h numeric; v_ot_amt numeric; v_inc numeric; v_rec numeric; v_net numeric; v_extra numeric;
  v_off boolean; v_hol boolean;
begin
  if not (private.manages_gym(p_gym) and private.has_perm('can_approve_payroll')) then raise exception 'Not allowed'; end if;
  select * into s from public.gym_settings where gym_id = p_gym;
  select id, status into v_run, v_run_status from public.payroll_runs where gym_id = p_gym and month = v_m;
  if v_run is not null and v_run_status <> 'draft' then raise exception 'Payroll for this month is already approved'; end if;

  if v_run is null then
    insert into public.payroll_runs (gym_id, month, deduction_method, salary_divisor, overtime_enabled, overtime_rate, late_marks_per_half_day, generated_by)
    values (p_gym, v_m, s.deduction_method, s.salary_divisor, s.overtime_enabled, s.overtime_rate, s.late_marks_per_half_day, auth.uid())
    returning id into v_run;
  else
    update public.payroll_runs set deduction_method = s.deduction_method, salary_divisor = s.salary_divisor,
      overtime_enabled = s.overtime_enabled, overtime_rate = s.overtime_rate, late_marks_per_half_day = s.late_marks_per_half_day,
      generated_by = auth.uid(), generated_at = now() where id = v_run;
    delete from public.payroll_items where run_id = v_run;
  end if;

  for e in
    select emp.* from public.employees emp
    where emp.gym_id = p_gym and emp.joining_date <= v_end
      and (emp.is_active or exists (select 1 from public.attendance a where a.employee_id = emp.id and a.work_date between v_m and v_end))
  loop
    v_ded := 0; v_abs := 0; v_late := 0; v_unmarked := 0; v_missing := 0; v_present := 0; v_paid := 0; v_unpaid := 0; v_ot_h := 0;
    v_sh_hours := null;
    if e.shift_id is not null then
      select * into v_sh from public.shifts where id = e.shift_id;
      if found then
        v_sh_hours := extract(epoch from (v_sh.end_time - v_sh.start_time)) / 3600;
        if v_sh_hours <= 0 then v_sh_hours := v_sh_hours + 24; end if;
      end if;
    end if;

    select monthly_salary into v_sal_end from public.employee_salaries
      where employee_id = e.id and effective_from <= v_end order by effective_from desc limit 1;
    select monthly_salary into v_first_sal from public.employee_salaries
      where employee_id = e.id order by effective_from asc limit 1;
    v_sal_end := coalesce(v_sal_end, 0);

    if s.salary_divisor = 'fixed_30' then v_div := 30;
    elsif s.salary_divisor = 'calendar_days' then v_div := extract(day from v_end);
    else
      select count(*) into v_div from generate_series(v_m::timestamp, v_end::timestamp, interval '1 day') g
      where extract(dow from g)::int <> e.weekly_off
        and not exists (select 1 from public.gym_holidays h where h.gym_id = p_gym and h.holiday_date = g::date);
    end if;
    v_div := greatest(v_div, 1);
    v_last_daily := 0;

    for v_d in select g::date from generate_series(v_m::timestamp, v_end::timestamp, interval '1 day') g loop
      select monthly_salary into v_sal_d from public.employee_salaries
        where employee_id = e.id and effective_from <= v_d order by effective_from desc limit 1;
      v_daily := coalesce(v_sal_d, v_first_sal, 0) / v_div;
      v_last_daily := v_daily;

      if v_d < e.joining_date then v_ded := v_ded + v_daily; continue; end if;
      if v_d > v_eff_end then continue; end if;

      v_off := extract(dow from v_d)::int = e.weekly_off;
      v_hol := exists (select 1 from public.gym_holidays h where h.gym_id = p_gym and h.holiday_date = v_d);
      select * into v_att from public.attendance a where a.employee_id = e.id and a.work_date = v_d;
      v_has_att := found;

      if v_has_att then
        v_worked := null;
        if v_att.check_in is not null and v_att.check_out is not null then
          v_worked := extract(epoch from (v_att.check_out - v_att.check_in)) / 3600;
        end if;
        if v_att.status in ('present', 'late') then
          v_present := v_present + 1;
          if v_att.status = 'late' then v_late := v_late + 1; end if;
          if v_att.check_in is not null and v_att.check_out is null and v_d < v_today then v_missing := v_missing + 1; end if;
          if v_worked is not null and v_sh_hours is not null then
            if s.deduction_method = 'hourly' and v_worked < v_sh_hours then
              v_ded := v_ded + v_daily * (v_sh_hours - v_worked) / v_sh_hours;
            end if;
            if s.overtime_enabled and v_worked > v_sh_hours then
              v_ot_h := v_ot_h + (v_worked - v_sh_hours);
            end if;
          end if;
        elsif v_att.status = 'half_day' then
          v_present := v_present + 0.5; v_abs := v_abs + 0.5; v_ded := v_ded + v_daily * 0.5;
        elsif v_att.status = 'absent' then
          v_abs := v_abs + 1; v_ded := v_ded + v_daily;
        elsif v_att.status = 'unpaid_leave' then
          v_unpaid := v_unpaid + 1; v_abs := v_abs + 1; v_ded := v_ded + v_daily;
        elsif v_att.status = 'paid_leave' then
          v_paid := v_paid + 1;
        end if;
      elsif not v_off and not v_hol then
        v_unmarked := v_unmarked + 1; v_abs := v_abs + 1; v_ded := v_ded + v_daily;
      end if;
    end loop;

    if s.late_marks_per_half_day is not null then
      v_extra := floor(v_late::numeric / s.late_marks_per_half_day) * 0.5;
      v_ded := v_ded + v_extra * v_last_daily; v_abs := v_abs + v_extra;
    end if;
    v_ded := round(least(v_ded, v_sal_end), 2);
    v_ot_amt := round(v_ot_h * s.overtime_rate, 2);
    select coalesce(sum(amount), 0) into v_inc from public.incentives where employee_id = e.id and month = v_m;
    select coalesce(sum(least(a.monthly_recovery,
             a.amount - coalesce((select sum(r.amount) from public.advance_recoveries r where r.advance_id = a.id), 0))), 0)
      into v_rec from public.advances a where a.employee_id = e.id and a.status = 'open';
    v_rec := greatest(0, least(v_rec, v_sal_end - v_ded + v_ot_amt + v_inc));
    v_net := round(v_sal_end - v_ded + v_ot_amt + v_inc - v_rec, 2);

    insert into public.payroll_items (run_id, gym_id, employee_id, monthly_salary, divisor, present_days, late_count, absent_units,
      unpaid_leave_days, paid_leave_days, deduction_amount, overtime_hours, overtime_amount, incentive_amount, advance_recovery, net_salary, flags)
    values (v_run, p_gym, e.id, v_sal_end, v_div, v_present, v_late, v_abs, v_unpaid, v_paid, v_ded, round(v_ot_h, 2), v_ot_amt, v_inc, v_rec, v_net,
      jsonb_build_object('unmarked_days', v_unmarked, 'missing_checkouts', v_missing, 'no_salary', v_sal_end = 0));
  end loop;
  return v_run;
end $$;

create function public.approve_payroll(p_run uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.payroll_runs%rowtype; i record; a record; v_rem numeric; v_bal numeric; v_take numeric;
begin
  select * into r from public.payroll_runs where id = p_run for update;
  if not found then raise exception 'Payroll run not found'; end if;
  if not (private.manages_gym(r.gym_id) and private.has_perm('can_approve_payroll')) then raise exception 'Not allowed'; end if;
  if r.status <> 'draft' then raise exception 'This payroll is already approved'; end if;
  if not exists (select 1 from public.payroll_items where run_id = p_run) then raise exception 'There is nothing to approve'; end if;

  for i in select * from public.payroll_items where run_id = p_run and advance_recovery > 0 loop
    v_rem := i.advance_recovery;
    for a in select * from public.advances where employee_id = i.employee_id and status = 'open' order by issued_on, created_at loop
      exit when v_rem <= 0;
      v_bal := a.amount - coalesce((select sum(x.amount) from public.advance_recoveries x where x.advance_id = a.id), 0);
      v_take := least(v_rem, v_bal, a.monthly_recovery);
      if v_take > 0 then
        insert into public.advance_recoveries (advance_id, payroll_item_id, amount) values (a.id, i.id, v_take);
        v_rem := v_rem - v_take;
      end if;
      if v_bal - v_take <= 0 then update public.advances set status = 'closed' where id = a.id; end if;
    end loop;
  end loop;

  update public.payroll_runs set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_run;
end $$;

create function public.record_payment(p_item uuid, p_amount numeric, p_paid_on date, p_method text, p_ref text) returns void
language plpgsql security definer set search_path = '' as $$
declare i public.payroll_items%rowtype; r public.payroll_runs%rowtype; v_final numeric; v_paid numeric;
begin
  select * into i from public.payroll_items where id = p_item;
  if not found then raise exception 'Payslip not found'; end if;
  select * into r from public.payroll_runs where id = i.run_id for update;
  if not (private.manages_gym(r.gym_id) and private.has_perm('can_approve_payroll')) then raise exception 'Not allowed'; end if;
  if r.status not in ('approved', 'paid') then raise exception 'Approve the payroll before recording payments'; end if;
  if p_method not in ('bank', 'upi', 'cash') then raise exception 'Choose bank, UPI or cash'; end if;
  v_final := private.item_final(p_item);
  select coalesce(sum(amount), 0) into v_paid from public.payroll_payments where item_id = p_item;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount'; end if;
  if v_paid + p_amount > v_final then
    raise exception 'That is more than is due. Outstanding: %', (v_final - v_paid);
  end if;
  insert into public.payroll_payments (item_id, gym_id, employee_id, amount, paid_on, method, reference, created_by)
  values (p_item, r.gym_id, i.employee_id, p_amount, p_paid_on, p_method, nullif(trim(p_ref), ''), auth.uid());

  if exists (
    select 1 from public.payroll_items it
    where it.run_id = r.id
      and private.item_final(it.id) > coalesce((select sum(p.amount) from public.payroll_payments p where p.item_id = it.id), 0)
  ) then
    update public.payroll_runs set status = 'approved' where id = r.id;
  else
    update public.payroll_runs set status = 'paid' where id = r.id;
  end if;
end $$;

-- only signed-in users may call these; each function checks the caller's role itself
revoke all on function public.rotate_gym_qr(uuid), public.qr_check_in(text, text),
  public.approve_leave(uuid, text, text), public.reject_leave(uuid, text), public.cancel_leave(uuid),
  public.generate_payroll(uuid, date), public.approve_payroll(uuid),
  public.record_payment(uuid, numeric, date, text, text) from public, anon;
grant execute on function public.rotate_gym_qr(uuid), public.qr_check_in(text, text),
  public.approve_leave(uuid, text, text), public.reject_leave(uuid, text), public.cancel_leave(uuid),
  public.generate_payroll(uuid, date), public.approve_payroll(uuid),
  public.record_payment(uuid, numeric, date, text, text) to authenticated;

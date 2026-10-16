import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { addAdjustment, approvePayroll, payItem, recalculatePayroll } from "../actions";
import { inr, monthLabel, todayIST } from "@/lib/date";

type Item = {
  id: string; employee_id: string; monthly_salary: number; present_days: number; late_count: number; absent_units: number;
  unpaid_leave_days: number; paid_leave_days: number; deduction_amount: number; overtime_hours: number; overtime_amount: number;
  incentive_amount: number; advance_recovery: number; net_salary: number; flags: { unmarked_days: number; missing_checkouts: number; no_salary: boolean };
  adj_earning: number; adj_deduction: number; final_net: number; paid_amount: number;
};

export default async function PayrollRun({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { supabase, perms } = await requireRole(["admin", "gym_manager"]);
  if (!perms.can_approve_payroll && !perms.can_view_salaries) redirect("/dashboard");
  const { id } = await params;
  const { error } = await searchParams;
  const { data: run } = await supabase.from("payroll_runs").select("*, gyms(name)").eq("id", id).maybeSingle();
  if (!run) notFound();
  const { data: items } = await supabase.from("payroll_item_view").select("*").eq("run_id", id);
  const { data: emps } = await supabase.from("employees").select("id, full_name, employee_code").eq("gym_id", run.gym_id);
  const name = new Map(emps?.map((e) => [e.id, `${e.full_name} (${e.employee_code})`]));
  const rows = ((items ?? []) as unknown as Item[]).sort((a, b) => (name.get(a.employee_id) ?? "").localeCompare(name.get(b.employee_id) ?? ""));
  const draft = run.status === "draft";
  const canAct = perms.can_approve_payroll;
  const total = rows.reduce((s, r) => s + Number(r.final_net), 0);
  const paid = rows.reduce((s, r) => s + Number(r.paid_amount), 0);
  const warn = rows.reduce((s, r) => s + r.flags.unmarked_days + r.flags.missing_checkouts + (r.flags.no_salary ? 1 : 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/payroll" className="text-xs text-zinc-500 underline">All payroll</Link>
          <h1 className="text-lg font-semibold">{monthLabel(run.month)} · {(run.gyms as unknown as { name: string }).name}</h1>
          <p className="text-xs capitalize text-zinc-500">
            {run.status} · cut {run.deduction_method} · salary ÷ {run.salary_divisor.replace("_", " ")}
            {run.late_marks_per_half_day ? ` · ${run.late_marks_per_half_day} lates = half day` : ""}{run.overtime_enabled ? ` · overtime ₹${run.overtime_rate}/hr` : ""}
          </p>
        </div>
        {canAct && draft && (
          <div className="flex gap-2">
            <form action={recalculatePayroll}><input type="hidden" name="id" value={id} /><button className="btn-ghost">Recalculate</button></form>
            <form action={approvePayroll}><input type="hidden" name="id" value={id} /><button className="btn">Approve & lock</button></form>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {draft && warn > 0 && (
        <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          Check the ⚠ items below before approving. Days nobody marked are counted as absent. Fix attendance, then press Recalculate.
        </p>
      )}
      {!draft && <p className="text-sm text-zinc-500">Approved and locked. Attendance for this month can no longer be changed. Use adjustments for corrections.</p>}
      <div className="grid grid-cols-3 gap-3">
        <div className="card"><p className="text-xs text-zinc-500">Total payable</p><p className="text-lg font-semibold">{inr(total)}</p></div>
        <div className="card"><p className="text-xs text-zinc-500">Paid</p><p className="text-lg font-semibold">{inr(paid)}</p></div>
        <div className="card"><p className="text-xs text-zinc-500">Outstanding</p><p className="text-lg font-semibold">{inr(total - paid)}</p></div>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((r) => {
          const due = Number(r.final_net) - Number(r.paid_amount);
          return (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{name.get(r.employee_id)}</p>
                  <p className="text-xs text-zinc-500">
                    Present {r.present_days} · absent/leave-cut {r.absent_units} · late {r.late_count} · paid leave {r.paid_leave_days}
                  </p>
                  {r.flags.unmarked_days > 0 && <p className="text-xs text-amber-700">⚠ {r.flags.unmarked_days} unmarked day(s) counted as absent</p>}
                  {r.flags.missing_checkouts > 0 && <p className="text-xs text-amber-700">⚠ {r.flags.missing_checkouts} missing check-out(s)</p>}
                  {r.flags.no_salary && <p className="text-xs text-red-600">⚠ No salary set for this employee</p>}
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{inr(r.final_net)}</p>
                  <p className="text-xs text-zinc-500">paid {inr(r.paid_amount)}</p>
                  {!draft && <a href={`/payroll/slip/${r.id}`} className="text-xs text-emerald-700 underline">Salary slip PDF</a>}
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-6">
                <div><dt className="text-zinc-500">Salary</dt><dd>{inr(r.monthly_salary)}</dd></div>
                <div><dt className="text-zinc-500">Attendance cut</dt><dd>−{inr(r.deduction_amount)}</dd></div>
                <div><dt className="text-zinc-500">Overtime</dt><dd>+{inr(r.overtime_amount)}</dd></div>
                <div><dt className="text-zinc-500">Bonus</dt><dd>+{inr(r.incentive_amount)}</dd></div>
                <div><dt className="text-zinc-500">Advance</dt><dd>−{inr(r.advance_recovery)}</dd></div>
                <div><dt className="text-zinc-500">Adjustments</dt><dd>{inr(Number(r.adj_earning) - Number(r.adj_deduction))}</dd></div>
              </dl>
              {canAct && (
                <div className="mt-3 flex flex-wrap gap-4">
                  {!draft && due > 0 && (
                    <form action={payItem} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="run_id" value={id} /><input type="hidden" name="item_id" value={r.id} />
                      <div><label className="label">Pay now</label><input name="amount" type="number" step="0.01" min="0.01" max={due} defaultValue={due} className="input w-28" /></div>
                      <div><label className="label">Date</label><input name="paid_on" type="date" defaultValue={todayIST()} className="input" /></div>
                      <div><label className="label">Method</label><select name="method" className="input"><option value="bank">Bank</option><option value="upi">UPI</option><option value="cash">Cash</option></select></div>
                      <div><label className="label">Reference</label><input name="reference" className="input w-32" /></div>
                      <button className="btn">Record payment</button>
                    </form>
                  )}
                  <details>
                    <summary className="cursor-pointer text-xs text-emerald-700 underline">Add adjustment</summary>
                    <form action={addAdjustment} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="run_id" value={id} /><input type="hidden" name="employee_id" value={r.employee_id} />
                      <div><label className="label">Type</label><select name="kind" className="input"><option value="earning">Add</option><option value="deduction">Deduct</option></select></div>
                      <div><label className="label">Amount</label><input name="amount" type="number" step="0.01" min="0.01" required className="input w-28" /></div>
                      <div><label className="label">Reason</label><input name="reason" required className="input w-48" /></div>
                      <button className="btn-ghost">Save</button>
                    </form>
                  </details>
                </div>
              )}
            </div>
          );
        })}
        {!rows.length && <p className="text-sm text-zinc-500">No employees in this payroll.</p>}
      </div>
    </div>
  );
}

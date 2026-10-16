import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { saveGymSettings } from "../../actions";

export default async function GymSettings({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { supabase, perms } = await requireRole(["admin", "gym_manager"]);
  const { id } = await params;
  const { error, saved } = await searchParams;
  const { data: gym } = await supabase.from("gyms").select("id, name").eq("id", id).maybeSingle();
  const { data: s } = await supabase.from("gym_settings").select("*").eq("gym_id", id).maybeSingle();
  if (!gym || !s) notFound();
  const canEdit = perms.can_configure_salary;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Salary rules · {gym.name}</h1>
      <form action={saveGymSettings} className="card grid max-w-xl gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={gym.id} />
        <fieldset disabled={!canEdit} className="contents">
          <div>
            <label className="label">Salary cut method</label>
            <select name="deduction_method" defaultValue={s.deduction_method} className="input">
              <option value="daily">Daily</option><option value="shift">Per shift</option><option value="hourly">Hourly</option>
            </select>
          </div>
          <div>
            <label className="label">Monthly salary divided by</label>
            <select name="salary_divisor" defaultValue={s.salary_divisor} className="input">
              <option value="fixed_30">Fixed 30 days</option><option value="calendar_days">Days in the month</option><option value="working_days">Working days</option>
            </select>
          </div>
          <div>
            <label className="label">Late marks that count as a half day (blank = off)</label>
            <input name="late_marks_per_half_day" type="number" min={1} defaultValue={s.late_marks_per_half_day ?? ""} className="input" />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="overtime_enabled" defaultChecked={s.overtime_enabled} /> Pay overtime</label>
          </div>
          <div>
            <label className="label">Overtime rate (₹ per hour)</label>
            <input name="overtime_rate" type="number" min={0} step="0.01" defaultValue={s.overtime_rate} className="input" />
          </div>
        </fieldset>
        {saved && <p className="text-sm text-emerald-700 sm:col-span-2">Saved.</p>}
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        {canEdit ? <div className="sm:col-span-2"><button className="btn">Save rules</button></div>
          : <p className="text-sm text-zinc-500 sm:col-span-2">You can view these rules. Ask the admin for permission to change them.</p>}
      </form>
      <p className="max-w-xl text-xs text-zinc-500">Deduction = monthly salary ÷ divisor × units missed (days, shifts or hours). Payroll uses these rules in a later step. Overtime is off unless switched on here.</p>
    </div>
  );
}

import Link from "next/link";
import { getSession } from "@/lib/session";
import { markAttendance } from "./actions";
import { monthIST, timeIST, todayIST } from "@/lib/date";

const STATUS = ["present", "late", "half_day", "absent", "paid_leave", "unpaid_leave", "weekly_off", "holiday"];
const label = (s: string) => s.replace("_", " ");

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ gym?: string; date?: string; error?: string }> }) {
  const { supabase, profile, user, perms } = await getSession();
  const sp = await searchParams;

  if (profile.role === "staff") {
    const month = monthIST();
    const { data: rows } = await supabase.from("attendance").select("work_date, status, check_in, check_out, source")
      .gte("work_date", month + "-01").lte("work_date", month + "-31").order("work_date", { ascending: false });
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">My attendance</h1>
        <div className="card text-sm">
          To check in or out, scan the QR code on the gym screen with your phone camera. Use the same phone every time.
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead><tr><th className="th">Date</th><th className="th">Status</th><th className="th">In</th><th className="th">Out</th></tr></thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows?.map((r) => (
                <tr key={r.work_date}><td className="td">{r.work_date}</td><td className="td capitalize">{label(r.status)}</td><td className="td">{timeIST(r.check_in)}</td><td className="td">{timeIST(r.check_out)}</td></tr>
              ))}
              {!rows?.length && <tr><td className="td text-zinc-500" colSpan={4}>Nothing recorded this month.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const { data: gyms } = await supabase.from("gyms").select("id, name").eq("is_active", true).order("name");
  const gymId = sp.gym ?? gyms?.[0]?.id;
  const date = sp.date ?? todayIST();
  const { data: emps } = gymId
    ? await supabase.from("employees").select("id, employee_code, full_name, shifts(name)").eq("gym_id", gymId).eq("is_active", true).order("employee_code")
    : { data: [] };
  const { data: recs } = gymId
    ? await supabase.from("attendance").select("*").eq("gym_id", gymId).eq("work_date", date)
    : { data: [] };
  const byEmp = new Map(recs?.map((r) => [r.employee_id, r]));
  const hhmm = (ts: string | null) => (ts ? new Date(new Date(ts).getTime() + 5.5 * 3600 * 1000).toISOString().slice(11, 16) : "");
  void user;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Attendance</h1>
        <div className="flex gap-2">
          {gymId && <Link href={`/attendance/register?gym=${gymId}`} className="btn-ghost">Monthly register</Link>}
          {gymId && perms.can_edit_attendance && <Link href={`/attendance/qr?gym=${gymId}`} className="btn">Show QR code</Link>}
        </div>
      </div>
      <form className="flex flex-wrap items-end gap-3">
        <div><label className="label">Gym</label>
          <select name="gym" defaultValue={gymId} className="input">{gyms?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div><label className="label">Date</label><input name="date" type="date" defaultValue={date} className="input" /></div>
        <button className="btn-ghost">Show</button>
      </form>
      {sp.error && <p className="text-sm text-red-600">{sp.error}</p>}
      <div className="flex flex-col gap-2">
        {emps?.map((e) => {
          const r = byEmp.get(e.id);
          const shift = (e.shifts as unknown as { name: string } | null)?.name;
          return (
            <form key={e.id} action={markAttendance} className="card grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_1fr_auto] sm:items-end">
              <input type="hidden" name="employee_id" value={e.id} /><input type="hidden" name="gym_id" value={gymId} /><input type="hidden" name="date" value={date} />
              <div>
                <p className="text-sm font-medium">{e.full_name} <span className="text-xs text-zinc-500">{e.employee_code}{shift ? ` · ${shift}` : ""}</span></p>
                <p className="text-xs text-zinc-500">{r ? `${label(r.status)} · in ${timeIST(r.check_in)} · out ${timeIST(r.check_out)} · ${r.source}` : "Not marked yet"}</p>
              </div>
              <div><label className="label">Status</label>
                <select name="status" defaultValue={r?.status ?? "present"} disabled={!perms.can_edit_attendance} className="input">{STATUS.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
              <div><label className="label">In</label><input name="in_time" type="time" defaultValue={hhmm(r?.check_in ?? null)} disabled={!perms.can_edit_attendance} className="input" /></div>
              <div><label className="label">Out</label><input name="out_time" type="time" defaultValue={hhmm(r?.check_out ?? null)} disabled={!perms.can_edit_attendance} className="input" /></div>
              <div><label className="label">Reason / note</label><input name="note" required defaultValue={r?.source === "manual" ? r.note ?? "" : ""} disabled={!perms.can_edit_attendance} className="input" /></div>
              {perms.can_edit_attendance && <button className="btn">Save</button>}
            </form>
          );
        })}
        {!emps?.length && <p className="text-sm text-zinc-500">No active employees in this gym.</p>}
      </div>
    </div>
  );
}

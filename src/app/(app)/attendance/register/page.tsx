import Link from "next/link";
import { requireRole } from "@/lib/session";
import { daysInMonth, monthIST } from "@/lib/date";

const CODE: Record<string, [string, string]> = {
  present: ["P", "text-emerald-700"], late: ["L", "text-amber-600"], half_day: ["½", "text-amber-600"], absent: ["A", "text-red-600"],
  paid_leave: ["PL", "text-sky-600"], unpaid_leave: ["UL", "text-red-600"], weekly_off: ["WO", "text-zinc-400"], holiday: ["H", "text-zinc-400"],
};

export default async function Register({ searchParams }: { searchParams: Promise<{ gym?: string; month?: string }> }) {
  const { supabase } = await requireRole(["admin", "gym_manager"]);
  const sp = await searchParams;
  const { data: gyms } = await supabase.from("gyms").select("id, name").order("name");
  const gymId = sp.gym ?? gyms?.[0]?.id;
  const month = sp.month ?? monthIST();
  const n = daysInMonth(month);
  const { data: emps } = gymId ? await supabase.from("employees").select("id, employee_code, full_name, weekly_off").eq("gym_id", gymId).order("employee_code") : { data: [] };
  const { data: recs } = gymId
    ? await supabase.from("attendance").select("employee_id, work_date, status").eq("gym_id", gymId).gte("work_date", `${month}-01`).lte("work_date", `${month}-${n}`)
    : { data: [] };
  const map = new Map(recs?.map((r) => [r.employee_id + r.work_date, r.status]));
  const days = Array.from({ length: n }, (_, i) => i + 1);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between"><h1 className="text-lg font-semibold">Monthly register</h1><Link href={`/attendance?gym=${gymId}`} className="btn-ghost">Back</Link></div>
      <form className="flex flex-wrap items-end gap-3">
        <div><label className="label">Gym</label>
          <select name="gym" defaultValue={gymId} className="input">{gyms?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div><label className="label">Month</label><input name="month" type="month" defaultValue={month} className="input" /></div>
        <button className="btn-ghost">Show</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-center text-xs">
          <thead><tr><th className="th">Employee</th>{days.map((d) => <th key={d} className="px-1 py-2 font-medium text-zinc-500">{d}</th>)}</tr></thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {emps?.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-3 py-2 text-left text-sm">{e.full_name}</td>
                {days.map((d) => {
                  const date = `${month}-${String(d).padStart(2, "0")}`;
                  const s = map.get(e.id + date);
                  const off = new Date(date + "T00:00:00Z").getUTCDay() === e.weekly_off;
                  const c = s ? CODE[s] : off ? CODE.weekly_off : null;
                  return <td key={d} className={`px-1 py-2 font-medium ${c?.[1] ?? "text-zinc-300"}`}>{c?.[0] ?? "·"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">P present · L late · ½ half day · A absent · PL paid leave · UL unpaid leave · WO weekly off · H holiday · · not marked</p>
    </div>
  );
}

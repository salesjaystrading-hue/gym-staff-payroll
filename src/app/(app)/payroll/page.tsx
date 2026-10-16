import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { generatePayroll } from "./actions";
import { monthIST, monthLabel } from "@/lib/date";

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, perms } = await requireRole(["admin", "gym_manager"]);
  if (!perms.can_approve_payroll && !perms.can_view_salaries) redirect("/dashboard");
  const { error } = await searchParams;
  const { data: gyms } = await supabase.from("gyms").select("id, name").eq("is_active", true).order("name");
  const { data: runs } = await supabase.from("payroll_runs").select("id, month, status, gyms(name)").order("month", { ascending: false }).limit(36);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Payroll</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {perms.can_approve_payroll && (
        <form action={generatePayroll} className="card flex flex-wrap items-end gap-3">
          <div><label className="label">Gym</label><select name="gym_id" className="input">{gyms?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
          <div><label className="label">Month</label><input name="month" type="month" defaultValue={monthIST()} required className="input" /></div>
          <button className="btn">Create / open payroll</button>
        </form>
      )}
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr><th className="th">Month</th><th className="th">Gym</th><th className="th">Status</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {runs?.map((r) => (
              <tr key={r.id}>
                <td className="td">{monthLabel(r.month)}</td>
                <td className="td">{(r.gyms as unknown as { name: string } | null)?.name}</td>
                <td className="td capitalize">{r.status}</td>
                <td className="td text-right"><Link href={`/payroll/${r.id}`} className="btn-ghost">Open</Link></td>
              </tr>
            ))}
            {!runs?.length && <tr><td className="td text-zinc-500" colSpan={4}>No payroll yet. Choose a gym and month above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

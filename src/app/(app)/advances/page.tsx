import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { addAdvance, addIncentive } from "./actions";
import { inr, monthIST, monthLabel, todayIST } from "@/lib/date";

export default async function AdvancesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, perms } = await requireRole(["admin", "gym_manager"]);
  if (!perms.can_configure_salary && !perms.can_approve_payroll) redirect("/dashboard");
  const { error } = await searchParams;
  const { data: emps } = await supabase.from("employees").select("id, full_name, employee_code").eq("is_active", true).order("employee_code");
  const name = new Map(emps?.map((e) => [e.id, e.full_name]));
  const { data: adv } = await supabase.from("advances").select("id, employee_id, amount, monthly_recovery, issued_on, status, note").order("issued_on", { ascending: false }).limit(50);
  const { data: rec } = await supabase.from("advance_recoveries").select("advance_id, amount");
  const recovered = new Map<string, number>();
  rec?.forEach((r) => recovered.set(r.advance_id, (recovered.get(r.advance_id) ?? 0) + Number(r.amount)));
  const { data: inc } = await supabase.from("incentives").select("id, employee_id, month, kind, amount, note").order("month", { ascending: false }).limit(50);
  const canEdit = perms.can_configure_salary;
  const opts = emps?.map((e) => <option key={e.id} value={e.id}>{e.employee_code} · {e.full_name}</option>);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Advances & bonus</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Salary advances</h2>
        {canEdit && (
          <form action={addAdvance} className="card grid max-w-xl gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Employee</label><select name="employee_id" required className="input" defaultValue="">{<option value="" disabled>Select</option>}{opts}</select></div>
            <div><label className="label">Amount (₹)</label><input name="amount" type="number" min="1" step="0.01" required className="input" /></div>
            <div><label className="label">Recover per month (₹)</label><input name="monthly_recovery" type="number" min="1" step="0.01" required className="input" /></div>
            <div><label className="label">Given on</label><input name="issued_on" type="date" defaultValue={todayIST()} required className="input" /></div>
            <div><label className="label">Note</label><input name="note" className="input" /></div>
            <div className="sm:col-span-2"><button className="btn">Record advance</button></div>
          </form>
        )}
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead><tr><th className="th">Employee</th><th className="th">Given</th><th className="th">Amount</th><th className="th">Recovered</th><th className="th">Balance</th></tr></thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {adv?.map((a) => {
                const got = recovered.get(a.id) ?? 0;
                return <tr key={a.id}><td className="td">{name.get(a.employee_id)}</td><td className="td">{a.issued_on}</td><td className="td">{inr(a.amount)}</td><td className="td">{inr(got)}</td><td className="td">{inr(Number(a.amount) - got)}{a.status === "closed" && " ✓"}</td></tr>;
              })}
              {!adv?.length && <tr><td className="td text-zinc-500" colSpan={5}>No advances.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">The monthly amount is deducted automatically when payroll is approved, and never twice.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Bonus / incentive</h2>
        {canEdit && (
          <form action={addIncentive} className="card grid max-w-xl gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Employee</label><select name="employee_id" required className="input" defaultValue="">{<option value="" disabled>Select</option>}{opts}</select></div>
            <div><label className="label">Added to salary of</label><input name="month" type="month" defaultValue={monthIST()} required className="input" /></div>
            <div><label className="label">Amount (₹)</label><input name="amount" type="number" min="1" step="0.01" required className="input" /></div>
            <div><label className="label">Kind</label><input name="kind" placeholder="Bonus, PT commission…" className="input" /></div>
            <div><label className="label">Note</label><input name="note" className="input" /></div>
            <div className="sm:col-span-2"><button className="btn">Add</button></div>
          </form>
        )}
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead><tr><th className="th">Employee</th><th className="th">Month</th><th className="th">Kind</th><th className="th">Amount</th></tr></thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {inc?.map((i) => <tr key={i.id}><td className="td">{name.get(i.employee_id)}</td><td className="td">{monthLabel(i.month)}</td><td className="td">{i.kind}</td><td className="td">{inr(i.amount)}</td></tr>)}
              {!inc?.length && <tr><td className="td text-zinc-500" colSpan={4}>None yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

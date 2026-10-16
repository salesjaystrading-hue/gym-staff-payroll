import { getSession } from "@/lib/session";
import { cancelLeave, decideLeave, requestLeave } from "./actions";
import { monthIST, todayIST } from "@/lib/date";

type Row = {
  id: string; from_date: string; to_date: string; reason: string | null; status: string; approved_type: string | null;
  decision_note: string | null; employee_id: string; gym_id: string; employees?: { full_name: string } | null;
};
const badge = (s: string) => ({ pending: "text-amber-600", approved: "text-emerald-700", rejected: "text-red-600", cancelled: "text-zinc-500" } as Record<string, string>)[s];

export default async function LeavePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { supabase, profile, perms } = await getSession();
  const { error, saved } = await searchParams;
  const { data } = await supabase.from("leave_requests")
    .select("id, from_date, to_date, reason, status, approved_type, decision_note, employee_id, gym_id, employees(full_name)")
    .order("created_at", { ascending: false }).limit(60);
  const rows = (data ?? []) as unknown as Row[];

  if (profile.role === "staff") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">Leave</h1>
        {saved && <p className="text-sm text-emerald-700">Request sent to your manager.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <form action={requestLeave} className="card grid max-w-xl gap-3 sm:grid-cols-2">
          <div><label className="label">From</label><input name="from_date" type="date" min={todayIST()} required className="input" /></div>
          <div><label className="label">To (same day if blank)</label><input name="to_date" type="date" min={todayIST()} className="input" /></div>
          <div className="sm:col-span-2"><label className="label">Reason</label><input name="reason" className="input" /></div>
          <div className="sm:col-span-2"><button className="btn">Request leave</button></div>
        </form>
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead><tr><th className="th">Dates</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td">{r.from_date}{r.to_date !== r.from_date && ` → ${r.to_date}`}<div className="text-xs text-zinc-500">{r.reason}</div></td>
                  <td className={`td capitalize ${badge(r.status)}`}>{r.status}{r.approved_type && ` (${r.approved_type})`}<div className="text-xs text-zinc-500">{r.decision_note}</div></td>
                  <td className="td">{r.status === "pending" && (
                    <form action={cancelLeave}><input type="hidden" name="id" value={r.id} /><button className="btn-ghost">Cancel</button></form>)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td className="td text-zinc-500" colSpan={3}>No requests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // manager / admin
  const month = monthIST();
  const pending = rows.filter((r) => r.status === "pending");
  const { data: used } = await supabase.from("attendance").select("employee_id").eq("status", "paid_leave")
    .gte("work_date", `${month}-01`).lte("work_date", `${month}-31`);
  const usedBy = new Map<string, number>();
  used?.forEach((u) => usedBy.set(u.employee_id, (usedBy.get(u.employee_id) ?? 0) + 1));
  const { data: settings } = await supabase.from("gym_settings").select("gym_id, paid_leaves_per_month");
  const allowance = new Map(settings?.map((s) => [s.gym_id, Number(s.paid_leaves_per_month)]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Leave requests</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-2">
        {pending.map((r) => {
          const left = (allowance.get(r.gym_id) ?? 0) - (usedBy.get(r.employee_id) ?? 0);
          return (
            <form key={r.id} action={decideLeave} className="card grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
              <input type="hidden" name="id" value={r.id} />
              <div>
                <p className="text-sm font-medium">{r.employees?.full_name}</p>
                <p className="text-xs text-zinc-500">{r.from_date}{r.to_date !== r.from_date && ` → ${r.to_date}`} · {r.reason || "no reason given"}</p>
                <p className="text-xs text-zinc-500">Paid leave left this month: {left}</p>
              </div>
              <div><label className="label">Approve as</label>
                <select name="type" defaultValue={left > 0 ? "paid" : "unpaid"} className="input"><option value="paid">Paid</option><option value="unpaid">Unpaid (salary cut)</option></select></div>
              <div><label className="label">Note</label><input name="note" className="input" /></div>
              {perms.can_approve_leave ? (
                <div className="flex gap-2">
                  <button name="decision" value="approve" className="btn">Approve</button>
                  <button name="decision" value="reject" className="btn-ghost">Reject</button>
                </div>
              ) : <p className="text-xs text-zinc-500">No permission to decide</p>}
            </form>
          );
        })}
        {!pending.length && <p className="text-sm text-zinc-500">No pending requests.</p>}
      </div>
      <h2 className="text-sm font-medium">Recent decisions</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.filter((r) => r.status !== "pending").slice(0, 20).map((r) => (
              <tr key={r.id}><td className="td">{r.employees?.full_name}</td><td className="td">{r.from_date}{r.to_date !== r.from_date && ` → ${r.to_date}`}</td>
                <td className={`td capitalize ${badge(r.status)}`}>{r.status}{r.approved_type && ` (${r.approved_type})`}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

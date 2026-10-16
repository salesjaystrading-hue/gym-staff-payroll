import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { inr, monthLabel } from "@/lib/date";

export default async function SalaryPage() {
  const { supabase, profile } = await getSession();
  if (profile.role !== "staff") redirect("/payroll");
  const { data } = await supabase.from("payroll_item_view").select("id, month, final_net, paid_amount, run_status").order("month", { ascending: false });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">My salary</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr><th className="th">Month</th><th className="th">Net</th><th className="th">Paid</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {data?.map((r) => (
              <tr key={r.id}>
                <td className="td">{monthLabel(r.month)}</td><td className="td">{inr(r.final_net)}</td>
                <td className="td">{Number(r.paid_amount) >= Number(r.final_net) ? "Paid" : Number(r.paid_amount) > 0 ? inr(r.paid_amount) : "Pending"}</td>
                <td className="td text-right"><a href={`/payroll/slip/${r.id}`} className="btn-ghost">Slip</a></td>
              </tr>
            ))}
            {!data?.length && <tr><td className="td text-zinc-500" colSpan={4}>Your salary slips appear here after payroll is approved.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

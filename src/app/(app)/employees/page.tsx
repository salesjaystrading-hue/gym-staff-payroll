import Link from "next/link";
import { requireRole } from "@/lib/session";
import { setEmployeeActive } from "./actions";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ gym?: string; inactive?: string }> }) {
  const { supabase, perms } = await requireRole(["admin", "gym_manager"]);
  const { gym, inactive } = await searchParams;
  const { data: gyms } = await supabase.from("gyms").select("id, name").order("name");
  let q = supabase
    .from("employees")
    .select("id, employee_code, full_name, designation, is_active, gym_id, gyms(name)")
    .order("employee_code");
  if (gym) q = q.eq("gym_id", gym);
  if (!inactive) q = q.eq("is_active", true);
  const { data: emps } = await q;

  const salaryOf = new Map<string, number>();
  if (perms.can_view_salaries) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: sal } = await supabase
      .from("employee_salaries").select("employee_id, monthly_salary, effective_from")
      .lte("effective_from", today).order("effective_from", { ascending: false });
    sal?.forEach((s) => { if (!salaryOf.has(s.employee_id)) salaryOf.set(s.employee_id, Number(s.monthly_salary)); });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Employees</h1>
        {perms.can_manage_employees && <Link href="/employees/new" className="btn">Add employee</Link>}
      </div>
      <form className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Gym</label>
          <select name="gym" defaultValue={gym ?? ""} className="input">
            <option value="">All gyms</option>
            {gyms?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="inactive" value="1" defaultChecked={!!inactive} /> Show deactivated</label>
        <button className="btn-ghost">Filter</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr>
            <th className="th">ID</th><th className="th">Name</th><th className="th">Designation</th><th className="th">Gym</th>
            {perms.can_view_salaries && <th className="th">Salary</th>}<th className="th">Status</th><th className="th" />
          </tr></thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {emps?.map((e) => (
              <tr key={e.id}>
                <td className="td">{e.employee_code}</td>
                <td className="td">{e.full_name}</td>
                <td className="td">{e.designation}</td>
                <td className="td">{(e.gyms as unknown as { name: string } | null)?.name}</td>
                {perms.can_view_salaries && <td className="td">{salaryOf.has(e.id) ? inr(salaryOf.get(e.id)!) : "–"}</td>}
                <td className="td">{e.is_active ? "Active" : "Deactivated"}</td>
                <td className="td">
                  {perms.can_manage_employees && (
                    <div className="flex justify-end gap-2">
                      <Link href={`/employees/${e.id}/edit`} className="btn-ghost">Edit</Link>
                      <form action={setEmployeeActive}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="active" value={String(!e.is_active)} />
                        <button className="btn-ghost">{e.is_active ? "Deactivate" : "Activate"}</button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!emps?.length && <tr><td className="td text-zinc-500" colSpan={7}>No employees found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

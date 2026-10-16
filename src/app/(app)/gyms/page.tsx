import Link from "next/link";
import { getSession } from "@/lib/session";
import { setGymActive } from "./actions";

export default async function GymsPage() {
  const { supabase, profile, perms } = await getSession();
  if (profile.role === "staff") return null;
  const { data: gyms } = await supabase.from("gyms").select("id, code, name, address, phone, is_active").order("name");
  const { data: emps } = await supabase.from("employees").select("gym_id").eq("is_active", true);
  const counts = new Map<string, number>();
  emps?.forEach((e) => counts.set(e.gym_id, (counts.get(e.gym_id) ?? 0) + 1));
  const admin = profile.role === "admin";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{admin ? "Gyms" : "My gyms"}</h1>
        {admin && <Link href="/gyms/new" className="btn">Add gym</Link>}
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr><th className="th">Code</th><th className="th">Name</th><th className="th">Staff</th><th className="th">Status</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {gyms?.map((g) => (
              <tr key={g.id}>
                <td className="td">{g.code}</td>
                <td className="td">{g.name}<div className="text-xs text-zinc-500">{g.address}</div></td>
                <td className="td">{counts.get(g.id) ?? 0}</td>
                <td className="td">{g.is_active ? "Active" : "Inactive"}</td>
                <td className="td">
                  <div className="flex justify-end gap-2">
                    <Link href={`/gyms/${g.id}/shifts`} className="btn-ghost">Shifts</Link>
                    {(admin || perms.can_configure_salary) && <Link href={`/gyms/${g.id}/settings`} className="btn-ghost">Salary rules</Link>}
                    {admin && <Link href={`/gyms/${g.id}/edit`} className="btn-ghost">Edit</Link>}
                    {admin && (
                      <form action={setGymActive}>
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="active" value={String(!g.is_active)} />
                        <button className="btn-ghost">{g.is_active ? "Deactivate" : "Activate"}</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!gyms?.length && <tr><td className="td text-zinc-500" colSpan={5}>No gyms yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

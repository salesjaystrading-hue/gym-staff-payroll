import Link from "next/link";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUser, resetPassword, setUserActive } from "./actions";

const ROLE = { admin: "Admin", gym_manager: "Gym manager", staff: "Staff" } as const;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { supabase, user } = await requireRole(["admin"]);
  const { error, saved } = await searchParams;
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, role, is_active").order("created_at");
  const { data: free } = await supabase.from("employees").select("id, employee_code, full_name").is("user_id", null).eq("is_active", true).order("employee_code");
  const { data: list } = await createAdminClient().auth.admin.listUsers({ perPage: 200 });
  const email = new Map(list?.users.map((u) => [u.id, u.email ?? ""]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Users & permissions</h1>
      {saved && <p className="text-sm text-emerald-700">Saved.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Status</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {profiles?.map((p) => (
              <tr key={p.id}>
                <td className="td">{p.full_name}</td>
                <td className="td">{email.get(p.id)}</td>
                <td className="td">{ROLE[p.role as keyof typeof ROLE]}</td>
                <td className="td">{p.is_active ? "Active" : "Inactive"}</td>
                <td className="td">
                  <div className="flex flex-wrap justify-end gap-2">
                    {p.role === "gym_manager" && <Link href={`/users/${p.id}`} className="btn-ghost">Gyms & permissions</Link>}
                    {p.id !== user.id && (
                      <form action={setUserActive}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="active" value={String(!p.is_active)} />
                        <button className="btn-ghost">{p.is_active ? "Deactivate" : "Activate"}</button>
                      </form>
                    )}
                    <form action={resetPassword} className="flex gap-1">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="password" type="password" placeholder="New password" minLength={8} className="input w-36" />
                      <button className="btn-ghost">Set</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={createUser} className="card grid max-w-xl gap-3 sm:grid-cols-2">
        <h2 className="text-sm font-medium sm:col-span-2">Add a login</h2>
        <div><label className="label">Name</label><input name="full_name" required className="input" /></div>
        <div><label className="label">Email</label><input name="email" type="email" required className="input" /></div>
        <div><label className="label">Password (8+ characters)</label><input name="password" type="password" minLength={8} required className="input" /></div>
        <div>
          <label className="label">Role</label>
          <select name="role" className="input" defaultValue="staff">
            <option value="gym_manager">Gym manager</option><option value="staff">Staff</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Link to employee (staff only)</label>
          <select name="employee_id" className="input" defaultValue="">
            <option value="">Not linked</option>
            {free?.map((e) => <option key={e.id} value={e.id}>{e.employee_code} · {e.full_name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2"><button className="btn">Create login</button></div>
      </form>
    </div>
  );
}

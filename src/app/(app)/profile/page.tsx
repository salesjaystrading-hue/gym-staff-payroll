import { getSession } from "@/lib/session";

export default async function ProfilePage() {
  const { supabase, profile, user } = await getSession();
  const { data: emp } = await supabase
    .from("employees")
    .select("employee_code, full_name, phone, designation, joining_date, weekly_off, gyms(name)")
    .eq("user_id", user.id)
    .maybeSingle();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const rows: [string, string][] = [
    ["Name", profile.full_name],
    ["Email", user.email ?? ""],
    ["Gym", (emp?.gyms as unknown as { name: string } | null)?.name ?? "–"],
    ["Employee ID", emp?.employee_code ?? "–"],
    ["Designation", emp?.designation ?? "–"],
    ["Phone", emp?.phone ?? "–"],
    ["Joined", emp?.joining_date ?? "–"],
    ["Weekly off", emp ? days[emp.weekly_off] : "–"],
  ];
  return (
    <div className="card">
      <h1 className="mb-3 text-lg font-semibold">Profile</h1>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-zinc-500">{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}

import { getSession } from "@/lib/session";

export default async function Dashboard() {
  const { supabase, profile, user } = await getSession();

  if (profile.role === "staff") {
    const { data: emp } = await supabase
      .from("employees")
      .select("full_name, designation, employee_code, gyms(name)")
      .eq("user_id", user.id)
      .maybeSingle();
    const gym = (emp?.gyms as unknown as { name: string } | null)?.name;
    return (
      <div className="flex flex-col gap-4">
        <div className="card">
          <p className="text-xs text-zinc-500">{gym ?? "No gym assigned yet"}</p>
          <h1 className="text-lg font-semibold">Welcome, {profile.full_name}</h1>
          {emp ? (
            <p className="text-sm text-zinc-500">{emp.designation} · {emp.employee_code}</p>
          ) : (
            <p className="text-sm text-zinc-500">Your login is not linked to an employee record yet. Ask your admin.</p>
          )}
        </div>
        <div className="card text-sm text-zinc-500">Check-in, leave and salary slips arrive in the next steps.</div>
      </div>
    );
  }

  const [{ count: gyms }, { count: staff }, { count: inactive }] = await Promise.all([
    supabase.from("gyms").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("is_active", false),
  ]);
  const cards = [
    { label: profile.role === "admin" ? "Active gyms" : "Your gyms", value: gyms ?? 0 },
    { label: "Active staff", value: staff ?? 0 },
    { label: "Deactivated staff", value: inactive ?? 0 },
    { label: "Present today", value: "–" },
    { label: "Pending leave", value: "–" },
    { label: "Payroll status", value: "–" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-xs text-zinc-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500">Attendance, leave and payroll cards fill in as those steps are built.</p>
    </div>
  );
}

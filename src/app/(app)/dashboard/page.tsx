import Link from "next/link";
import { getSession } from "@/lib/session";
import { timeIST, todayIST } from "@/lib/date";

export default async function Dashboard() {
  const { supabase, profile, user } = await getSession();

  if (profile.role === "staff") {
    const { data: emp } = await supabase
      .from("employees")
      .select("full_name, designation, employee_code, gyms(name)")
      .eq("user_id", user.id)
      .maybeSingle();
    const gym = (emp?.gyms as unknown as { name: string } | null)?.name;
    const { data: today } = await supabase.from("attendance").select("status, check_in, check_out").eq("work_date", todayIST()).maybeSingle();
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
        <div className="card text-sm">
          <p className="font-medium">Today</p>
          <p className="text-zinc-500">{today ? `${today.status.replace("_", " ")} · in ${timeIST(today.check_in)} · out ${timeIST(today.check_out)}` : "Not checked in. Scan the QR code on the gym screen."}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/leave" className="card text-center text-sm">Apply for leave</Link>
          <Link href="/salary" className="card text-center text-sm">Salary slips</Link>
        </div>
      </div>
    );
  }

  const today = todayIST();
  const [{ count: gyms }, { count: staff }, { count: pending }, { data: marks }] = await Promise.all([
    supabase.from("gyms").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("attendance").select("status").eq("work_date", today),
  ]);
  const here = marks?.filter((m) => m.status === "present" || m.status === "late").length ?? 0;
  const late = marks?.filter((m) => m.status === "late").length ?? 0;
  const cards = [
    { label: profile.role === "admin" ? "Active gyms" : "Your gyms", value: gyms ?? 0 },
    { label: "Active staff", value: staff ?? 0 },
    { label: "Present today", value: here, href: "/attendance" },
    { label: "Late today", value: late, href: "/attendance" },
    { label: "Not marked yet", value: Math.max(0, (staff ?? 0) - (marks?.length ?? 0)), href: "/attendance" },
    { label: "Pending leave requests", value: pending ?? 0, href: "/leave" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href ?? "#"} className="card">
            <p className="text-xs text-zinc-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold">{c.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

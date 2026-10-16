import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { EmployeeForm } from "@/components/EmployeeForm";

export default async function EditEmployee({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { supabase, perms } = await requireRole(["admin", "gym_manager"]);
  if (!perms.can_manage_employees) redirect("/employees");
  const { id } = await params;
  const { error } = await searchParams;
  const { data: emp } = await supabase.from("employees").select("*").eq("id", id).maybeSingle();
  if (!emp) notFound();
  const { data: gyms } = await supabase.from("gyms").select("id, name").eq("is_active", true).order("name");
  let current: number | null = null;
  if (perms.can_view_salaries) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: s } = await supabase.from("employee_salaries").select("monthly_salary")
      .eq("employee_id", id).lte("effective_from", today).order("effective_from", { ascending: false }).limit(1);
    current = s?.[0] ? Number(s[0].monthly_salary) : null;
  }
  const { data: history } = await supabase.from("employee_gym_history").select("id, from_date, to_date, gyms(name)")
    .eq("employee_id", id).order("from_date", { ascending: false });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Edit {emp.full_name}</h1>
      <EmployeeForm emp={emp} gyms={gyms ?? []} canSetSalary={perms.can_configure_salary} currentSalary={current} error={error} />
      {!!history?.length && (
        <div className="card max-w-xl">
          <h2 className="mb-2 text-sm font-medium">Gym history</h2>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400">
            {history.map((h) => (
              <li key={h.id}>{(h.gyms as unknown as { name: string } | null)?.name ?? "Another gym"} · {h.from_date} → {h.to_date ?? "now"}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

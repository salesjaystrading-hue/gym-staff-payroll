import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { EmployeeForm } from "@/components/EmployeeForm";

export default async function NewEmployee({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, perms } = await requireRole(["admin", "gym_manager"]);
  if (!perms.can_manage_employees) redirect("/employees");
  const { error } = await searchParams;
  const { data: gyms } = await supabase.from("gyms").select("id, name").eq("is_active", true).order("name");
  const { data: shifts } = await supabase.from("shifts").select("id, name, gym_id").eq("is_active", true).order("name");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Add employee</h1>
      <EmployeeForm gyms={gyms ?? []} shifts={shifts ?? []} canSetSalary={perms.can_configure_salary} error={error} />
    </div>
  );
}

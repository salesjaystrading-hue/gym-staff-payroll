"use server";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { enc, optStr, str } from "@/lib/form";

async function gymOf(supabase: Awaited<ReturnType<typeof requireRole>>["supabase"], employeeId: string) {
  const { data } = await supabase.from("employees").select("gym_id").eq("id", employeeId).maybeSingle();
  return data?.gym_id as string | undefined;
}

export async function addAdvance(formData: FormData) {
  const { supabase, user } = await requireRole(["admin", "gym_manager"]);
  const emp = str(formData, "employee_id");
  const gym = await gymOf(supabase, emp);
  if (!gym) redirect("/advances?error=" + enc("Choose an employee"));
  const { error } = await supabase.from("advances").insert({
    employee_id: emp, gym_id: gym, amount: Number(str(formData, "amount")), monthly_recovery: Number(str(formData, "monthly_recovery")),
    issued_on: str(formData, "issued_on"), note: optStr(formData, "note"), created_by: user.id,
  });
  redirect("/advances" + (error ? "?error=" + enc(error.message) : ""));
}

export async function addIncentive(formData: FormData) {
  const { supabase, user } = await requireRole(["admin", "gym_manager"]);
  const emp = str(formData, "employee_id");
  const gym = await gymOf(supabase, emp);
  if (!gym) redirect("/advances?error=" + enc("Choose an employee"));
  const { error } = await supabase.from("incentives").insert({
    employee_id: emp, gym_id: gym, month: str(formData, "month") + "-01", kind: str(formData, "kind") || "bonus",
    amount: Number(str(formData, "amount")), note: optStr(formData, "note"), created_by: user.id,
  });
  redirect("/advances" + (error ? "?error=" + enc(error.message) : ""));
}

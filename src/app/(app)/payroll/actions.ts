"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { enc, str } from "@/lib/form";

export async function generatePayroll(formData: FormData) {
  const { supabase } = await requireRole(["admin", "gym_manager"]);
  const { data, error } = await supabase.rpc("generate_payroll", { p_gym: str(formData, "gym_id"), p_month: str(formData, "month") + "-01" });
  if (error || !data) redirect("/payroll?error=" + enc(error?.message ?? "Could not generate"));
  redirect(`/payroll/${data}`);
}

/** Throws away the draft figures and calculates again from current attendance. */
export async function recalculatePayroll(formData: FormData) {
  const { supabase } = await requireRole(["admin", "gym_manager"]);
  const id = str(formData, "id");
  const { data: run } = await supabase.from("payroll_runs").select("gym_id, month, status").eq("id", id).maybeSingle();
  if (!run || run.status !== "draft") redirect(`/payroll/${id}?error=` + enc("Only a draft can be recalculated"));
  const del = await supabase.from("payroll_items").delete().eq("run_id", id);
  if (del.error) redirect(`/payroll/${id}?error=` + enc(del.error.message));
  const { error } = await supabase.rpc("generate_payroll", { p_gym: run.gym_id, p_month: run.month });
  redirect(`/payroll/${id}` + (error ? "?error=" + enc(error.message) : ""));
}

export async function approvePayroll(formData: FormData) {
  const { supabase } = await requireRole(["admin", "gym_manager"]);
  const id = str(formData, "id");
  const { error } = await supabase.rpc("approve_payroll", { p_run: id });
  revalidatePath(`/payroll/${id}`);
  redirect(`/payroll/${id}` + (error ? "?error=" + enc(error.message) : ""));
}

export async function payItem(formData: FormData) {
  const { supabase } = await requireRole(["admin", "gym_manager"]);
  const run = str(formData, "run_id");
  const { error } = await supabase.rpc("record_payment", {
    p_item: str(formData, "item_id"), p_amount: Number(str(formData, "amount")), p_paid_on: str(formData, "paid_on"),
    p_method: str(formData, "method"), p_ref: str(formData, "reference"),
  });
  revalidatePath(`/payroll/${run}`);
  redirect(`/payroll/${run}` + (error ? "?error=" + enc(error.message) : ""));
}

export async function addAdjustment(formData: FormData) {
  const { supabase } = await requireRole(["admin", "gym_manager"]);
  const run = str(formData, "run_id");
  const { error } = await supabase.from("payroll_adjustments").insert({
    run_id: run, employee_id: str(formData, "employee_id"), kind: str(formData, "kind"),
    amount: Number(str(formData, "amount")), reason: str(formData, "reason"),
  });
  revalidatePath(`/payroll/${run}`);
  redirect(`/payroll/${run}` + (error ? "?error=" + enc(error.message) : ""));
}

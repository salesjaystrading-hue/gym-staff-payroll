"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { enc, optStr, str } from "@/lib/form";

export async function saveGym(formData: FormData) {
  const { supabase, profile } = await getSession();
  if (profile.role !== "admin") redirect("/gyms");
  const id = str(formData, "id");
  const row = {
    code: str(formData, "code").toUpperCase(),
    name: str(formData, "name"),
    address: optStr(formData, "address"),
    phone: optStr(formData, "phone"),
    email: optStr(formData, "email"),
    opening_time: optStr(formData, "opening_time"),
    closing_time: optStr(formData, "closing_time"),
  };
  if (!row.code || !row.name) redirect(`/gyms/${id ? id + "/edit" : "new"}?error=${enc("Code and name are required")}`);
  const { error } = id
    ? await supabase.from("gyms").update(row).eq("id", id)
    : await supabase.from("gyms").insert(row);
  if (error) {
    const msg = error.code === "23505" ? "That gym code is already used" : error.message;
    redirect(`/gyms/${id ? id + "/edit" : "new"}?error=${enc(msg)}`);
  }
  revalidatePath("/gyms");
  redirect("/gyms");
}

export async function setGymActive(formData: FormData) {
  const { supabase, profile } = await getSession();
  if (profile.role !== "admin") redirect("/gyms");
  await supabase.from("gyms").update({ is_active: str(formData, "active") === "true" }).eq("id", str(formData, "id"));
  revalidatePath("/gyms");
}

export async function saveGymSettings(formData: FormData) {
  const { supabase } = await getSession();
  const id = str(formData, "id");
  const late = str(formData, "late_marks_per_half_day");
  const { data, error } = await supabase
    .from("gym_settings")
    .update({
      deduction_method: str(formData, "deduction_method"),
      salary_divisor: str(formData, "salary_divisor"),
      late_marks_per_half_day: late ? Number(late) : null,
      overtime_enabled: formData.get("overtime_enabled") === "on",
      overtime_rate: Number(str(formData, "overtime_rate") || 0),
    })
    .eq("gym_id", id)
    .select("gym_id");
  if (error) redirect(`/gyms/${id}/settings?error=${enc(error.message)}`);
  if (!data?.length) redirect(`/gyms/${id}/settings?error=${enc("You do not have permission to change these rules")}`);
  redirect(`/gyms/${id}/settings?saved=1`);
}

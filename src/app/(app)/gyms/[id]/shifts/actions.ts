"use server";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { enc, str } from "@/lib/form";

export async function addShift(formData: FormData) {
  const { supabase } = await requireRole(["admin", "gym_manager"]);
  const gym = str(formData, "gym_id");
  const { error } = await supabase.from("shifts").insert({
    gym_id: gym, name: str(formData, "name"), start_time: str(formData, "start_time"), end_time: str(formData, "end_time"),
  });
  redirect(`/gyms/${gym}/shifts` + (error ? `?error=${enc(error.code === "23505" ? "A shift with that name exists" : error.message)}` : ""));
}

export async function setShiftActive(formData: FormData) {
  const { supabase } = await requireRole(["admin", "gym_manager"]);
  const gym = str(formData, "gym_id");
  await supabase.from("shifts").update({ is_active: str(formData, "active") === "true" }).eq("id", str(formData, "id"));
  redirect(`/gyms/${gym}/shifts`);
}

export async function addHoliday(formData: FormData) {
  const { supabase } = await requireRole(["admin", "gym_manager"]);
  const gym = str(formData, "gym_id");
  const { error } = await supabase.from("gym_holidays").insert({
    gym_id: gym, holiday_date: str(formData, "holiday_date"), name: str(formData, "name"),
  });
  redirect(`/gyms/${gym}/shifts` + (error ? `?error=${enc(error.code === "23505" ? "That date is already a holiday" : error.message)}` : ""));
}

export async function removeHoliday(formData: FormData) {
  const { supabase } = await requireRole(["admin", "gym_manager"]);
  const gym = str(formData, "gym_id");
  await supabase.from("gym_holidays").delete().eq("gym_id", gym).eq("holiday_date", str(formData, "holiday_date"));
  redirect(`/gyms/${gym}/shifts`);
}

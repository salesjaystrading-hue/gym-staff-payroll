"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { enc, str } from "@/lib/form";

export async function requestLeave(formData: FormData) {
  const { supabase, user } = await getSession();
  const { data: emp } = await supabase.from("employees").select("id, gym_id").eq("user_id", user.id).maybeSingle();
  if (!emp) redirect("/leave?error=" + enc("Your login is not linked to an employee record"));
  const from = str(formData, "from_date"), to = str(formData, "to_date") || from;
  if (to < from) redirect("/leave?error=" + enc("The end date is before the start date"));
  const { error } = await supabase.from("leave_requests").insert({
    employee_id: emp.id, gym_id: emp.gym_id, from_date: from, to_date: to, reason: str(formData, "reason") || null,
  });
  redirect("/leave" + (error ? "?error=" + enc(error.message) : "?saved=1"));
}

export async function cancelLeave(formData: FormData) {
  const { supabase } = await getSession();
  const { error } = await supabase.rpc("cancel_leave", { p_id: str(formData, "id") });
  redirect("/leave" + (error ? "?error=" + enc(error.message) : ""));
}

export async function decideLeave(formData: FormData) {
  const { supabase } = await getSession();
  const id = str(formData, "id");
  const note = str(formData, "note") || null;
  const { error } = str(formData, "decision") === "approve"
    ? await supabase.rpc("approve_leave", { p_id: id, p_type: str(formData, "type"), p_note: note })
    : await supabase.rpc("reject_leave", { p_id: id, p_note: note });
  revalidatePath("/leave");
  redirect("/leave" + (error ? "?error=" + enc(error.message) : ""));
}

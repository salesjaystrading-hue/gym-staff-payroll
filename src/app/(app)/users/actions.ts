"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, PERMISSION_LABELS, type PermKey } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { enc, str } from "@/lib/form";

export async function createUser(formData: FormData) {
  const { supabase } = await requireRole(["admin"]);
  const role = str(formData, "role");
  const password = str(formData, "password");
  const employeeId = str(formData, "employee_id");
  const fail = (m: string): never => redirect("/users?error=" + enc(m));
  if (role !== "gym_manager" && role !== "staff") fail("Pick a role");
  if (password.length < 8) fail("Password must be at least 8 characters");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: str(formData, "email"),
    password,
    email_confirm: true,
    user_metadata: { full_name: str(formData, "full_name") },
    app_metadata: { role }, // server-only field: users cannot set this themselves
  });
  if (error || !data.user) return fail(error?.message ?? "Could not create user");

  if (role === "staff" && employeeId) {
    const { error: linkErr } = await supabase.from("employees").update({ user_id: data.user.id }).eq("id", employeeId);
    if (linkErr) fail("User created, but linking the employee failed: " + linkErr.message);
  }
  revalidatePath("/users");
  redirect(role === "gym_manager" ? `/users/${data.user.id}` : "/users?saved=1");
}

export async function saveManager(formData: FormData) {
  const { supabase } = await requireRole(["admin"]);
  const userId = str(formData, "user_id");
  const perms = Object.fromEntries(
    (Object.keys(PERMISSION_LABELS) as PermKey[]).map((k) => [k, formData.get(k) === "on"]),
  );
  const { error } = await supabase.from("manager_permissions").upsert({ user_id: userId, ...perms });
  if (error) redirect(`/users/${userId}?error=${enc(error.message)}`);

  const wanted = new Set(formData.getAll("gym").map(String));
  const { data: current } = await supabase.from("manager_gym_access").select("gym_id").eq("user_id", userId);
  const have = new Set((current ?? []).map((r) => r.gym_id));
  const add = [...wanted].filter((g) => !have.has(g)).map((gym_id) => ({ user_id: userId, gym_id }));
  const remove = [...have].filter((g) => !wanted.has(g));
  if (add.length) await supabase.from("manager_gym_access").insert(add);
  if (remove.length) await supabase.from("manager_gym_access").delete().eq("user_id", userId).in("gym_id", remove);

  revalidatePath(`/users/${userId}`);
  redirect(`/users/${userId}?saved=1`);
}

export async function setUserActive(formData: FormData) {
  const { supabase, user } = await requireRole(["admin"]);
  const id = str(formData, "id");
  if (id === user.id) redirect("/users?error=" + enc("You cannot deactivate your own account"));
  await supabase.from("profiles").update({ is_active: str(formData, "active") === "true" }).eq("id", id);
  revalidatePath("/users");
}

export async function resetPassword(formData: FormData) {
  await requireRole(["admin"]);
  const id = str(formData, "id");
  const password = str(formData, "password");
  if (password.length < 8) redirect("/users?error=" + enc("Password must be at least 8 characters"));
  const { error } = await createAdminClient().auth.admin.updateUserById(id, { password });
  redirect(error ? "/users?error=" + enc(error.message) : "/users?saved=1");
}

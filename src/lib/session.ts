import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "gym_manager" | "staff";

export const PERMISSION_LABELS = {
  can_manage_employees: "Add and edit employees",
  can_view_salaries: "View salaries",
  can_configure_salary: "Set salaries and salary rules",
  can_edit_attendance: "Edit attendance",
  can_approve_leave: "Approve leave",
  can_approve_payroll: "Approve payroll",
} as const;
export type PermKey = keyof typeof PERMISSION_LABELS;
export type Perms = Record<PermKey, boolean>;

const ALL_TRUE = Object.fromEntries(Object.keys(PERMISSION_LABELS).map((k) => [k, true])) as Perms;
const ALL_FALSE = Object.fromEntries(Object.keys(PERMISSION_LABELS).map((k) => [k, false])) as Perms;

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .single();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=Account+is+inactive");
  }

  let perms: Perms = ALL_FALSE;
  if (profile.role === "admin") perms = ALL_TRUE;
  if (profile.role === "gym_manager") {
    const { data } = await supabase.from("manager_permissions").select("*").eq("user_id", user.id).single();
    if (data) perms = { ...ALL_FALSE, ...(data as Partial<Perms>) };
  }
  return { supabase, user, profile: profile as { id: string; full_name: string; role: Role; is_active: boolean }, perms };
}

/** Use at the top of pages that only some roles may open. Database RLS still enforces the real rule. */
export async function requireRole(roles: Role[]) {
  const s = await getSession();
  if (!roles.includes(s.profile.role)) redirect("/dashboard");
  return s;
}

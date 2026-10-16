"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { enc, optStr, str } from "@/lib/form";

export async function saveEmployee(formData: FormData) {
  const { supabase, user, perms } = await getSession();
  const id = str(formData, "id");
  const back: (msg: string) => never = (msg) => redirect(`/employees/${id ? id + "/edit" : "new"}?error=${enc(msg)}`);

  const row = {
    full_name: str(formData, "full_name"),
    phone: optStr(formData, "phone"),
    designation: optStr(formData, "designation"),
    gym_id: str(formData, "gym_id"),
    joining_date: str(formData, "joining_date"),
    weekly_off: Number(str(formData, "weekly_off") || 0),
  };
  if (!row.full_name || !row.gym_id || !row.joining_date) back("Name, gym and joining date are required");

  const salaryRaw = str(formData, "monthly_salary");
  const salary = salaryRaw === "" ? null : Number(salaryRaw);
  if (salary !== null && (!Number.isFinite(salary) || salary < 0)) back("Salary must be a positive number");
  const salaryFrom = str(formData, "salary_effective_from") || row.joining_date;

  let employeeId = id;
  if (id) {
    const { data, error } = await supabase.from("employees").update(row).eq("id", id).select("id");
    if (error) back(error.message);
    if (!data?.length) back("You cannot edit this employee");
  } else {
    let code = str(formData, "employee_code").toUpperCase();
    const generated = !code;
    if (generated) {
      const { data: codes } = await supabase.from("employees").select("employee_code").like("employee_code", "STF%");
      const max = Math.max(0, ...(codes ?? []).map((c) => parseInt(c.employee_code.slice(3), 10) || 0));
      code = "STF" + String(max + 1).padStart(3, "0");
    }
    for (let attempt = 0; attempt < 20; attempt++) {
      const { data, error } = await supabase.from("employees").insert({ ...row, employee_code: code }).select("id").single();
      if (!error) { employeeId = data.id; break; }
      if (error.code === "23505" && generated) {
        code = "STF" + String((parseInt(code.slice(3), 10) || 0) + 1).padStart(3, "0");
        continue;
      }
      back(error.code === "23505" ? "That employee ID is already used" : error.message);
    }
    if (!employeeId) back("Could not create the employee, try again");
  }

  if (salary !== null && perms.can_configure_salary) {
    const { error } = await supabase
      .from("employee_salaries")
      .insert({ employee_id: employeeId, monthly_salary: salary, effective_from: salaryFrom, created_by: user.id });
    if (error) {
      redirect(`/employees/${employeeId}/edit?error=${enc(error.code === "23505" ? "A salary is already recorded for that date. Pick a later date." : error.message)}`);
    }
  }
  revalidatePath("/employees");
  redirect("/employees");
}

export async function setEmployeeActive(formData: FormData) {
  const { supabase } = await getSession();
  await supabase.from("employees").update({ is_active: str(formData, "active") === "true" }).eq("id", str(formData, "id"));
  revalidatePath("/employees");
}

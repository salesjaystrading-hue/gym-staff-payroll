import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { monthLabel } from "@/lib/date";

const rs = (n: number | string) => "Rs. " + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Sign in first", { status: 401 });

  // Row-level security decides who can read this payslip (own, or a manager allowed to see salaries).
  const { data: it } = await supabase.from("payroll_item_view").select("*").eq("id", id).maybeSingle();
  if (!it || it.run_status === "draft") return new Response("Not found", { status: 404 });
  const { data: emp } = await supabase.from("employees").select("full_name, employee_code, designation, gyms(name)").eq("id", it.employee_id).maybeSingle();
  if (!emp) return new Response("Not found", { status: 404 });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 790;
  const text = (t: string, x: number, size = 11, f = font) => page.drawText(t, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
  const row = (l: string, r: string, b = false) => { text(l, 50, 11, b ? bold : font); const w = (b ? bold : font).widthOfTextAtSize(r, 11); text(r, 545 - w, 11, b ? bold : font); y -= 20; };
  const line = () => { page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: 545, y: y + 12 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) }); };

  const gym = (emp.gyms as unknown as { name: string } | null)?.name ?? "";
  text(gym, 50, 16, bold); y -= 22;
  text("Salary slip - " + monthLabel(it.month), 50, 12); y -= 34;
  row("Employee", `${emp.full_name} (${emp.employee_code})`);
  row("Designation", emp.designation ?? "-");
  y -= 8; line(); y -= 8;
  text("Attendance", 50, 12, bold); y -= 22;
  row("Days present", String(it.present_days));
  row("Late marks", String(it.late_count));
  row("Paid leave days", String(it.paid_leave_days));
  row("Unpaid leave days", String(it.unpaid_leave_days));
  row("Days cut (absent, unpaid leave, half days, late rule)", String(it.absent_units));
  y -= 8; line(); y -= 8;
  text("Earnings", 50, 12, bold); y -= 22;
  row("Monthly salary", rs(it.monthly_salary));
  if (Number(it.overtime_amount) > 0) row(`Overtime (${it.overtime_hours} h)`, rs(it.overtime_amount));
  if (Number(it.incentive_amount) > 0) row("Bonus / incentive", rs(it.incentive_amount));
  if (Number(it.adj_earning) > 0) row("Other additions", rs(it.adj_earning));
  y -= 8; line(); y -= 8;
  text("Deductions", 50, 12, bold); y -= 22;
  row("Attendance deduction", rs(it.deduction_amount));
  if (Number(it.advance_recovery) > 0) row("Advance recovered", rs(it.advance_recovery));
  if (Number(it.adj_deduction) > 0) row("Other deductions", rs(it.adj_deduction));
  y -= 8; line(); y -= 8;
  row("Net salary", rs(it.final_net), true);
  row("Paid so far", rs(it.paid_amount));
  row("Balance", rs(Number(it.final_net) - Number(it.paid_amount)));
  y -= 20;
  page.drawText("This is a computer-generated slip.", { x: 50, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="salary-slip-${emp.employee_code}-${it.month.slice(0, 7)}.pdf"` },
  });
}

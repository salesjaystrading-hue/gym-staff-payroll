"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getSession, requireRole } from "@/lib/session";
import { enc, str } from "@/lib/form";

const stamp = (date: string, time: string) => (time ? new Date(`${date}T${time}:00+05:30`) : null);

export async function markAttendance(formData: FormData) {
  const { supabase, user } = await requireRole(["admin", "gym_manager"]);
  const gym = str(formData, "gym_id");
  const date = str(formData, "date");
  const back = (m?: string) => `/attendance?gym=${gym}&date=${date}${m ? "&error=" + enc(m) : ""}`;
  const note = str(formData, "note");
  if (!note) redirect(back("Please write a short reason or note"));

  let cin = stamp(date, str(formData, "in_time"));
  let cout = stamp(date, str(formData, "out_time"));
  if (cin && cout && cout <= cin) cout = new Date(cout.getTime() + 24 * 3600 * 1000); // shift ended after midnight
  const { error } = await supabase.from("attendance").upsert(
    {
      employee_id: str(formData, "employee_id"), gym_id: gym, work_date: date, status: str(formData, "status"),
      check_in: cin?.toISOString() ?? null, check_out: cout?.toISOString() ?? null,
      source: "manual", note, updated_by: user.id,
    },
    { onConflict: "employee_id,work_date" },
  );
  redirect(back(error?.message));
}

/** Makes a fresh one-minute QR code for a gym screen. */
export async function makeQr(gymId: string) {
  const { supabase } = await getSession();
  const { data: token, error } = await supabase.rpc("rotate_gym_qr", { p_gym: gymId });
  if (error || !token) return { error: error?.message ?? "Could not create a code" };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const dataUrl = await QRCode.toDataURL(`${proto}://${host}/checkin?t=${token}`, { width: 360, margin: 1 });
  return { dataUrl };
}

export async function doCheckIn(token: string, device: string) {
  const { supabase } = await getSession();
  const { data, error } = await supabase.rpc("qr_check_in", { p_token: token, p_device: device });
  if (error) return { ok: false, message: error.message };
  return data as { ok: boolean; message: string };
}

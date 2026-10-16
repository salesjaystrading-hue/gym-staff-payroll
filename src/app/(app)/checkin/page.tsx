import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CheckInRunner } from "@/components/CheckInRunner";

export default async function CheckIn({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { profile } = await getSession();
  const { t } = await searchParams;
  if (profile.role !== "staff") redirect("/attendance");
  if (!t) redirect("/attendance");
  return <CheckInRunner token={t} />;
}

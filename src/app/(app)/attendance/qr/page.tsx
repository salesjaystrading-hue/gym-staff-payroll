import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { QrDisplay } from "@/components/QrDisplay";

export default async function QrPage({ searchParams }: { searchParams: Promise<{ gym?: string }> }) {
  const { supabase, perms } = await requireRole(["admin", "gym_manager"]);
  if (!perms.can_edit_attendance) redirect("/attendance");
  const { gym } = await searchParams;
  const { data: g } = gym ? await supabase.from("gyms").select("id, name").eq("id", gym).maybeSingle() : { data: null };
  if (!g) redirect("/attendance");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-center text-lg font-semibold">{g.name} · check-in</h1>
      <QrDisplay gymId={g.id} />
      <p className="text-center text-xs text-zinc-500">Keep this page open on the gym tablet or the front-desk phone.</p>
    </div>
  );
}

import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { GymForm } from "@/components/GymForm";

export default async function EditGym({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireRole(["admin"]);
  const { id } = await params;
  const { error } = await searchParams;
  const { data: gym } = await supabase.from("gyms").select("*").eq("id", id).maybeSingle();
  if (!gym) notFound();
  return (<div className="flex flex-col gap-4"><h1 className="text-lg font-semibold">Edit {gym.name}</h1><GymForm gym={gym} error={error} /></div>);
}

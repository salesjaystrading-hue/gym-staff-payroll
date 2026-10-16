import { requireRole } from "@/lib/session";
import { GymForm } from "@/components/GymForm";

export default async function NewGym({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireRole(["admin"]);
  const { error } = await searchParams;
  return (<div className="flex flex-col gap-4"><h1 className="text-lg font-semibold">Add gym</h1><GymForm error={error} /></div>);
}

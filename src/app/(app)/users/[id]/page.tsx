import { notFound } from "next/navigation";
import { requireRole, PERMISSION_LABELS, type PermKey } from "@/lib/session";
import { saveManager } from "../actions";

export default async function ManagerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { supabase } = await requireRole(["admin"]);
  const { id } = await params;
  const { error, saved } = await searchParams;
  const { data: p } = await supabase.from("profiles").select("id, full_name, role").eq("id", id).maybeSingle();
  if (!p || p.role !== "gym_manager") notFound();
  const { data: perms } = await supabase.from("manager_permissions").select("*").eq("user_id", id).maybeSingle();
  const { data: gyms } = await supabase.from("gyms").select("id, name, is_active").order("name");
  const { data: access } = await supabase.from("manager_gym_access").select("gym_id").eq("user_id", id);
  const mine = new Set(access?.map((a) => a.gym_id));
  const row = (perms ?? {}) as Partial<Record<PermKey, boolean>>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{p.full_name} · gyms & permissions</h1>
      <form action={saveManager} className="card grid max-w-xl gap-4">
        <input type="hidden" name="user_id" value={id} />
        <fieldset>
          <legend className="label">Gyms this manager can access</legend>
          <div className="flex flex-col gap-1">
            {gyms?.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="gym" value={g.id} defaultChecked={mine.has(g.id)} /> {g.name}{!g.is_active && " (inactive)"}
              </label>
            ))}
            {!gyms?.length && <p className="text-sm text-zinc-500">Add a gym first.</p>}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">What this manager may do</legend>
          <div className="flex flex-col gap-1">
            {(Object.keys(PERMISSION_LABELS) as PermKey[]).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={k} defaultChecked={!!row[k]} /> {PERMISSION_LABELS[k]}
              </label>
            ))}
          </div>
        </fieldset>
        {saved && <p className="text-sm text-emerald-700">Saved.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div><button className="btn">Save</button></div>
      </form>
    </div>
  );
}

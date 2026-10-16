import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { addHoliday, addShift, removeHoliday, setShiftActive } from "./actions";

export default async function ShiftsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { supabase, perms } = await requireRole(["admin", "gym_manager"]);
  const { id } = await params;
  const { error } = await searchParams;
  const { data: gym } = await supabase.from("gyms").select("id, name").eq("id", id).maybeSingle();
  if (!gym) notFound();
  const { data: shifts } = await supabase.from("shifts").select("*").eq("gym_id", id).order("start_time");
  const { data: holidays } = await supabase.from("gym_holidays").select("*").eq("gym_id", id).order("holiday_date");
  const canEdit = perms.can_manage_employees;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Shifts & holidays · {gym.name}</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="card max-w-xl">
        <h2 className="mb-2 text-sm font-medium">Shifts</h2>
        <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {shifts?.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <span>{s.name} · {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}{s.end_time < s.start_time ? " (next day)" : ""}{!s.is_active && " · inactive"}</span>
              {canEdit && (
                <form action={setShiftActive}>
                  <input type="hidden" name="id" value={s.id} /><input type="hidden" name="gym_id" value={id} />
                  <input type="hidden" name="active" value={String(!s.is_active)} />
                  <button className="btn-ghost">{s.is_active ? "Deactivate" : "Activate"}</button>
                </form>
              )}
            </li>
          ))}
          {!shifts?.length && <li className="py-2 text-zinc-500">No shifts yet. Late marks and overtime need a shift.</li>}
        </ul>
        {canEdit && (
          <form action={addShift} className="mt-3 grid grid-cols-3 gap-2">
            <input type="hidden" name="gym_id" value={id} />
            <div className="col-span-3"><label className="label">Shift name</label><input name="name" required placeholder="Morning" className="input" /></div>
            <div><label className="label">Starts</label><input name="start_time" type="time" required className="input" /></div>
            <div><label className="label">Ends</label><input name="end_time" type="time" required className="input" /></div>
            <div className="flex items-end"><button className="btn w-full">Add</button></div>
            <p className="col-span-3 text-[11px] text-zinc-500">An end time earlier than the start time means the shift runs past midnight.</p>
          </form>
        )}
      </div>
      <div className="card max-w-xl">
        <h2 className="mb-2 text-sm font-medium">Holidays (paid, no deduction)</h2>
        <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {holidays?.map((h) => (
            <li key={h.holiday_date} className="flex items-center justify-between py-2">
              <span>{h.holiday_date} · {h.name}</span>
              {canEdit && (
                <form action={removeHoliday}>
                  <input type="hidden" name="gym_id" value={id} /><input type="hidden" name="holiday_date" value={h.holiday_date} />
                  <button className="btn-ghost">Remove</button>
                </form>
              )}
            </li>
          ))}
          {!holidays?.length && <li className="py-2 text-zinc-500">No holidays added.</li>}
        </ul>
        {canEdit && (
          <form action={addHoliday} className="mt-3 grid grid-cols-3 gap-2">
            <input type="hidden" name="gym_id" value={id} />
            <div><label className="label">Date</label><input name="holiday_date" type="date" required className="input" /></div>
            <div><label className="label">Name</label><input name="name" required className="input" /></div>
            <div className="flex items-end"><button className="btn w-full">Add</button></div>
          </form>
        )}
      </div>
    </div>
  );
}

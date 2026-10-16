import { saveGym } from "@/app/(app)/gyms/actions";

type Gym = { id: string; code: string; name: string; address: string | null; phone: string | null; email: string | null; opening_time: string | null; closing_time: string | null };

export function GymForm({ gym, error }: { gym?: Gym; error?: string }) {
  const t = (v: string | null | undefined) => (v ? v.slice(0, 5) : "");
  return (
    <form action={saveGym} className="card grid max-w-xl gap-3 sm:grid-cols-2">
      {gym && <input type="hidden" name="id" value={gym.id} />}
      <div><label className="label">Gym code</label><input name="code" required defaultValue={gym?.code} className="input uppercase" /></div>
      <div><label className="label">Gym name</label><input name="name" required defaultValue={gym?.name} className="input" /></div>
      <div className="sm:col-span-2"><label className="label">Address</label><input name="address" defaultValue={gym?.address ?? ""} className="input" /></div>
      <div><label className="label">Phone</label><input name="phone" defaultValue={gym?.phone ?? ""} className="input" /></div>
      <div><label className="label">Email</label><input name="email" type="email" defaultValue={gym?.email ?? ""} className="input" /></div>
      <div><label className="label">Opens</label><input name="opening_time" type="time" defaultValue={t(gym?.opening_time)} className="input" /></div>
      <div><label className="label">Closes</label><input name="closing_time" type="time" defaultValue={t(gym?.closing_time)} className="input" /></div>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2"><button className="btn">Save gym</button></div>
    </form>
  );
}

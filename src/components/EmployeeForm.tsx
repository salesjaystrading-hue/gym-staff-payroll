import { saveEmployee } from "@/app/(app)/employees/actions";

type Emp = { id: string; employee_code: string; full_name: string; phone: string | null; designation: string | null; gym_id: string; joining_date: string; weekly_off: number };

export function EmployeeForm({
  emp, gyms, canSetSalary, currentSalary, error,
}: {
  emp?: Emp; gyms: { id: string; name: string }[]; canSetSalary: boolean; currentSalary?: number | null; error?: string;
}) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return (
    <form action={saveEmployee} className="card grid max-w-xl gap-3 sm:grid-cols-2">
      {emp && <input type="hidden" name="id" value={emp.id} />}
      <div>
        <label className="label">Employee ID</label>
        <input name="employee_code" defaultValue={emp?.employee_code} readOnly={!!emp} placeholder="Auto (STF001…)" className="input" />
      </div>
      <div><label className="label">Full name</label><input name="full_name" required defaultValue={emp?.full_name} className="input" /></div>
      <div><label className="label">Phone</label><input name="phone" defaultValue={emp?.phone ?? ""} className="input" /></div>
      <div><label className="label">Designation</label><input name="designation" defaultValue={emp?.designation ?? ""} placeholder="Trainer, Receptionist…" className="input" /></div>
      <div>
        <label className="label">Gym</label>
        <select name="gym_id" required defaultValue={emp?.gym_id ?? ""} className="input">
          <option value="" disabled>Select gym</option>
          {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div><label className="label">Joining date</label><input name="joining_date" type="date" required defaultValue={emp?.joining_date} className="input" /></div>
      <div>
        <label className="label">Weekly off</label>
        <select name="weekly_off" defaultValue={emp?.weekly_off ?? 0} className="input">
          {days.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
      </div>
      {canSetSalary && (
        <>
          <div>
            <label className="label">Monthly salary (₹){currentSalary != null ? ` · current ${currentSalary}` : ""}</label>
            <input name="monthly_salary" type="number" min={0} step="0.01" placeholder={emp ? "Leave blank for no change" : ""} className="input" />
          </div>
          <div>
            <label className="label">Salary effective from</label>
            <input name="salary_effective_from" type="date" className="input" />
            <p className="mt-1 text-[11px] text-zinc-500">Blank = joining date. Changes are saved as a new dated revision.</p>
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2"><button className="btn">Save employee</button></div>
    </form>
  );
}

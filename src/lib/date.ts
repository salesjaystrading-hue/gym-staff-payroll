const IST_MS = 5.5 * 3600 * 1000;

/** Today's date in India (YYYY-MM-DD), whatever the server's time zone is. */
export const todayIST = () => new Date(Date.now() + IST_MS).toISOString().slice(0, 10);
export const monthIST = () => todayIST().slice(0, 7);

export const timeIST = (ts: string | null) =>
  ts ? new Date(ts).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "–";

export const monthLabel = (isoDate: string) =>
  new Date(isoDate + "T00:00:00Z").toLocaleDateString("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });

export const inr = (n: number | string) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

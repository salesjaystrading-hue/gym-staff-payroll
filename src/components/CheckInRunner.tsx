"use client";
import { useEffect, useRef, useState } from "react";
import { doCheckIn } from "@/app/(app)/attendance/actions";

export function CheckInRunner({ token }: { token: string }) {
  const [res, setRes] = useState<{ ok: boolean; message: string }>();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let device = "";
    try {
      device = localStorage.getItem("gym-device") ?? "";
      if (!device) { device = crypto.randomUUID(); localStorage.setItem("gym-device", device); }
    } catch { /* private mode */ }
    if (!device) { setRes({ ok: false, message: "This browser blocks storage. Open the link in your normal browser, not a private window." }); return; }
    doCheckIn(token, device).then(setRes);
  }, [token]);
  return (
    <div className="card mx-auto max-w-sm text-center">
      {!res ? <p className="py-6 text-sm text-zinc-500">Checking…</p> : (
        <>
          <p className={`text-4xl ${res.ok ? "text-emerald-700" : "text-red-600"}`}>{res.ok ? "✓" : "✕"}</p>
          <p className="mt-2 text-base font-medium">{res.message}</p>
        </>
      )}
    </div>
  );
}

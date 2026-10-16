"use client";
import { useEffect, useState } from "react";
import { makeQr } from "@/app/(app)/attendance/actions";

export function QrDisplay({ gymId }: { gymId: string }) {
  const [img, setImg] = useState<string>();
  const [err, setErr] = useState<string>();
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await makeQr(gymId);
      if (!alive) return;
      if ("dataUrl" in r && r.dataUrl) { setImg(r.dataUrl); setErr(undefined); } else setErr(r.error);
    };
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [gymId]);
  return (
    <div className="card mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
      {err ? <p className="text-sm text-red-600">{err}</p> : img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="Check-in QR code" className="h-72 w-72" />
      ) : <p className="py-24 text-sm text-zinc-500">Making code…</p>}
      <p className="text-sm">Scan with your phone camera to check in or out.</p>
      <p className="text-xs text-zinc-500">This code changes every 30 seconds. A photo of it will not work.</p>
    </div>
  );
}

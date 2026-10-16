import { signIn } from "./actions";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  let needsSetup = false;
  try {
    const { count } = await createAdminClient().from("profiles").select("id", { count: "exact", head: true });
    needsSetup = (count ?? 0) === 0;
  } catch {
    needsSetup = false;
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">Gym Staff & Payroll</h1>
      <form action={signIn} className="card flex flex-col gap-3">
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" autoComplete="username" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required className="input" autoComplete="current-password" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn">Sign in</button>
      </form>
      {needsSetup && (
        <Link href="/setup" className="text-center text-sm text-emerald-700 underline">
          First time? Create the admin account
        </Link>
      )}
    </main>
  );
}

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

async function createFirstAdmin(formData: FormData) {
  "use server";
  const admin = createAdminClient();
  // Only works while no account exists at all. The database trigger makes the first account the admin.
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) redirect("/login");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect("/setup?error=" + encodeURIComponent("Password must be at least 8 characters"));
  const { error } = await admin.auth.admin.createUser({
    email: String(formData.get("email") ?? "").trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: String(formData.get("name") ?? "").trim() },
  });
  if (error) redirect("/setup?error=" + encodeURIComponent(error.message));
  redirect("/login");
}

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { count } = await createAdminClient().from("profiles").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) redirect("/login");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">Create the admin account</h1>
      <form action={createFirstAdmin} className="card flex flex-col gap-3">
        <div><label className="label">Your name</label><input name="name" required className="input" /></div>
        <div><label className="label">Email</label><input name="email" type="email" required className="input" /></div>
        <div><label className="label">Password (8+ characters)</label><input name="password" type="password" minLength={8} required className="input" /></div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn">Create admin</button>
      </form>
    </main>
  );
}

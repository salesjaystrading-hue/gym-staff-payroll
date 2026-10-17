import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Admin-only helper: creates team logins and resets passwords.
// The caller must be a signed-in, active admin of this app.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: caller } = await admin.auth.getUser(token);
    if (!caller?.user) return json({ error: "Please sign in again" }, 401);
    const { data: profile } = await admin.from("profiles").select("role, is_active").eq("id", caller.user.id).single();
    if (profile?.role !== "admin" || !profile.is_active) return json({ error: "Only the admin can do this" }, 403);

    const body = await req.json();
    const password = String(body.password ?? "");
    if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

    if (body.action === "create_user") {
      const role = String(body.role);
      if (role !== "gym_manager" && role !== "staff") return json({ error: "Choose manager or staff" }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email: String(body.email ?? "").trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name: String(body.full_name ?? "").trim() },
        app_metadata: { role },
      });
      if (error || !data.user) return json({ error: error?.message ?? "Could not create the login" }, 400);
      return json({ id: data.user.id });
    }

    if (body.action === "set_password") {
      const { error } = await admin.auth.admin.updateUserById(String(body.id), { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 400);
  }
});

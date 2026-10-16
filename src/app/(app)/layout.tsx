import { getSession } from "@/lib/session";
import { menuFor } from "@/lib/menu";
import { Nav } from "@/components/Nav";
import { signOut } from "@/app/login/actions";

const ROLE_LABEL = { admin: "Admin", gym_manager: "Gym manager", staff: "Staff" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, perms } = await getSession();
  const staff = profile.role === "staff";
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-semibold">Gym Staff & Payroll</p>
          <p className="text-xs text-zinc-500">{profile.full_name} · {ROLE_LABEL[profile.role]}</p>
        </div>
        <form action={signOut}><button className="btn-ghost">Sign out</button></form>
      </header>
      <div className="flex flex-col gap-4 md:flex-row md:gap-6">
        <Nav items={menuFor(profile.role, perms)} staff={staff} />
        <main className={`min-w-0 flex-1 ${staff ? "pb-20 md:pb-0" : ""}`}>{children}</main>
      </div>
    </div>
  );
}

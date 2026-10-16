import type { Perms, Role } from "./session";

export type MenuItem = { href: string; label: string };

export function menuFor(role: Role, perms: Perms): MenuItem[] {
  if (role === "staff") {
    return [
      { href: "/dashboard", label: "Home" },
      { href: "/attendance", label: "Attendance" },
      { href: "/leave", label: "Leave" },
      { href: "/salary", label: "Salary" },
      { href: "/profile", label: "Profile" },
    ];
  }
  const items: MenuItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/gyms", label: role === "admin" ? "Gyms" : "My gyms" },
    { href: "/employees", label: "Employees" },
    { href: "/attendance", label: "Attendance" },
    { href: "/leave", label: "Leave" },
  ];
  if (perms.can_approve_payroll || perms.can_view_salaries) items.push({ href: "/payroll", label: "Payroll" });
  if (perms.can_configure_salary || perms.can_approve_payroll) items.push({ href: "/advances", label: "Advances & bonus" });
  if (role === "admin") items.push({ href: "/users", label: "Users & permissions" });
  return items;
}

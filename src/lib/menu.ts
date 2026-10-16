import type { Perms, Role } from "./session";

export type MenuItem = { href: string; label: string; soon?: boolean };

export function menuFor(role: Role, perms: Perms): MenuItem[] {
  if (role === "staff") {
    return [
      { href: "/dashboard", label: "Home" },
      { href: "/soon/attendance", label: "Attendance", soon: true },
      { href: "/soon/leave", label: "Leave", soon: true },
      { href: "/soon/salary", label: "Salary", soon: true },
      { href: "/profile", label: "Profile" },
    ];
  }
  const items: MenuItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/gyms", label: role === "admin" ? "Gyms" : "My gyms" },
    { href: "/employees", label: "Employees" },
    { href: "/soon/attendance", label: "Attendance", soon: true },
    { href: "/soon/leave", label: "Leave", soon: true },
  ];
  if (role === "admin" || perms.can_view_salaries || perms.can_approve_payroll) {
    items.push({ href: "/soon/payroll", label: "Payroll", soon: true });
  }
  items.push({ href: "/soon/reports", label: "Reports", soon: true });
  if (role === "admin") items.push({ href: "/users", label: "Users & permissions" });
  return items;
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuItem } from "@/lib/menu";

export function Nav({ items, staff }: { items: MenuItem[]; staff: boolean }) {
  const path = usePathname();
  const active = (href: string) => path === href || (href !== "/dashboard" && path.startsWith(href));
  return (
    <>
      {/* desktop sidebar */}
      <nav className="hidden w-56 shrink-0 flex-col gap-1 md:flex">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`rounded-lg px-3 py-2 text-sm ${
              active(i.href)
                ? "bg-emerald-700 text-white"
                : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {i.label}
            
          </Link>
        ))}
      </nav>
      {/* mobile: bottom tabs for staff, scrolling strip for managers/admin */}
      <nav
        className={
          staff
            ? "fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-zinc-200 bg-white md:hidden dark:border-zinc-800 dark:bg-zinc-900"
            : "flex gap-2 overflow-x-auto pb-2 md:hidden"
        }
      >
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={
              staff
                ? `py-3 text-center text-xs ${active(i.href) ? "font-semibold text-emerald-700" : "text-zinc-500"}`
                : `whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${
                    active(i.href) ? "bg-emerald-700 text-white" : "bg-zinc-200 dark:bg-zinc-800"
                  }`
            }
          >
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

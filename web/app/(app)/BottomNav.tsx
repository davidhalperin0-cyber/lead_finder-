"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard",           label: "לוח",    icon: "🏠" },
  { href: "/leads/new",           label: "חדשים",  icon: "🆕" },
  { href: "/leads/in-progress",   label: "בתהליך", icon: "💬" },
  { href: "/leads/follow-up",     label: "מעקב",   icon: "⏰" },
  { href: "/search",              label: "חיפוש",  icon: "🔍" },
];

export default function BottomNav() {
  const path = usePathname() || "";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur safe-bottom">
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {ITEMS.map((it) => {
          const active = path === it.href || path.startsWith(it.href + "/");
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-xs ${
                  active ? "text-brand font-bold" : "text-slate-500"
                }`}
              >
                <span className="text-lg leading-none">{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

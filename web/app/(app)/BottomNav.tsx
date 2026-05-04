"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard",     label: "לוח",    icon: "🏠" },
  { href: "/leads/hot",     label: "חמים",   icon: "🔥" },
  { href: "/call-mode",     label: "חיוג",   icon: "📞" },
  { href: "/leads/follow-up", label: "מעקב", icon: "⏰" },
  { href: "/search",        label: "חיפוש",  icon: "🔍" },
];

export default function BottomNav() {
  const path = usePathname() || "";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/70 bg-white/95 backdrop-blur-lg safe-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {ITEMS.map((it) => {
          const active = path === it.href || path.startsWith(it.href + "/");
          return (
            <li key={it.href} className="relative">
              <Link
                href={it.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs transition-all ${
                  active ? "text-brand font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full bg-gradient-to-r from-brand to-brand-500" />
                )}
                <span className={`text-lg leading-none transition-transform ${active ? "scale-110" : ""}`}>
                  {it.icon}
                </span>
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

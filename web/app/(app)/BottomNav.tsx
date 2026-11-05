"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// אייקונים בקו דק, בלי אימוג'י
const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />,
  flame: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.5 2 2.5-.6-2.6.2-5.5 1-8Z" />,
  phone: <path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3A2.5 2.5 0 0 1 17.5 20 14 14 0 0 1 4 6.5 2.5 2.5 0 0 1 6.5 4Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
};

const ITEMS = [
  { href: "/dashboard", label: "לוח", icon: "home" },
  { href: "/leads/hot", label: "חמים", icon: "flame" },
  { href: "/call-mode", label: "חיוג", icon: "phone" },
  { href: "/leads/follow-up", label: "מעקב", icon: "clock" },
  { href: "/search", label: "חיפוש", icon: "search" },
];

function Icon({ name }: { name: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

function useActive() {
  const path = usePathname() || "";
  return (href: string) => path === href || path.startsWith(href + "/");
}

/** מחשב: קבוצת קישורים עגולה בראש המסך, כמו בתפריט של הרפרנס */
export function TopNav() {
  const isActive = useActive();
  return (
    <nav className="hidden rounded-full border border-line bg-white/60 p-1 md:block">
      <ul className="flex items-center gap-0.5">
        {ITEMS.map((it) => {
          const active = isActive(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  active ? "bg-paper text-ink font-medium" : "text-slate-600 hover:text-paper"
                }`}
              >
                <Icon name={it.icon} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** טלפון: סרגל צף בתחתית */
export default function BottomNav() {
  const isActive = useActive();
  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 safe-bottom md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5 rounded-[1.4rem] border border-line bg-white/90 p-1.5 shadow-2xl backdrop-blur-xl">
        {ITEMS.map((it) => {
          const active = isActive(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] transition-colors ${
                  active ? "bg-paper text-ink font-semibold" : "text-slate-500 active:text-paper"
                }`}
              >
                <Icon name={it.icon} />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

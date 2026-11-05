import Link from "next/link";

/*
 * ערכת הממשק של Lead Finder (עיצוב בהיר בהשראת getlayers.ai).
 * משטחים לבנים עם קו דק, כפתור פנינתי אחד למסך, צבעי מצב רק כנקודה או טקסט.
 */

// ---------- אייקונים: קו דק אחד, בלי אימוג'י ----------
const PATHS: Record<string, React.ReactNode> = {
  phone: <path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3A2.5 2.5 0 0 1 17.5 20 14 14 0 0 1 4 6.5 2.5 2.5 0 0 1 6.5 4Z" />,
  flame: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.5 2 2.5-.6-2.6.2-5.5 1-8Z" />,
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
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m14.5 6-6 6 6 6" />,
  back: <path d="m9.5 6 6 6-6 6" />,
  chat: <path d="M5 18.5V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8.5Z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16" />
    </>
  ),
  pin: (
    <>
      <path d="M12 20s6-5.5 6-10.5a6 6 0 0 0-12 0C6 14.5 12 20 12 20Z" />
      <circle cx="12" cy="9.5" r="2" />
    </>
  ),
  star: <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6Z" />,
  calendar: (
    <>
      <rect x="4.5" y="5.5" width="15" height="14" rx="2" />
      <path d="M4.5 10h15M9 3.5v4M15 3.5v4" />
    </>
  ),
  note: <path d="M7 4.5h7l4 4V19a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 19Zm7 0V9h4" />,
  spark: <path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5" />,
  refresh: <path d="M19 12a7 7 0 1 1-2.1-5M19 4.5V9h-4.5" />,
  trash: <path d="M5.5 7h13M10 7V5h4v2M7.5 7l.8 12h7.4l.8-12" />,
};

export function Icon({ name, size = 18, className = "" }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}

// ---------- כותרת מסך ----------
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[2rem] font-light leading-tight tracking-tight text-paper sm:text-[2.5rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-slate-600">{subtitle}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

// ---------- משטח ----------
export function Panel({
  children,
  className = "",
  title,
  aside,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className={`rounded-[1.25rem] border border-line bg-white p-5 shadow-soft ${className}`}>
      {(title || aside) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-medium text-paper">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------- כפתורים ----------
const BTN = "inline-flex items-center justify-center gap-2 rounded-full text-sm transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40";
export const btn = {
  primary: `${BTN} btn-pearl px-5 py-2.5`,
  secondary: `${BTN} border border-[rgba(17,17,20,0.14)] px-5 py-2.5 text-slate-800 hover:border-slate-400 hover:text-paper`,
  ghost: `${BTN} px-3 py-2 text-slate-600 hover:text-paper`,
  danger: `${BTN} border border-rose-300 px-5 py-2.5 text-rose-700 hover:bg-rose-50`,
};

export function ButtonLink({
  href,
  children,
  variant = "secondary",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: keyof typeof btn;
  className?: string;
}) {
  return (
    <Link href={href} className={`${btn[variant]} ${className}`}>
      {children}
    </Link>
  );
}

// ---------- נקודת מצב ----------
export const STATUS_DOT: Record<string, string> = {
  new: "#6366f1",
  in_progress: "#a855f7",
  interested: "#f97316",
  follow_up: "#eab308",
  not_interested: "#a1a1aa",
  won: "#10b981",
  lost: "#f43f5e",
};

export function Dot({ color, className = "" }: { color: string; className?: string }) {
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`} style={{ background: color }} />;
}

/** שלד טעינה במקום ספינר */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}

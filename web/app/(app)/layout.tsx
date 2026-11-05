import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";
import BottomNav, { TopNav } from "./BottomNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="app-glow min-h-screen pb-28 md:pb-12">
      <header className="sticky top-0 z-20 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight text-paper">Lead Finder</span>
          </span>
          <TopNav />
          <div className="flex items-center gap-2">
            <span
              className="hidden truncate text-xs text-slate-500 lg:block lg:max-w-[180px]"
              title={user.email || ""}
            >
              {user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
        <div className="h-px bg-line" />
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
      <BottomNav />
    </div>
  );
}

/** שכבות, כמו הלוגו של הרפרנס: שלושה מעוינים בגווני פנינה */
function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden className="shrink-0">
      <path d="M13 3 23 8 13 13 3 8Z" fill="#c4ccff" />
      <path d="M3 12.5 13 17.5 23 12.5" fill="none" stroke="#5b6bc2" strokeWidth="1.8" strokeLinejoin="round" opacity=".8" />
      <path d="M3 17 13 22 23 17" fill="none" stroke="#e8996b" strokeWidth="1.8" strokeLinejoin="round" opacity=".6" />
    </svg>
  );
}

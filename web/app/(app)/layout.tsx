import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";

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
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-1.5 text-brand hover:bg-brand/10"
            >
              לידים
            </Link>
            <Link
              href="/search"
              className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            >
              חיפוש חדש
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <span
              className="hidden truncate text-xs text-slate-500 sm:block sm:max-w-[160px]"
              title={user.email || ""}
            >
              {user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-4">{children}</div>
    </div>
  );
}

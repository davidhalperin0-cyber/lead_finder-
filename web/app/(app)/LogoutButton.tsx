"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-full border border-line px-3.5 py-1.5 text-xs text-slate-600 transition-colors hover:border-slate-300 hover:text-paper"
      aria-label="התנתקות"
    >
      התנתקות
    </button>
  );
}

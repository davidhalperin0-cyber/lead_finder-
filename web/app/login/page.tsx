"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const field =
    "w-full rounded-xl border border-line bg-white px-3.5 py-3 text-left text-paper transition-colors";

  return (
    <main className="app-glow flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="chip mb-5">מערכת הלידים של Halperin Designs</span>
          <h1 className="title-fade text-5xl">Lead Finder</h1>
          <p className="mt-3 text-sm text-slate-600">התחברי עם המייל והסיסמה שקיבלת</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-line bg-white p-6 shadow-xl">
          <div>
            <label className="mb-1.5 block text-sm text-slate-600" htmlFor="email">מייל</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-slate-600" htmlFor="password">סיסמה</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className={field}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <button type="submit" disabled={loading} className="btn-pearl w-full py-3 disabled:opacity-50">
            {loading ? "מתחברת…" : "כניסה"}
          </button>
        </form>
      </div>
    </main>
  );
}

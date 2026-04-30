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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg border border-slate-200">
        <h1 className="text-xl font-bold text-brand mb-1">Lead Finder</h1>
        <p className="text-sm text-slate-600 mb-6">התחברות (מייל + סיסמה מ-Supabase Auth)</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">מייל</label>
            <input
              type="email"
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-left"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">סיסמה</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-left"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "מתחבר…" : "כניסה"}
          </button>
        </form>
      </div>
    </main>
  );
}

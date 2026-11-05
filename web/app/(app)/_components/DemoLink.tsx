"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";

function waNumber(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "972" + d.slice(1);
  return d.length >= 11 ? d : "";
}

/**
 * דוגמת אתר לליד: דף אמיתי מנתוני הגוגל של העסק.
 * שולחים רק אחרי שיחה שבה הסכימו לראות (חוק הספאם).
 */
export default function DemoLink({
  leadId,
  name,
  phone,
  hasDemo,
}: {
  leadId: string;
  name: string;
  phone: string;
  hasDemo: boolean;
}) {
  const [ready, setReady] = useState(hasDemo);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}/demo/${leadId}` : `/demo/${leadId}`;
  const wa = waNumber(phone);
  const message = `היי, כמו שדיברנו — הכנו לכם טיוטה של איך האתר של ${name} יכול להיראות:\n${url}`;

  async function create(force = false) {
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("אין סשן — התחברי מחדש");
      await apiFetch(`/api/leads/${leadId}/demo${force ? "?force=true" : ""}`, session.access_token, { method: "POST" });
      setReady(true);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      try {
        setErr(JSON.parse(raw)?.detail || raw);
      } catch {
        setErr(raw);
      }
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="border-t border-line px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-paper">דוגמת אתר לעסק</p>
        {!ready && (
          <button
            type="button"
            onClick={() => create()}
            disabled={busy}
            className="rounded-full border border-line px-4 py-1.5 text-xs text-slate-800 hover:text-paper disabled:opacity-50"
          >
            {busy ? "מכינה… כ-10 שניות" : "צרי דוגמה"}
          </button>
        )}
      </div>
      {err && <p className="mt-1 text-xs text-rose-700">{err}</p>}
      {ready && (
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-3.5 py-1.5 text-xs text-slate-800 hover:text-paper">
            לפתוח
          </a>
          <button type="button" onClick={copy} className="rounded-full border border-line px-3.5 py-1.5 text-xs text-slate-800 hover:text-paper">
            {copied ? "הועתק" : "להעתיק קישור"}
          </button>
          {wa && (
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-emerald-300 px-3.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
            >
              לשלוח בוואטסאפ
            </a>
          )}
          <button type="button" onClick={() => create(true)} disabled={busy} className="text-xs text-slate-400 underline">
            {busy ? "מכינה…" : "לבנות מחדש"}
          </button>
        </div>
      )}
      {ready && <p className="mt-1.5 text-[11px] text-slate-500">שולחים רק אחרי שיחה שבה אמרו שמעניין אותם לראות.</p>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";

export type CallBrief = {
  snapshot: string;
  customers_love: { point: string; quote: string }[];
  angle: string;
  product: string;
  product_label: string;
  from_price: number;
  product_why: string;
  best_time: string;
  before_dial: string[];
  opener: string;
  reason: string;
  questions: string[];
  small_ask: string;
  meeting_ask: string;
  objections: { they_say: string; you_say: string }[];
  watch_out: string[];
  warnings?: string[];
  v?: number;
  facts_used?: { reviews: number; has_hours: boolean; google_matched: boolean };
};

// חייב להתאים ל-BRIEF_VERSION ב-call_brief.py. כרטיס ישן נבנה מחדש.
const BRIEF_VERSION = 2;

// הכנה שכבר בדרך (הכנה מראש במסך החיוג + פתיחת הליד) — לא משלמים עליה פעמיים
const inflight = new Map<string, Promise<CallBrief>>();

/** בונה (או מחזיר מהשמור) את כרטיס ההכנה לליד. */
export function fetchCallBrief(leadId: string, force = false): Promise<CallBrief> {
  if (force) return requestCallBrief(leadId, true);
  let p = inflight.get(leadId);
  if (!p) {
    p = requestCallBrief(leadId, false).finally(() => inflight.delete(leadId));
    inflight.set(leadId, p);
  }
  return p;
}

async function requestCallBrief(leadId: string, force: boolean): Promise<CallBrief> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("אין סשן — התחברי מחדש");
  return apiFetch<CallBrief>(
    `/api/leads/${leadId}/call-brief${force ? "?force=true" : ""}`,
    session.access_token,
    { method: "POST" }
  );
}

function errorText(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  try {
    const j = JSON.parse(raw);
    if (typeof j?.detail === "string") return j.detail;
  } catch {
    /* לא JSON */
  }
  return raw || "שגיאה";
}

function Line({ n, title, text }: { n: number; title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-xs tabular-nums text-slate-500">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{title}</p>
        <p className="mt-0.5 text-base leading-relaxed text-paper">{text}</p>
      </div>
    </div>
  );
}

export default function CallBriefCard({
  leadId,
  initial,
}: {
  leadId: string;
  initial?: CallBrief | null;
}) {
  const ready = initial && initial.v === BRIEF_VERSION ? initial : null;
  const [brief, setBrief] = useState<CallBrief | null>(ready);
  const [loading, setLoading] = useState(!ready);
  const [err, setErr] = useState<string | null>(null);

  async function load(force = false) {
    setLoading(true);
    setErr(null);
    try {
      setBrief(await fetchCallBrief(leadId, force));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready) {
      setBrief(ready);
      setLoading(false);
      return;
    }
    setBrief(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  if (loading) {
    return (
      <div className="space-y-3 p-5" aria-busy="true">
        <p className="text-sm text-slate-700">מכינה לך את השיחה…</p>
        <p className="text-xs text-slate-500">קוראת ביקורות ובונה תסריט לעסק הזה. עד דקה, ובפעם הבאה זה כבר יחכה מוכן.</p>
        <span className="block h-3 w-3/4 animate-pulse rounded bg-slate-100" />
        <span className="block h-3 w-1/2 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }
  if (err || !brief) {
    return (
      <div className="p-5">
        <p className="text-sm text-rose-700">לא הצלחתי להכין את השיחה</p>
        <p className="mt-1 text-xs text-slate-500">{err}</p>
        <button type="button" onClick={() => load()} className="mt-3 rounded-full border border-line px-4 py-2 text-xs text-slate-700 hover:text-paper">
          לנסות שוב
        </button>
      </div>
    );
  }

  const b = brief;
  return (
    <div>
      {/* מי הם */}
      <div className="space-y-2.5 border-b border-line p-5">
        {b.angle && <p className="text-[17px] leading-snug text-paper">{b.angle}</p>}
        {b.snapshot && <p className="text-sm leading-relaxed text-slate-600">{b.snapshot}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="chip">
            {b.product_label} · מ-{b.from_price.toLocaleString("he-IL")} ₪
          </span>
          {b.best_time && <span className="chip">{b.best_time}</span>}
        </div>
        {b.customers_love.length > 0 && (
          <p className="text-xs leading-relaxed text-slate-500">
            מה כותבים עליהם: {b.customers_love.map((c) => `"${c.quote}"`).join(" · ")}
          </p>
        )}
      </div>

      {/* התסריט */}
      <div className="space-y-4 p-5">
        <Line n={1} title="פתיחה" text={b.opener} />
        <Line n={2} title="למה התקשרתי" text={b.reason} />
        <Line n={3} title="לשאול ולשתוק" text={b.questions.join(" / ")} />
        <Line n={4} title="בקשה קטנה" text={b.small_ask} />
        <Line n={5} title="שיחה עם דוד" text={b.meeting_ask} />
      </div>

      {b.objections.length > 0 && (
        <div className="border-t border-line">
          {b.objections.map((o, i) => (
            <details key={i} className="group border-b border-line last:border-b-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm text-slate-800 hover:text-paper">
                <span>אם אומרים: &ldquo;{o.they_say}&rdquo;</span>
                <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed text-slate-700">{o.you_say}</p>
            </details>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
        <p className="text-xs text-slate-500">
          {b.watch_out[0] || ""}
          {(b.warnings || []).length > 0 && <span className="text-rose-700"> {(b.warnings || []).join(" · ")}</span>}
        </p>
        <button type="button" onClick={() => load(true)} className="text-xs text-slate-500 hover:text-paper">
          להכין מחדש
        </button>
      </div>
    </div>
  );
}

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
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
        {n}
      </span>
      <div>
        <p className="text-[11px] font-bold text-emerald-800">{title}</p>
        <p className="text-base leading-snug text-slate-900">{text}</p>
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
      <div className="border-b border-slate-100 bg-slate-50 p-5 text-center">
        <p className="text-sm font-semibold text-slate-700">מכינה לך את השיחה…</p>
        <p className="mt-1 text-xs text-slate-500">קוראת ביקורות ובונה תסריט לעסק הזה. עד דקה — בפעם הבאה זה כבר יחכה מוכן.</p>
      </div>
    );
  }
  if (err || !brief) {
    return (
      <div className="border-b border-rose-100 bg-rose-50 p-4">
        <p className="text-sm font-semibold text-rose-900">לא הצלחתי להכין את השיחה</p>
        <p className="mt-1 text-xs text-rose-800">{err}</p>
        <button
          type="button"
          onClick={() => load()}
          className="mt-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white"
        >
          לנסות שוב
        </button>
      </div>
    );
  }

  const b = brief;
  return (
    <div>
      {/* מי הם — שלוש שורות */}
      <div className="space-y-1.5 border-b border-amber-100 bg-amber-50 px-4 py-3">
        {b.snapshot && <p className="text-sm text-slate-800">{b.snapshot}</p>}
        {b.angle && <p className="text-sm font-bold text-slate-900">💡 {b.angle}</p>}
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">{b.product_label}</span>
          {" "}(מ-{b.from_price.toLocaleString("he-IL")} ₪)
          {b.best_time && <> · ⏰ {b.best_time}</>}
        </p>
        {b.customers_love.length > 0 && (
          <p className="text-xs text-slate-600">
            ❤️ {b.customers_love.map((c) => `"${c.quote}"`).join(" · ")}
          </p>
        )}
      </div>

      {/* התסריט */}
      <div className="space-y-3 p-4">
        <Line n={1} title="פתיחה" text={b.opener} />
        <Line n={2} title="למה התקשרתי" text={b.reason} />
        <Line n={3} title="לשאול ולשתוק" text={b.questions.join(" / ")} />
        <Line n={4} title="בקשה קטנה" text={b.small_ask} />
        <Line n={5} title="שיחה עם דוד" text={b.meeting_ask} />

        {b.objections.length > 0 && (
          <div className="space-y-1 pt-1">
            {b.objections.map((o, i) => (
              <details key={i} className="rounded-lg border border-amber-200 bg-white">
                <summary className="cursor-pointer px-3 py-1.5 text-sm font-semibold text-amber-900">
                  אם אומרים: &ldquo;{o.they_say}&rdquo;
                </summary>
                <p className="px-3 pb-2 text-sm text-slate-800">{o.you_say}</p>
              </details>
            ))}
          </div>
        )}

        {b.watch_out.length > 0 && <p className="text-xs text-slate-600">⚠️ {b.watch_out[0]}</p>}
        {(b.warnings || []).length > 0 && (
          <p className="text-xs text-rose-700">{(b.warnings || []).join(" · ")}</p>
        )}

        <button type="button" onClick={() => load(true)} className="text-xs text-slate-400 underline">
          להכין מחדש
        </button>
      </div>
    </div>
  );
}

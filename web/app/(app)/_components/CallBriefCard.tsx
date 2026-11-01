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
  facts_used?: { reviews: number; has_hours: boolean; google_matched: boolean };
};

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

const STAGES: { key: "opener" | "reason" | "small_ask" | "meeting_ask"; title: string; hint: string }[] = [
  { key: "opener", title: "1. פתיחה", hint: "מתחילים מהם, לא מאיתנו. מבקשים 30 שניות." },
  { key: "reason", title: "2. למה התקשרתי", hint: "מספרים על הבעיה שלהם, לא על המוצר שלנו." },
  { key: "small_ask", title: "4. בקשה קטנה", hint: "קודם 'שווה לכם לראות?', ורק אחר כך פגישה." },
  { key: "meeting_ask", title: "5. קביעת שיחה עם דוד", hint: "שתי אפשרויות זמן. לא שאלת כן או לא." },
];

function Stage({ title, hint, text }: { title: string; hint: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-bold text-emerald-800">{title}</p>
      <p className="mb-1 text-[11px] text-slate-500">{hint}</p>
      <p className="rounded-lg bg-white p-3 text-[15px] leading-relaxed text-slate-900">{text}</p>
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
  const [brief, setBrief] = useState<CallBrief | null>(initial || null);
  const [loading, setLoading] = useState(!initial);
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
    if (initial) {
      setBrief(initial);
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
      {/* הכנה — לקרוא לפני שמחייגים */}
      <div className="space-y-3 border-b border-amber-100 bg-amber-50 p-4">
        <p className="text-xs font-bold text-amber-800">🧭 לפני שמחייגים — 30 שניות</p>
        {b.snapshot && <p className="text-sm leading-relaxed text-slate-900">{b.snapshot}</p>}

        {b.customers_love.length > 0 && (
          <div>
            <p className="text-xs font-bold text-amber-800">מה הלקוחות שלהם אוהבים</p>
            <ul className="mt-1 space-y-1">
              {b.customers_love.map((c, i) => (
                <li key={i} className="text-sm text-slate-800">
                  {c.point} <span className="text-slate-500">— &ldquo;{c.quote}&rdquo;</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {b.angle && (
          <div className="rounded-lg bg-white p-3">
            <p className="text-xs font-bold text-amber-800">💡 הזווית</p>
            <p className="text-sm font-medium text-slate-900">{b.angle}</p>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg bg-white p-3">
            <p className="text-xs font-bold text-amber-800">מה להציע</p>
            <p className="text-sm font-semibold text-slate-900">
              {b.product_label}{" "}
              <span className="font-normal text-slate-500">
                (החל מ-{b.from_price.toLocaleString("he-IL")} ₪)
              </span>
            </p>
            {b.product_why && <p className="mt-0.5 text-xs text-slate-600">{b.product_why}</p>}
          </div>
          {b.best_time && (
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs font-bold text-amber-800">⏰ מתי להתקשר</p>
              <p className="text-sm text-slate-800">{b.best_time}</p>
            </div>
          )}
        </div>

        {b.before_dial.length > 0 && (
          <ul className="space-y-1">
            {b.before_dial.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-800">
                <span className="text-amber-600">☐</span>
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* התסריט — לפי סדר השיחה */}
      <div className="space-y-3 bg-emerald-50/60 p-4">
        <p className="text-xs font-bold text-emerald-800">🎤 התסריט — לא לקרוא מילה במילה, להגיד במילים שלך</p>
        <Stage {...STAGES[0]} text={b.opener} />
        <Stage {...STAGES[1]} text={b.reason} />
        {b.questions.length > 0 && (
          <div>
            <p className="text-xs font-bold text-emerald-800">3. שאלות</p>
            <p className="mb-1 text-[11px] text-slate-500">שואלים, ואז שותקים ונותנים להם לדבר.</p>
            <ul className="space-y-1.5">
              {b.questions.map((q, i) => (
                <li key={i} className="rounded-lg bg-white p-3 text-[15px] text-slate-900">
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Stage {...STAGES[2]} text={b.small_ask} />
        <Stage {...STAGES[3]} text={b.meeting_ask} />

        {b.objections.length > 0 && (
          <div>
            <p className="text-xs font-bold text-amber-700">⚠️ אם אומרים לך…</p>
            <p className="mb-1 text-[11px] text-slate-500">מסכימה, שואלת, מציעה הצצה. לא מתווכחת.</p>
            <div className="space-y-1.5">
              {b.objections.map((o, i) => (
                <details key={i} className="rounded-lg border border-amber-200 bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-amber-900">
                    &ldquo;{o.they_say}&rdquo;
                  </summary>
                  <p className="px-3 pb-3 text-sm text-slate-800">{o.you_say}</p>
                </details>
              ))}
            </div>
          </div>
        )}

        {b.watch_out.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold text-slate-700">שימי לב בשיחה הזאת</p>
            <ul className="mt-1 list-disc space-y-0.5 pr-4 text-sm text-slate-800">
              {b.watch_out.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {(b.warnings || []).length > 0 && (
          <p className="text-xs text-rose-700">{(b.warnings || []).join(" · ")}</p>
        )}

        <button
          type="button"
          onClick={() => load(true)}
          className="text-xs text-slate-500 underline"
        >
          להכין מחדש
        </button>
      </div>
    </div>
  );
}

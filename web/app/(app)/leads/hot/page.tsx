"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { quickStatus } from "../../_components/useLeads";

type Lead = Record<string, unknown> & { id: string };

/**
 * נוסחת "ציון חום":
 * חום = match*0.45 + opportunity*0.35 + (100-recencyDays*5)*0.10 + (no_website?20:0) + (close_probability)*0.10
 * הרעיון: לידים שמתאימים לתיאור, יש להם הזדמנות גדולה, חדשים, בלי אתר - חמים יותר.
 */
function hotScore(L: Record<string, unknown>): number {
  const match = Number(L.match_score || 0);
  const opp = Number(L.opportunity_score || 0);
  const close = Number(L.close_probability || 0);
  const noSite = L.no_website ? 20 : 0;
  // ימים מאז יצירה
  let recencyBonus = 0;
  const created = String(L.created_at || L.last_analyzed_at || "");
  if (created) {
    const days = (Date.now() - new Date(created).getTime()) / (1000 * 60 * 60 * 24);
    recencyBonus = Math.max(0, 100 - days * 5);
  }
  const status = String(L.status || "");
  const statusPenalty =
    status === "won" || status === "lost" || status === "not_interested" ? -200 : 0;
  return match * 0.45 + opp * 0.35 + recencyBonus * 0.1 + noSite + close * 0.1 + statusPenalty;
}

function flameLevel(score: number): { emoji: string; label: string; color: string } {
  if (score >= 80) return { emoji: "🔥🔥🔥", label: "לוהט", color: "from-rose-500 to-orange-500" };
  if (score >= 60) return { emoji: "🔥🔥", label: "חם", color: "from-orange-500 to-amber-500" };
  if (score >= 40) return { emoji: "🔥", label: "פושר", color: "from-amber-500 to-yellow-500" };
  return { emoji: "💨", label: "צונן", color: "from-slate-400 to-slate-500" };
}

function telHref(phone: string): string | null {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length < 9) return null;
  if (d.startsWith("972")) return `tel:+${d}`;
  if (d.startsWith("0")) return `tel:+972${d.slice(1)}`;
  return `tel:+${d}`;
}

export default function HotLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("leads")
      .select("*")
      .in("status", ["new", "in_progress", "interested", "follow_up"])
      .limit(200);
    setLeads((data as Lead[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const ranked = useMemo(() => {
    return leads
      .map((L) => ({ ...L, _hot: hotScore(L) } as Lead & { _hot: number }))
      .sort((a, b) => b._hot - a._hot)
      .slice(0, 25);
  }, [leads]);

  async function markHot(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      await quickStatus(id, "hot");
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 pb-6 animate-fadeIn">
      {/* כותרת */}
      <header className="rounded-2xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 p-5 text-white shadow-hot">
        <div className="flex items-center gap-3">
          <span className="text-4xl animate-float">🔥</span>
          <div>
            <h1 className="text-2xl font-bold">לידים חמים</h1>
            <p className="text-sm opacity-90">25 הלידים השווים ביותר — מסודרים אוטומטית</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Link
            href="/call-mode"
            className="flex-1 rounded-xl bg-white/20 hover:bg-white/30 px-4 py-2.5 text-center text-sm font-bold backdrop-blur btn-pop"
          >
            📞 התחל מצב חיוג
          </Link>
          <button
            onClick={load}
            className="rounded-xl bg-white/20 hover:bg-white/30 px-4 py-2.5 text-sm font-bold backdrop-blur btn-pop"
          >
            🔄
          </button>
        </div>
      </header>

      {loading && <p className="text-sm text-slate-500 text-center">טוען…</p>}

      {!loading && ranked.length === 0 && (
        <div className="card-elevated p-8 text-center">
          <p className="text-3xl mb-2">😴</p>
          <p className="font-bold text-slate-800">אין לידים פתוחים</p>
          <p className="text-sm text-slate-500 mt-1">צריך לחפש כמה!</p>
          <Link
            href="/search"
            className="mt-4 inline-block rounded-xl bg-gradient-brand text-white px-5 py-2 text-sm font-bold btn-pop"
          >
            חיפוש חדש
          </Link>
        </div>
      )}

      <ol className="space-y-3">
        {ranked.map((L, idx) => {
          const score = Number(L._hot || 0);
          const flame = flameLevel(score);
          const phone = String(L.phone || "");
          const tel = telHref(phone);
          const status = String(L.status || "new");
          const noSite = Boolean(L.no_website);
          return (
            <li
              key={L.id}
              className="animate-slideUp"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <div className="card-elevated overflow-hidden">
                {/* פס צבעוני עליון לפי דרגה */}
                <div className={`h-1.5 bg-gradient-to-r ${flame.color}`} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/leads/${L.id}`}
                        className="block font-bold text-slate-900 hover:text-brand transition truncate"
                      >
                        <span className="text-slate-400 ml-1">#{idx + 1}</span>
                        {String(L.business_name || "ללא שם")}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {String(L.search_city || "")}{" "}
                        {L.search_business_type ? "· " + L.search_business_type : ""}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full bg-gradient-to-r ${flame.color} px-2.5 py-0.5 text-xs font-bold text-white`}
                      >
                        {flame.emoji} {flame.label}
                      </span>
                      {noSite && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          🔥 בלי אתר
                        </span>
                      )}
                    </div>
                  </div>

                  {/* פס מטריקות */}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-blue-50 py-1.5">
                      <div className="text-xs text-blue-700">התאמה</div>
                      <div className="text-sm font-bold text-blue-900">
                        {Number(L.match_score || 0)}%
                      </div>
                    </div>
                    <div className="rounded-lg bg-purple-50 py-1.5">
                      <div className="text-xs text-purple-700">הזדמנות</div>
                      <div className="text-sm font-bold text-purple-900">
                        {Number(L.opportunity_score || 0)}%
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 py-1.5">
                      <div className="text-xs text-emerald-700">סגירה</div>
                      <div className="text-sm font-bold text-emerald-900">
                        {Number(L.close_probability || 0)}%
                      </div>
                    </div>
                  </div>

                  {String(L.strongest_problem || "") && (
                    <p className="mt-3 text-sm text-slate-700 line-clamp-2 bg-slate-50 rounded-lg px-3 py-2">
                      <span className="font-semibold text-slate-600">הזווית: </span>
                      {String(L.strongest_problem)}
                    </p>
                  )}

                  {/* פעולות */}
                  <div className="mt-3 flex gap-2">
                    {tel && (
                      <a
                        href={tel}
                        className="flex-1 rounded-xl bg-gradient-success py-2.5 text-center text-sm font-bold text-white btn-pop shadow-md"
                      >
                        📞 חיוג
                      </a>
                    )}
                    {status !== "interested" && (
                      <button
                        onClick={() => markHot(L.id)}
                        disabled={busy === L.id}
                        className="rounded-xl bg-gradient-hot px-4 py-2.5 text-sm font-bold text-white btn-pop disabled:opacity-50"
                      >
                        🔥 מעניין
                      </button>
                    )}
                    <Link
                      href={`/leads/${L.id}`}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                    >
                      פרטים
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { quickStatus, logActivity } from "../../_components/useLeads";
import { TrustBadgeSmall } from "../../_components/TrustBadge";
import { Icon, PageHeader, Skeleton, btn } from "../../_components/ui";

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

function heat(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "לוהט", color: "#e11d48" };
  if (score >= 60) return { label: "חם", color: "#ea580c" };
  if (score >= 40) return { label: "פושר", color: "#ca8a04" };
  return { label: "צונן", color: "#71717a" };
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
    // רק לידים שעדיין לא נסגרו - מתעניינים/מעקב יש להם עמודים משלהם
    const { data } = await supabase
      .from("leads")
      .select("*")
      .in("status", ["new", "in_progress"])
      .limit(200);
    setLeads((data as Lead[]) || []);
    setLoading(false);
  }

  // הסרה מקומית מהמסך - בלי להמתין לרענון מהשרת
  function removeFromList(id: string) {
    setLeads((curr) => curr.filter((L) => L.id !== id));
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

  async function markInterested(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      await logActivity(id, { activity_type: "call", outcome: "interested" });
      await quickStatus(id, "interested");
      removeFromList(id);
    } finally {
      setBusy(null);
    }
  }

  async function markNoAnswer(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      await logActivity(id, { activity_type: "call", outcome: "no_answer" });
      // לא משנה סטטוס - רק מסיר מהרשימה הנוכחית כדי שלא נחזור אליו
      removeFromList(id);
    } finally {
      setBusy(null);
    }
  }

  async function markNotInterested(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      await logActivity(id, { activity_type: "call", outcome: "not_interested" });
      await quickStatus(id, "not_interested");
      removeFromList(id);
    } finally {
      setBusy(null);
    }
  }

  const outcome = "rounded-full border border-line px-3 py-2 text-xs transition-colors disabled:opacity-40";

  return (
    <div className="pb-6 animate-fadeIn">
      <PageHeader title="לידים חמים" subtitle="25 הלידים עם הסיכוי הכי גבוה, מסודרים לפי חום">
        <button type="button" onClick={load} className={btn.ghost} aria-label="רענון הרשימה">
          <Icon name="refresh" />
        </button>
        <Link href="/call-mode" className={btn.primary}>
          <Icon name="phone" />
          מצב חיוג
        </Link>
      </PageHeader>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-[1.25rem]" />
          ))}
        </div>
      )}

      {!loading && ranked.length === 0 && (
        <div className="rounded-[1.25rem] border border-line bg-white p-10 text-center">
          <p className="text-lg font-light text-paper">אין כרגע לידים פתוחים</p>
          <p className="mt-1 text-sm text-slate-600">חיפוש חדש יוסיף לידים לרשימה הזאת.</p>
          <Link href="/search" className={`${btn.primary} mt-5`}>
            <Icon name="search" />
            חיפוש לידים
          </Link>
        </div>
      )}

      <ol className="space-y-3">
        {ranked.map((L, idx) => {
          const h = heat(Number(L._hot || 0));
          const tel = telHref(String(L.phone || ""));
          const noSite = Boolean(L.no_website);
          const angle = String(L.strongest_problem || "");
          return (
            <li key={L.id} className="rounded-[1.25rem] border border-line bg-white p-5 shadow-soft">
              <div className="flex items-start gap-4">
                <span className="w-6 pt-1 text-sm tabular-nums text-slate-400">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link href={`/leads/${L.id}`} className="truncate text-[17px] font-medium text-paper hover:underline">
                      {String(L.business_name || "ללא שם")}
                    </Link>
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: h.color }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: h.color }} />
                      {h.label}
                    </span>
                    {noSite && <span className="chip">בלי אתר</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {[L.search_city, L.search_business_type].filter(Boolean).map(String).join(" · ")}
                  </p>
                  <div className="mt-2">
                    <TrustBadgeSmall lead={L} />
                  </div>
                  <p className="mt-3 text-xs tabular-nums text-slate-600">
                    התאמה {Number(L.match_score || 0)}% · הזדמנות {Number(L.opportunity_score || 0)}% · סיכוי סגירה{" "}
                    {Number(L.close_probability || 0)}%
                  </p>
                  {angle && <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-slate-800">{angle}</p>}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {tel && (
                      <a href={tel} className={`${btn.primary} min-w-[8rem]`}>
                        <Icon name="phone" size={16} />
                        חיוג
                      </a>
                    )}
                    <span className="mx-1 hidden text-xs text-slate-400 sm:inline">אחרי השיחה:</span>
                    <button onClick={() => markInterested(L.id)} disabled={busy === L.id} className={`${outcome} text-emerald-700 hover:border-emerald-300`}>
                      מעוניין
                    </button>
                    <button onClick={() => markNoAnswer(L.id)} disabled={busy === L.id} className={`${outcome} text-slate-700 hover:border-slate-400`}>
                      לא ענה
                    </button>
                    <button onClick={() => markNotInterested(L.id)} disabled={busy === L.id} className={`${outcome} text-rose-700 hover:border-rose-300`}>
                      לא מעוניין
                    </button>
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

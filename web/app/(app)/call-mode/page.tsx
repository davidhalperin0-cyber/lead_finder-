"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { quickStatus, patchLead, logActivity } from "../_components/useLeads";

type Lead = Record<string, unknown> & { id: string };

function hotScore(L: Record<string, unknown>): number {
  const match = Number(L.match_score || 0);
  const opp = Number(L.opportunity_score || 0);
  const close = Number(L.close_probability || 0);
  const noSite = L.no_website ? 20 : 0;
  let recency = 0;
  const created = String(L.created_at || L.last_analyzed_at || "");
  if (created) {
    const days = (Date.now() - new Date(created).getTime()) / (1000 * 60 * 60 * 24);
    recency = Math.max(0, 100 - days * 5);
  }
  return match * 0.45 + opp * 0.35 + recency * 0.1 + noSite + close * 0.1;
}

function telHref(phone: string): string | null {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length < 9) return null;
  if (d.startsWith("972")) return `tel:+${d}`;
  if (d.startsWith("0")) return `tel:+972${d.slice(1)}`;
  return `tel:+${d}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function CallModePage() {
  const [queue, setQueue] = useState<Lead[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState({ done: 0, interested: 0, no_answer: 0 });
  const [postpone, setPostpone] = useState(false);
  const [postponeDate, setPostponeDate] = useState("");
  const [showScript, setShowScript] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("leads")
      .select("*")
      .in("status", ["new", "in_progress", "follow_up"])
      .limit(200);
    const list = (data as Lead[]) || [];
    // מסנן לידים עם טלפון בלבד, ממיין לפי חום
    const ranked = list
      .filter((L) => String(L.phone || "").trim().length >= 9)
      .map((L) => ({ ...L, _hot: hotScore(L) }))
      .sort((a, b) => Number(b._hot) - Number(a._hot));
    setQueue(ranked);
    setIdx(0);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const current = queue[idx];
  const remaining = Math.max(0, queue.length - idx);
  const phone = String(current?.phone || "");
  const tel = telHref(phone);

  function nextLead() {
    setShowScript(false);
    setPostpone(false);
    setPostponeDate("");
    if (idx + 1 >= queue.length) {
      // סיום!
      setIdx(queue.length);
    } else {
      setIdx(idx + 1);
    }
  }

  async function markInterested() {
    if (!current || busy) return;
    setBusy(true);
    try {
      await logActivity(current.id, { activity_type: "call", outcome: "interested" });
      await quickStatus(current.id, "interested");
      setStats((s) => ({ ...s, done: s.done + 1, interested: s.interested + 1 }));
      nextLead();
    } finally {
      setBusy(false);
    }
  }

  async function markNoAnswer() {
    if (!current || busy) return;
    setBusy(true);
    try {
      await logActivity(current.id, { activity_type: "call", outcome: "no_answer" });
      setStats((s) => ({ ...s, done: s.done + 1, no_answer: s.no_answer + 1 }));
      nextLead();
    } finally {
      setBusy(false);
    }
  }

  async function markNotInterested() {
    if (!current || busy) return;
    setBusy(true);
    try {
      await logActivity(current.id, { activity_type: "call", outcome: "not_interested" });
      await quickStatus(current.id, "not_interested");
      setStats((s) => ({ ...s, done: s.done + 1 }));
      nextLead();
    } finally {
      setBusy(false);
    }
  }

  async function applyPostpone() {
    if (!current || busy || !postponeDate) return;
    setBusy(true);
    try {
      await patchLead(current.id, {
        status: "follow_up",
        follow_up_date: postponeDate,
      });
      setStats((s) => ({ ...s, done: s.done + 1 }));
      nextLead();
    } finally {
      setBusy(false);
    }
  }

  // ====== מסכים ======
  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-slate-500">טוען לידים...</p>
      </div>
    );
  }

  // אין מי לחייג
  if (queue.length === 0) {
    return (
      <div className="card-elevated p-8 text-center mt-8 animate-fadeIn">
        <p className="text-5xl mb-3">📞</p>
        <h1 className="text-xl font-bold">אין לידים לחיוג</h1>
        <p className="text-sm text-slate-500 mt-2">
          אין לידים פעילים עם טלפון. בואי נחפש כמה!
        </p>
        <Link
          href="/search"
          className="mt-4 inline-block rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white btn-pop"
        >
          🔍 חיפוש חדש
        </Link>
      </div>
    );
  }

  // סיימנו את כל התור
  if (idx >= queue.length) {
    return (
      <div className="card-elevated p-8 text-center mt-8 animate-scaleIn">
        <p className="text-6xl mb-3">🎉</p>
        <h1 className="text-2xl font-bold text-emerald-700">סיימת את כל הלידים!</h1>
        <p className="text-sm text-slate-600 mt-2">כל הכבוד 💪</p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-blue-50 p-3">
            <div className="text-2xl font-bold text-blue-700">{stats.done}</div>
            <div className="text-xs text-blue-700">שיחות</div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="text-2xl font-bold text-emerald-700">{stats.interested}</div>
            <div className="text-xs text-emerald-700">מתעניינים</div>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <div className="text-2xl font-bold text-amber-700">{stats.no_answer}</div>
            <div className="text-xs text-amber-700">לא ענו</div>
          </div>
        </div>
        <button
          onClick={load}
          className="mt-6 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white btn-pop"
        >
          🔄 רענן וחזור
        </button>
      </div>
    );
  }

  // מסך החיוג הראשי
  const opening = String(current?.opening_line || current?.best_talking_point || "").trim();
  const scriptIntro = String(current?.script_intro || "").trim();
  const discovery = (current?.script_discovery as string[]) || [];
  const valuePitch = String(current?.script_value_pitch || "").trim();
  const offer = String(current?.script_offer || "").trim();
  const close = String(current?.script_close || "").trim();
  const objections = (current?.script_objections as Record<string, string>) || {};
  const hasFullScript = Boolean(scriptIntro || discovery.length || valuePitch);

  return (
    <div className="space-y-3 pb-6 animate-fadeIn">
      {/* פס התקדמות */}
      <div className="rounded-2xl bg-gradient-brand p-4 text-white shadow-soft">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">📞 מצב חיוג</span>
          <span className="opacity-90">
            {idx + 1} / {queue.length}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{ width: `${((idx + 1) / queue.length) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs opacity-90">
          <span>🔥 {stats.interested} מעוניינים</span>
          <span>📵 {stats.no_answer} לא ענו</span>
          <span>נשארו {remaining}</span>
        </div>
      </div>

      {/* כרטיס הליד הנוכחי */}
      <div className="card-elevated overflow-hidden animate-scaleIn">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 border-b border-blue-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">
                {String(current.business_name || "ללא שם")}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {String(current.search_city || "")}
                {current.search_business_type ? " · " + current.search_business_type : ""}
              </p>
            </div>
            {Boolean(current.no_website) && (
              <span className="shrink-0 rounded-lg bg-amber-200 px-2 py-1 text-xs font-bold text-amber-900">
                🔥 בלי אתר
              </span>
            )}
          </div>
          <p className="mt-3 text-2xl font-bold text-emerald-700 tracking-wider">
            📞 {phone}
          </p>
        </div>

        {/* הזווית לשיחה */}
        {String(current.strongest_problem || "") && (
          <div className="bg-amber-50 border-b border-amber-100 p-4">
            <p className="text-xs font-bold text-amber-800 mb-1">💡 הזווית</p>
            <p className="text-sm text-amber-900 leading-relaxed">
              {String(current.strongest_problem)}
            </p>
          </div>
        )}

        {/* משפט פתיחה גדול */}
        {opening && (
          <div className="p-4 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 mb-1">🎤 איך לפתוח</p>
            <p className="text-base font-medium text-slate-800 leading-relaxed">
              &ldquo;{opening}&rdquo;
            </p>
          </div>
        )}

        {/* קישור לתסריט המלא */}
        {hasFullScript && (
          <button
            onClick={() => setShowScript(!showScript)}
            className="w-full bg-emerald-50 hover:bg-emerald-100 transition px-4 py-3 text-right text-sm font-bold text-emerald-700"
          >
            {showScript ? "↑ סגירת התסריט" : "📖 פתיחת התסריט המלא ↓"}
          </button>
        )}

        {/* תסריט מורחב */}
        {showScript && hasFullScript && (
          <div className="bg-emerald-50/50 p-4 space-y-3 animate-slideUp">
            {scriptIntro && (
              <div>
                <p className="text-xs font-bold text-emerald-700 mb-1">1. פתיחה</p>
                <p className="text-sm text-slate-800 bg-white rounded-lg p-3">{scriptIntro}</p>
              </div>
            )}
            {discovery.length > 0 && (
              <div>
                <p className="text-xs font-bold text-emerald-700 mb-1">2. שאלות</p>
                <ul className="space-y-1.5">
                  {discovery.map((q, i) => (
                    <li key={i} className="text-sm text-slate-800 bg-white rounded-lg p-3">
                      <span className="font-bold ml-1">{i + 1}.</span> {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {valuePitch && (
              <div>
                <p className="text-xs font-bold text-emerald-700 mb-1">3. הצגת ערך</p>
                <p className="text-sm text-slate-800 bg-white rounded-lg p-3">{valuePitch}</p>
              </div>
            )}
            {offer && (
              <div>
                <p className="text-xs font-bold text-emerald-700 mb-1">4. הצעה</p>
                <p className="text-sm text-slate-800 bg-white rounded-lg p-3">{offer}</p>
              </div>
            )}
            {close && (
              <div>
                <p className="text-xs font-bold text-emerald-700 mb-1">5. סגירה</p>
                <p className="text-sm font-semibold text-slate-800 bg-white rounded-lg p-3">
                  {close}
                </p>
              </div>
            )}
            {Object.keys(objections).length > 0 && (
              <div>
                <p className="text-xs font-bold text-amber-700 mb-1">⚠️ תשובות להתנגדויות</p>
                <div className="space-y-1.5">
                  {Object.entries(objections).map(([q, a], i) => (
                    <details key={i} className="bg-white rounded-lg border border-amber-200">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-amber-900">
                        &ldquo;{q}&rdquo;
                      </summary>
                      <p className="px-3 pb-3 text-sm text-slate-700">{a}</p>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* כפתור חיוג ענק */}
        {tel && (
          <a
            href={tel}
            className="block bg-gradient-success p-5 text-center text-white text-xl font-bold shadow-lg btn-pop animate-pulseGlow"
          >
            📞 חייגי עכשיו
          </a>
        )}

        {/* פאנל פעולות אחרי שיחה */}
        {!postpone ? (
          <div className="p-4 space-y-2 bg-slate-50">
            <p className="text-xs text-center font-bold text-slate-500 mb-1">
              איך הלכה השיחה?
            </p>
            <button
              onClick={markInterested}
              disabled={busy}
              className="w-full rounded-xl bg-gradient-success py-3 text-base font-bold text-white btn-pop disabled:opacity-50 shadow-md"
            >
              ✅ דיברתי + הוא מעוניין
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={markNoAnswer}
                disabled={busy}
                className="rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white btn-pop disabled:opacity-50"
              >
                📵 לא ענה
              </button>
              <button
                onClick={() => setPostpone(true)}
                disabled={busy}
                className="rounded-xl bg-blue-500 py-2.5 text-sm font-bold text-white btn-pop disabled:opacity-50"
              >
                📅 קבעתי לחזור
              </button>
            </div>
            <button
              onClick={markNotInterested}
              disabled={busy}
              className="w-full rounded-xl bg-rose-500 py-2.5 text-sm font-bold text-white btn-pop disabled:opacity-50"
            >
              ❌ לא מעוניין
            </button>
            <button
              onClick={nextLead}
              className="w-full rounded-xl border border-slate-300 py-2 text-sm text-slate-600 btn-pop"
            >
              ⏭️ דלגי בלי לעדכן
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-2 bg-blue-50">
            <p className="text-sm font-bold text-blue-900">📅 מתי לחזור?</p>
            <input
              type="date"
              value={postponeDate}
              onChange={(e) => setPostponeDate(e.target.value)}
              min={todayISO()}
              className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              {[
                { l: "מחר", d: 1 },
                { l: "+3 ימים", d: 3 },
                { l: "שבוע", d: 7 },
                { l: "2 שבועות", d: 14 },
              ].map((q) => (
                <button
                  key={q.d}
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + q.d);
                    setPostponeDate(d.toISOString().slice(0, 10));
                  }}
                  className="flex-1 rounded-lg bg-white border border-blue-200 py-1.5 text-xs font-semibold text-blue-700"
                >
                  {q.l}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPostpone(false)}
                className="flex-1 rounded-xl bg-slate-200 py-2 text-sm font-bold text-slate-700 btn-pop"
              >
                ביטול
              </button>
              <button
                onClick={applyPostpone}
                disabled={busy || !postponeDate}
                className="flex-1 rounded-xl bg-gradient-brand py-2 text-sm font-bold text-white btn-pop disabled:opacity-50"
              >
                שמור והבא ←
              </button>
            </div>
          </div>
        )}
      </div>

      {/* קישור פרטים מלאים */}
      <Link
        href={`/leads/${current.id}`}
        className="block text-center text-xs text-slate-500 underline"
      >
        פתיחת פרטים מלאים של הליד
      </Link>
    </div>
  );
}

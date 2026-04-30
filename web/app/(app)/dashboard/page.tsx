"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Lead = Record<string, unknown>;
type Job = {
  id: string;
  city: string;
  business_type: string;
  limit_n: number;
  status: "queued" | "running" | "completed" | "failed";
  progress_current: number;
  progress_total: number;
  found_count: number;
  analyzed_count: number;
  saved_count: number;
  error_count: number;
  error_message: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  new: "חדש",
  contacted: "התקשרתי",
  interested: "מתעניין",
  follow_up: "לעקוב",
  closed: "נסגר",
  not_relevant: "לא רלוונטי",
};

const STATUSES = Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[];

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [recentJob, setRecentJob] = useState<Job | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [city, setCity] = useState("");
  const [biz, setBiz] = useState("");
  const [minScore, setMinScore] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [hasPhone, setHasPhone] = useState(false);
  const [hasWa, setHasWa] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const lastJobStatusRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let q = supabase.from("leads").select("*").order("score", { ascending: false });
    if (city.trim()) q = q.ilike("search_city", `%${city.trim()}%`);
    if (biz.trim()) q = q.ilike("search_business_type", `%${biz.trim()}%`);
    if (minScore) q = q.gte("score", parseInt(minScore, 10));
    if (status) q = q.eq("status", status);
    if (priority) q = q.eq("priority_level", priority);
    const { data, error } = await q.limit(300);
    if (error) {
      console.error(error);
      setLeads([]);
    } else {
      let rows = data || [];
      if (hasPhone) rows = rows.filter((r) => (r.phone as string)?.trim());
      if (hasWa) rows = rows.filter((r) => (r.whatsapp as string)?.trim());
      setLeads(rows);
    }
    setLoading(false);
  }, [city, biz, minScore, status, priority, hasPhone, hasWa]);

  // Poll latest job every 3s — shows banner if running, refreshes leads when finishing
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const checkJob = async () => {
      const { data, error } = await supabase
        .from("search_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled || error || !data || data.length === 0) return;
      const j = data[0] as Job;
      const prev = lastJobStatusRef.current;

      if (j.status === "running" || j.status === "queued") {
        setActiveJob(j);
        setRecentJob(null);
      } else {
        setActiveJob(null);
        // Show "completion banner" once when transitioning from running → completed/failed
        if (prev === "running" || prev === "queued") {
          setRecentJob(j);
          load(); // refresh leads now that they're saved
          if (j.status === "completed") {
            setToast(`הסתיים! נשמרו ${j.saved_count} לידים חדשים`);
            setTimeout(() => setToast(null), 4000);
          }
        }
      }
      lastJobStatusRef.current = j.status;
    };

    checkJob();
    const t = setInterval(checkJob, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exportCsv() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (biz.trim()) params.set("business_type", biz.trim());
    if (minScore) params.set("min_score", minScore);
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (hasPhone) params.set("has_phone", "true");
    if (hasWa) params.set("has_whatsapp", "true");
    const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${base}/api/export/csv?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function quickStatus(id: string, action: "contacted" | "hot") {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${base}/api/leads/${id}/quick-status?action=${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      setToast(action === "contacted" ? "סומן כהתקשרתי" : "סומן כלקוח חם");
      setTimeout(() => setToast(null), 1800);
      load();
    }
  }

  const filtersUsed =
    city.trim() || biz.trim() || minScore || status || priority || hasPhone || hasWa;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand">הלידים שלך</h1>
          <p className="text-xs text-slate-500">
            {leads.length > 0
              ? `${leads.length} לידים${filtersUsed ? " (לפי המסננים)" : ""}`
              : "אין לידים עדיין"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/search"
            className="rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-slate-900"
          >
            + חיפוש לידים חדש
          </Link>
          {leads.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
            >
              ייצוא CSV
            </button>
          )}
        </div>
      </div>

      {/* Active job banner */}
      {activeJob && (
        <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-blue-500" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-bold text-blue-900">
                חיפוש פעיל: {activeJob.business_type} ב{activeJob.city}
              </p>
              <p className="text-xs text-blue-700">
                סטטוס: {activeJob.status === "queued" ? "בתור..." : "סורק אתרים..."}
              </p>
              {activeJob.progress_total > 0 && (
                <>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          (activeJob.progress_current / activeJob.progress_total) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-blue-800">
                    נותחו {activeJob.analyzed_count}/{activeJob.progress_total} · נשמרו{" "}
                    {activeJob.saved_count}
                    {activeJob.error_count > 0 && ` · שגיאות ${activeJob.error_count}`}
                  </p>
                </>
              )}
              <p className="text-xs text-slate-600">
                אפשר להישאר פה - הרשימה תתעדכן אוטומטית כשהחיפוש יסתיים.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent finished job */}
      {recentJob && !activeJob && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            recentJob.status === "completed"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {recentJob.status === "completed" ? (
            <span>
              ✓ החיפוש הסתיים: נמצאו {recentJob.found_count}, נותחו {recentJob.analyzed_count},
              נשמרו <strong>{recentJob.saved_count}</strong> לידים.
            </span>
          ) : (
            <span>✗ החיפוש נכשל: {recentJob.error_message || "שגיאה לא ידועה"}</span>
          )}
        </div>
      )}

      {/* Filters (collapsed by default) */}
      {leads.length > 0 || filtersUsed ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="flex w-full items-center justify-between p-3 text-sm font-medium text-slate-700"
          >
            <span>מסננים{filtersUsed ? " (פעילים)" : ""}</span>
            <span className="text-slate-400">{showFilters ? "▲" : "▼"}</span>
          </button>
          {showFilters && (
            <div className="space-y-3 border-t border-slate-100 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  placeholder="עיר"
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <input
                  placeholder="סוג עסק"
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={biz}
                  onChange={(e) => setBiz(e.target.value)}
                />
                <input
                  placeholder="ציון מינימלי (0-100)"
                  type="number"
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                />
                <select
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">כל הסטטוסים</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="">כל העדיפויות</option>
                  <option value="high">גבוהה</option>
                  <option value="medium">בינונית</option>
                  <option value="low">נמוכה</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasPhone}
                    onChange={(e) => setHasPhone(e.target.checked)}
                  />
                  יש טלפון
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasWa}
                    onChange={(e) => setHasWa(e.target.checked)}
                  />
                  יש וואטסאפ
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => load()}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white"
                >
                  החל מסננים
                </button>
                {filtersUsed && (
                  <button
                    type="button"
                    onClick={() => {
                      setCity("");
                      setBiz("");
                      setMinScore("");
                      setStatus("");
                      setPriority("");
                      setHasPhone(false);
                      setHasWa(false);
                      setTimeout(() => load(), 0);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
                  >
                    נקה
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Leads list / empty state */}
      {loading ? (
        <p className="text-slate-500">טוען…</p>
      ) : leads.length === 0 && !activeJob ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="mb-2 text-5xl">🔍</div>
          <h2 className="text-lg font-bold text-slate-800">בואי נתחיל!</h2>
          <p className="mt-2 text-sm text-slate-600">
            עדיין אין לידים במערכת. לחצי על הכפתור למטה כדי להתחיל חיפוש ראשון.
            <br />
            המערכת תסרוק עסקים בעיר שתבחרי, תנתח את האתרים שלהם, ותציג לך מי הכי מתאים לפנייה.
          </p>
          <Link
            href="/search"
            className="mt-5 inline-block rounded-xl bg-brand px-6 py-3 text-base font-bold text-white"
          >
            התחל חיפוש ראשון →
          </Link>
          <p className="mt-4 text-xs text-slate-400">⏱️ חיפוש טיפוסי: 2-4 דקות</p>
        </div>
      ) : leads.length === 0 ? (
        <p className="text-center text-sm text-slate-500">
          אין לידים שתואמים למסננים. נסי לרכך את המסננים.
        </p>
      ) : (
        <ul className="space-y-3">
          {leads.map((L) => (
            <li key={String(L.id)}>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <Link href={`/leads/${L.id}`} className="block active:opacity-90">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      {String(L.business_name || "ללא שם")}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {Boolean(L.no_website) && (
                        <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
                          🔥 אין אתר
                        </span>
                      )}
                      {Number(L.match_score) > 0 && (
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-bold ${
                            Number(L.match_score) >= 75
                              ? "bg-emerald-100 text-emerald-700"
                              : Number(L.match_score) >= 50
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                          title={String(L.match_reason || "")}
                        >
                          התאמה {Number(L.match_score)}%
                        </span>
                      )}
                      <span className="rounded bg-brand/10 px-2 py-0.5 text-sm font-bold text-brand">
                        {String(L.grade)}/{Number(L.score)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {String(L.search_city || "")} · {String(L.search_business_type || "")} ·{" "}
                    <span className="font-medium">
                      {STATUS_LABELS[String(L.status)] || String(L.status)}
                    </span>
                    {L.priority_level ? ` · ${String(L.priority_level)}` : ""}
                    {Number(L.first_seen_year || 0) > 0 ? (
                      <>
                        {" · "}
                        <span title={`קיים מ-${L.first_seen_year}`}>
                          🗓️ {Number(L.domain_age_years || 0)} שנים
                        </span>
                      </>
                    ) : null}
                  </p>
                  {Number(L.score || 0) === 0 && (L.lead_error as string) && (
                    <p className="mt-1 text-xs text-amber-700">
                      ⚠ לא הצלחנו לנתח את האתר ({String(L.lead_error).slice(0, 60)})
                    </p>
                  )}
                  {(L.match_reason as string) && (
                    <p className="mt-1 text-xs italic text-slate-500">
                      💡 {String(L.match_reason)}
                    </p>
                  )}
                  {(L.opening_line as string) && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-700">
                      {String(L.opening_line)}
                    </p>
                  )}
                  {(L.phone as string) && (
                    <p className="mt-1 text-sm text-emerald-700">📞 {String(L.phone)}</p>
                  )}
                </Link>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => quickStatus(String(L.id), "contacted")}
                    className="flex-1 rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold"
                  >
                    התקשרתי
                  </button>
                  <button
                    type="button"
                    onClick={() => quickStatus(String(L.id), "hot")}
                    className="flex-1 rounded-lg bg-orange-200 px-3 py-2 text-sm font-semibold"
                  >
                    חם 🔥
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {toast && (
        <div className="fixed bottom-4 left-4 right-4 z-20 mx-auto max-w-3xl rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

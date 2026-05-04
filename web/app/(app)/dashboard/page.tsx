"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";

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

type StageStat = { total: number; today: number };
type Pipeline = Record<string, StageStat> & {
  follow_up_due?: StageStat;
  _meta?: { deals_total: number };
};

function stageColor(key: string): string {
  return ({
    new: "#3b82f6",
    in_progress: "#6366f1",
    interested: "#f97316",
    follow_up: "#f59e0b",
    not_interested: "#64748b",
    won: "#10b981",
    lost: "#ef4444",
  } as Record<string, string>)[key] || "#94a3b8";
}

function PipelinePie({
  segments,
}: {
  segments: { label: string; value: number; color: string; emoji: string }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div className="h-32 w-32 flex items-center justify-center rounded-full border-4 border-slate-200 text-slate-400 text-xs">
        אין נתונים
      </div>
    );
  }
  const cx = 60;
  const cy = 60;
  const r = 50;
  let acc = 0;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        {segments.map((s) => {
          if (s.value === 0) return null;
          const frac = s.value / total;
          const start = acc;
          acc += frac;
          const end = acc;
          const a1 = start * Math.PI * 2;
          const a2 = end * Math.PI * 2;
          const x1 = cx + r * Math.cos(a1);
          const y1 = cy + r * Math.sin(a1);
          const x2 = cx + r * Math.cos(a2);
          const y2 = cy + r * Math.sin(a2);
          const large = end - start > 0.5 ? 1 : 0;
          const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
          return <path key={s.label} d={path} fill={s.color} />;
        })}
        {/* חור באמצע - donut */}
        <circle cx={cx} cy={cy} r={28} fill="white" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold text-slate-800 leading-none">{total}</span>
        <span className="text-[10px] text-slate-500 mt-0.5">לידים</span>
      </div>
    </div>
  );
}

const STAGES: Array<{
  key: string;
  href: string;
  title: string;
  emoji: string;
  description: string;
  color: string;
}> = [
  { key: "new",            href: "/leads/new",            title: "לידים חדשים",       emoji: "🆕",  description: "טרם דיברתי איתם",          color: "from-blue-500 to-blue-600" },
  { key: "in_progress",    href: "/leads/in-progress",    title: "בתהליך",            emoji: "💬",  description: "התחלתי לטפל",                color: "from-indigo-500 to-indigo-600" },
  { key: "interested",     href: "/leads/interested",     title: "מתעניינים",         emoji: "🔥",  description: "הביעו עניין — סגירה!",        color: "from-orange-500 to-rose-500" },
  { key: "follow_up",      href: "/leads/follow-up",      title: "צריך לחזור אליהם",  emoji: "⏰",  description: "תאריך חזרה נקבע",            color: "from-amber-500 to-amber-600" },
  { key: "not_interested", href: "/leads/not-interested", title: "לא מעוניינים",      emoji: "❌",  description: "אמרו לא + סיבה",            color: "from-slate-500 to-slate-600" },
  { key: "won",            href: "/leads/won",            title: "נסגרו ✓",            emoji: "💰",  description: "לקוחות שלי",                color: "from-emerald-500 to-emerald-600" },
  { key: "lost",           href: "/leads/lost",           title: "לא נסגרו",          emoji: "💔",  description: "היה עניין, לא סגרנו",        color: "from-rose-500 to-rose-600" },
];

type DayActivity = { date: string; count: number; label: string };

export default function DashboardPage() {
  const [stats, setStats] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [recentJob, setRecentJob] = useState<Job | null>(null);
  const lastJobStatusRef = useRef<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activity, setActivity] = useState<DayActivity[]>([]);

  // טוען פעילות 7 ימים אחרונים
  const loadActivity = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("leads")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", since.toISOString())
      .limit(2000);
    const byDay = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const k = d.toISOString().slice(0, 10);
      byDay.set(k, 0);
    }
    (data || []).forEach((row: { created_at: string | null }) => {
      const k = (row.created_at || "").slice(0, 10);
      if (byDay.has(k)) byDay.set(k, (byDay.get(k) || 0) + 1);
    });
    const dayNames = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
    const list: DayActivity[] = [];
    byDay.forEach((count, date) => {
      const d = new Date(date);
      list.push({ date, count, label: dayNames[d.getDay()] });
    });
    setActivity(list);
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const data = await apiFetch<Pipeline>("/api/stats/pipeline", session.access_token);
      setStats(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadJob = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("search_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const j = (data && data[0]) || null;
    if (!j) return;

    if (j.status === "running" || j.status === "queued") {
      setActiveJob(j);
      setRecentJob(null);
    } else {
      setActiveJob(null);
      setRecentJob(j);
      if (lastJobStatusRef.current === "running" && j.status === "completed") {
        setToast(`✓ סיימנו! נשמרו ${j.saved_count} לידים חדשים`);
        loadStats();
        setTimeout(() => setToast(null), 4500);
      }
    }
    lastJobStatusRef.current = j.status;
  }, [loadStats]);

  useEffect(() => {
    loadStats();
    loadJob();
    loadActivity();
    const t = setInterval(loadJob, 4000);
    return () => clearInterval(t);
  }, [loadStats, loadJob, loadActivity]);

  const dealsTotal = stats?._meta?.deals_total || 0;
  const followDue = stats?.follow_up_due?.total || 0;
  const newToday = stats?.new?.today || 0;

  // ===== חישובי גרפים =====
  const totalLeads = STAGES.reduce(
    (sum, s) => sum + (stats?.[s.key]?.total || 0),
    0
  );
  const wonCount = stats?.won?.total || 0;
  const lostCount = stats?.lost?.total || 0;
  const closedCount = wonCount + lostCount;
  const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;
  const interested = stats?.interested?.total || 0;
  const inProgress = stats?.in_progress?.total || 0;

  // pipeline funnel data
  const funnelData = [
    { label: "חדשים", value: stats?.new?.total || 0, color: "#3b82f6" },
    { label: "בתהליך", value: inProgress, color: "#6366f1" },
    { label: "מתעניינים", value: interested, color: "#f97316" },
    { label: "נסגרו", value: wonCount, color: "#10b981" },
  ];
  const funnelMax = Math.max(...funnelData.map((d) => d.value), 1);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* כותרת + מטריקות עליונות */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-5 text-white shadow-soft relative overflow-hidden">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-brand-accent/20 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="dot-live" />
            <h1 className="text-xl font-bold">הלוח שלי</h1>
          </div>
          <p className="mt-1 text-sm opacity-90">המצב של כל הלידים בפייפליין</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/10 backdrop-blur p-3 border border-white/10">
              <p className="text-xs opacity-80">סה&quot;כ נסגר</p>
              <p className="text-lg font-bold">₪{dealsTotal.toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur p-3 border border-white/10">
              <p className="text-xs opacity-80">חדשים היום</p>
              <p className="text-lg font-bold">{newToday}</p>
              <span className="text-[10px] opacity-70">לידים</span>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur p-3 border border-white/10">
              <p className="text-xs opacity-80">מעקב היום</p>
              <p className="text-lg font-bold">{followDue}</p>
              <span className="text-[10px] opacity-70">שיחות</span>
            </div>
          </div>
        </div>
      </div>

      {/* קישורי-על: חמים + חיוג */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/leads/hot"
          className="card-elevated p-4 bg-gradient-to-br from-rose-500 to-orange-500 text-white border-0 shadow-hot btn-pop"
        >
          <p className="text-3xl">🔥</p>
          <p className="mt-2 text-base font-bold">לידים חמים</p>
          <p className="text-xs opacity-90">25 הכי שווים</p>
        </Link>
        <Link
          href="/call-mode"
          className="card-elevated p-4 bg-gradient-success text-white border-0 btn-pop"
        >
          <p className="text-3xl">📞</p>
          <p className="mt-2 text-base font-bold">מצב חיוג</p>
          <p className="text-xs opacity-90">חיוג רציף</p>
        </Link>
      </div>

      {/* גרף משפך המרה */}
      {totalLeads > 0 && (
        <div className="card-elevated p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800">📊 משפך המרה</h3>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
              {conversionRate}% המרה
            </span>
          </div>
          <div className="space-y-2">
            {funnelData.map((d) => {
              const pct = (d.value / funnelMax) * 100;
              return (
                <div key={d.label} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs font-medium text-slate-700">
                    {d.label}
                  </span>
                  <div className="flex-1 h-7 rounded-lg bg-slate-100 overflow-hidden relative">
                    <div
                      className="h-full rounded-lg transition-all duration-700"
                      style={{
                        width: `${Math.max(pct, d.value > 0 ? 4 : 0)}%`,
                        background: `linear-gradient(90deg, ${d.color}, ${d.color}dd)`,
                      }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-xs font-bold text-slate-700">
                      {d.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* גרף עוגה - פילוח שלבים */}
      {totalLeads > 0 && (
        <div className="card-elevated p-4">
          <h3 className="font-bold text-slate-800 mb-3">🥧 פילוח לידים פעילים</h3>
          <div className="flex items-center gap-4">
            <PipelinePie
              segments={STAGES.filter((s) => s.key !== "won" && s.key !== "lost").map(
                (s) => ({
                  label: s.title,
                  value: stats?.[s.key]?.total || 0,
                  color: stageColor(s.key),
                  emoji: s.emoji,
                })
              )}
            />
            <div className="flex-1 space-y-1.5 text-sm">
              {STAGES.filter((s) => s.key !== "won" && s.key !== "lost").map((s) => {
                const v = stats?.[s.key]?.total || 0;
                if (v === 0) return null;
                return (
                  <div key={s.key} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-slate-700">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: stageColor(s.key) }}
                      />
                      {s.emoji} {s.title}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{v}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* גרף פעילות 7 ימים */}
      {activity.length > 0 && (
        <div className="card-elevated p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800">📈 לידים שנוספו - שבוע אחרון</h3>
            <span className="text-xs text-slate-500">
              סה&quot;כ {activity.reduce((s, d) => s + d.count, 0)}
            </span>
          </div>
          <div className="flex items-end justify-between gap-1 h-24">
            {activity.map((d) => {
              const max = Math.max(...activity.map((x) => x.count), 1);
              const pct = (d.count / max) * 100;
              const isToday = d.date === new Date().toISOString().slice(0, 10);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] font-bold text-slate-700 h-3">
                    {d.count > 0 ? d.count : ""}
                  </div>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        isToday
                          ? "bg-gradient-to-t from-brand to-brand-500"
                          : d.count > 0
                          ? "bg-gradient-to-t from-blue-300 to-blue-200"
                          : "bg-slate-100"
                      }`}
                      style={{ height: `${Math.max(pct, d.count > 0 ? 6 : 2)}%` }}
                    />
                  </div>
                  <div className={`text-[10px] ${isToday ? "font-bold text-brand" : "text-slate-500"}`}>
                    {d.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* באנר חיפוש פעיל */}
      {activeJob && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">חיפוש פעיל ברקע</p>
          <p className="mt-1 text-xs text-amber-800">
            {activeJob.business_type} ב{activeJob.city} ·{" "}
            {activeJob.progress_current}/{activeJob.progress_total || activeJob.limit_n}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-amber-200">
            <div
              className="h-full bg-amber-600 transition-all"
              style={{
                width: activeJob.progress_total
                  ? `${Math.min(100, (activeJob.progress_current / activeJob.progress_total) * 100)}%`
                  : "10%",
              }}
            />
          </div>
        </div>
      )}

      {/* קריאה לפעולה: היום יש לידים למעקב */}
      {followDue > 0 && (
        <Link
          href="/leads/follow-up"
          className="block rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 p-4 active:opacity-90"
        >
          <p className="text-base font-bold text-amber-900">⏰ {followDue} לידים מחכים לחזרה היום</p>
          <p className="mt-1 text-xs text-amber-800">לחץ כאן כדי להתחיל להחזיר שיחות</p>
        </Link>
      )}

      {/* כרטיסי שלבים */}
      <div className="grid grid-cols-2 gap-3">
        {STAGES.map((s, i) => {
          const stat = stats?.[s.key] || { total: 0, today: 0 };
          return (
            <Link
              key={s.key}
              href={s.href}
              className={`block rounded-2xl bg-gradient-to-br ${s.color} p-4 text-white shadow-md btn-pop animate-slideUp relative overflow-hidden`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10 blur-xl" />
              <div className="relative">
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{s.emoji}</span>
                  {stat.today > 0 && (
                    <span className="rounded-full bg-white/30 backdrop-blur px-2 py-0.5 text-[10px] font-bold">
                      +{stat.today} היום
                    </span>
                  )}
                </div>
                <p className="mt-3 text-3xl font-extrabold leading-none">{stat.total}</p>
                <p className="mt-2 text-sm font-semibold">{s.title}</p>
                <p className="text-[11px] opacity-80">{s.description}</p>
              </div>
            </Link>
          );
        })}

        {/* כרטיס חיפוש חדש */}
        <Link
          href="/search"
          className="col-span-2 block rounded-2xl border-2 border-dashed border-brand/30 bg-white p-5 text-center text-slate-700 hover:border-brand hover:bg-brand-50 transition btn-pop"
        >
          <p className="text-2xl">➕</p>
          <p className="mt-1 text-base font-bold text-brand">חיפוש לידים חדש</p>
          <p className="text-xs text-slate-500">להוסיף עוד לידים לפייפליין</p>
        </Link>
      </div>

      {recentJob && recentJob.status === "completed" && (
        <p className="text-center text-xs text-slate-500">
          חיפוש אחרון: {recentJob.business_type} · נשמרו {recentJob.saved_count}
        </p>
      )}

      {loading && !stats && (
        <p className="text-center text-sm text-slate-500">טוען…</p>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

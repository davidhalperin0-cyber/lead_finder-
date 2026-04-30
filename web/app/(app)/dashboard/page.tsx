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

export default function DashboardPage() {
  const [stats, setStats] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [recentJob, setRecentJob] = useState<Job | null>(null);
  const lastJobStatusRef = useRef<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    const t = setInterval(loadJob, 4000);
    return () => clearInterval(t);
  }, [loadStats, loadJob]);

  const dealsTotal = stats?._meta?.deals_total || 0;
  const followDue = stats?.follow_up_due?.total || 0;
  const newToday = stats?.new?.today || 0;

  return (
    <div className="space-y-4">
      {/* כותרת + מטריקות עליונות */}
      <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-accent p-5 text-white shadow-lg">
        <h1 className="text-xl font-bold">הלוח שלי</h1>
        <p className="mt-1 text-sm opacity-90">המצב של כל הלידים בפייפליין</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-xs opacity-80">נסגרו (₪)</p>
            <p className="text-lg font-bold">₪{dealsTotal.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-xs opacity-80">חדשים היום</p>
            <p className="text-lg font-bold">{newToday}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-xs opacity-80">מעקב להיום</p>
            <p className="text-lg font-bold">{followDue}</p>
          </div>
        </div>
      </div>

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
        {STAGES.map((s) => {
          const stat = stats?.[s.key] || { total: 0, today: 0 };
          return (
            <Link
              key={s.key}
              href={s.href}
              className={`block rounded-xl bg-gradient-to-br ${s.color} p-4 text-white shadow-md active:scale-[0.98] transition`}
            >
              <div className="flex items-start justify-between">
                <span className="text-2xl">{s.emoji}</span>
                {stat.today > 0 && (
                  <span className="rounded-full bg-white/30 px-2 py-0.5 text-[10px] font-bold">
                    +{stat.today} היום
                  </span>
                )}
              </div>
              <p className="mt-3 text-3xl font-extrabold leading-none">{stat.total}</p>
              <p className="mt-2 text-sm font-semibold">{s.title}</p>
              <p className="text-[11px] opacity-80">{s.description}</p>
            </Link>
          );
        })}

        {/* כרטיס חיפוש חדש */}
        <Link
          href="/search"
          className="col-span-2 block rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 text-center text-slate-700 active:bg-slate-50"
        >
          <p className="text-2xl">➕</p>
          <p className="mt-1 text-base font-bold">חיפוש לידים חדש</p>
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

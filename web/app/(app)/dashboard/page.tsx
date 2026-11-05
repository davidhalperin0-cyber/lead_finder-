"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Icon, PageHeader, Panel, Dot, Skeleton, STATUS_DOT, btn } from "../_components/ui";

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
  { key: "new",            href: "/leads/new",            title: "לידים חדשים",       emoji: "",  description: "טרם דיברתי איתם",          color: "from-blue-500 to-blue-600" },
  { key: "in_progress",    href: "/leads/in-progress",    title: "בתהליך",            emoji: "",  description: "התחלתי לטפל",                color: "from-indigo-500 to-indigo-600" },
  { key: "interested",     href: "/leads/interested",     title: "מתעניינים",         emoji: "",  description: "הביעו עניין — סגירה!",        color: "from-orange-500 to-rose-500" },
  { key: "follow_up",      href: "/leads/follow-up",      title: "צריך לחזור אליהם",  emoji: "",  description: "תאריך חזרה נקבע",            color: "from-amber-500 to-amber-600" },
  { key: "not_interested", href: "/leads/not-interested", title: "לא מעוניינים",      emoji: "",  description: "אמרו לא + סיבה",            color: "from-slate-500 to-slate-600" },
  { key: "won",            href: "/leads/won",            title: "נסגרו",            emoji: "",  description: "לקוחות שלי",                color: "from-emerald-500 to-emerald-600" },
  { key: "lost",           href: "/leads/lost",           title: "לא נסגרו",          emoji: "",  description: "היה עניין, לא סגרנו",        color: "from-rose-500 to-rose-600" },
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
    // אופטימיזציה: טוענים סטטים ישר מ-Supabase במקום מ-Render
    // (חוסך 50+ שניות של cold start). הנתונים זהים, אבל מהירים פי 100.
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // ניסיון לטעון מהקאש המקומי קודם - הצגה מיידית של נתונים אחרונים
      const cacheKey = `dash-stats-${user.id}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setStats(JSON.parse(cached) as Pipeline);
          setLoading(false);
        }
      } catch {
        /* ignore localStorage errors */
      }

      // עכשיו שאילתה מ-Supabase - זה מיידי
      const { data } = await supabase
        .from("leads")
        .select("status,created_at,follow_up_date,deal_amount")
        .eq("user_id", user.id)
        .limit(20000);

      const rows = data || [];
      const todayStr = new Date().toISOString().slice(0, 10);
      const counts: Pipeline = {
        new: { total: 0, today: 0 },
        in_progress: { total: 0, today: 0 },
        interested: { total: 0, today: 0 },
        follow_up: { total: 0, today: 0 },
        not_interested: { total: 0, today: 0 },
        won: { total: 0, today: 0 },
        lost: { total: 0, today: 0 },
        follow_up_due: { total: 0, today: 0 },
      };
      let dealsTotal = 0;

      for (const row of rows) {
        const s = row.status || "new";
        if (counts[s]) {
          counts[s].total += 1;
          if ((row.created_at || "").slice(0, 10) === todayStr) {
            counts[s].today += 1;
          }
        }
        const fud = row.follow_up_date;
        if (fud && s === "follow_up" && fud <= todayStr) {
          counts.follow_up_due!.total += 1;
        }
        if (s === "won") {
          dealsTotal += Number(row.deal_amount || 0);
        }
      }
      counts._meta = { deals_total: Math.round(dealsTotal) };
      setStats(counts);

      // שומרים בקאש לפעם הבאה
      try {
        localStorage.setItem(cacheKey, JSON.stringify(counts));
      } catch {
        /* ignore */
      }
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
      if (lastJobStatusRef.current === "running") {
        if (j.status === "completed") {
          if (j.saved_count > 0) {
            setToast(`סיימנו: נשמרו ${j.saved_count} לידים חדשים`);
          } else {
            setToast(`לא נמצאו לידים. נסי עיר או קטגוריה אחרת`);
          }
          loadStats();
          setTimeout(() => setToast(null), 5500);
        } else if (j.status === "failed") {
          const errMsg = j.error_message || "לא נמצאו עסקים";
          setToast(errMsg);
          setTimeout(() => setToast(null), 6000);
        }
      }
    }
    lastJobStatusRef.current = j.status;
  }, [loadStats]);

  useEffect(() => {
    loadStats();
    loadJob();
    loadActivity();
    // עדכון מהיר יותר כל 2 שניות כדי שתראי את המונה עולה בזמן אמת
    const t = setInterval(loadJob, 2000);
    return () => clearInterval(t);
  }, [loadStats, loadJob, loadActivity]);

  const dealsTotal = stats?._meta?.deals_total || 0;
  const followDue = stats?.follow_up_due?.total || 0;
  const newToday = stats?.new?.today || 0;
  const isLoadingFresh = loading && stats === null; // טוען בלי קאש

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

  const funnelData = [
    { label: "חדשים", value: stats?.new?.total || 0 },
    { label: "בתהליך", value: inProgress },
    { label: "מתעניינים", value: interested },
    { label: "נסגרו", value: wonCount },
  ];
  const funnelMax = Math.max(...funnelData.map((d) => d.value), 1);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : "ערב טוב";
  const num = (v: number, w = "w-10") => (isLoadingFresh ? <Skeleton className={`h-8 ${w}`} /> : v.toLocaleString("he-IL"));

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader title={greeting} subtitle="מה מחכה לך היום" />

      {/* היום: הפעולה הראשית */}
      <Panel className="!p-0 overflow-hidden">
        {followDue > 0 && (
          <Link
            href="/leads/follow-up"
            className="flex items-center justify-between gap-3 border-b border-line bg-amber-50 px-5 py-3.5 text-sm text-amber-800 transition-colors hover:text-amber-900"
          >
            <span className="flex items-center gap-2.5">
              <Icon name="clock" />
              {followDue === 1 ? "ליד אחד מחכה לשיחה חוזרת היום" : `${followDue} לידים מחכים לשיחה חוזרת היום`}
            </span>
            <Icon name="chevron" />
          </Link>
        )}
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-line">
          <div className="p-5">
            <p className="text-xs text-slate-500">חדשים היום</p>
            <p className="mt-1.5 text-[1.75rem] font-light tabular-nums text-paper">{num(newToday)}</p>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500">שיחות חוזרות היום</p>
            <p className="mt-1.5 text-[1.75rem] font-light tabular-nums text-paper">{num(followDue)}</p>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500">סה&quot;כ נסגר</p>
            <p className="mt-1.5 text-[1.75rem] font-light tabular-nums text-paper">
              {isLoadingFresh ? <Skeleton className="h-8 w-20" /> : `₪${dealsTotal.toLocaleString("he-IL")}`}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-line p-4 sm:flex-row">
          <Link href="/call-mode" className={`${btn.primary} flex-1 py-3.5 text-[15px]`}>
            <Icon name="phone" />
            להתחיל לחייג
          </Link>
          <Link href="/leads/hot" className={`${btn.secondary} flex-1 py-3.5 text-[15px]`}>
            <Icon name="flame" />
            25 הלידים החמים
          </Link>
        </div>
      </Panel>

      {/* חיפוש פעיל */}
      {activeJob && (
        <Panel
          title="חיפוש פעיל"
          aside={
            <span className="chip">
              <span className="dot-live !bg-amber-500" />
              {activeJob.status === "queued" ? "מתחיל" : "מחפש"}
            </span>
          }
        >
          <p className="-mt-2 text-sm text-slate-600">
            {activeJob.business_type} ב{activeJob.city} · יעד {activeJob.limit_n} לידים
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["נמצאו", activeJob.found_count || 0],
              ["נותחו", activeJob.analyzed_count || activeJob.progress_current || 0],
              ["נשמרו", activeJob.saved_count || 0],
            ].map(([label, v]) => (
              <div key={label as string} className="rounded-xl bg-slate-50 py-3">
                <div className="text-2xl font-light tabular-nums text-paper">{v}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                background: "var(--pearl)",
                width: activeJob.progress_total
                  ? `${Math.min(100, (activeJob.progress_current / activeJob.progress_total) * 100)}%`
                  : "8%",
              }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            {activeJob.progress_total ? `${activeJob.progress_current} מתוך ${activeJob.progress_total}` : "בודקת מקורות…"}
          </p>
        </Panel>
      )}

      {recentJob && recentJob.status === "completed" && recentJob.saved_count === 0 && (
        <Panel title="לא נמצאו לידים">
          <p className="-mt-2 text-sm text-slate-700">
            לחיפוש &quot;{recentJob.business_type}&quot; ב&quot;{recentJob.city}&quot; לא נמצאו עסקים מתאימים. כדאי לנסות עיר גדולה יותר או קטגוריה אחרת.
          </p>
          <Link href="/search" className={`${btn.secondary} mt-4`}>
            <Icon name="search" />
            חיפוש חדש
          </Link>
        </Panel>
      )}

      {recentJob && recentJob.status === "failed" && (
        <Panel title="החיפוש נכשל">
          <p className="-mt-2 text-sm text-rose-700">{recentJob.error_message || "לא נמצאו עסקים. נסי עיר או קטגוריה אחרת."}</p>
          <Link href="/search" className={`${btn.secondary} mt-4`}>
            <Icon name="refresh" />
            לנסות שוב
          </Link>
        </Panel>
      )}

      {/* כל השלבים: רשימה אחת שקל לסרוק */}
      <Panel className="!px-0 !pb-1 !pt-3">
        <div className="mb-2 flex items-center justify-between gap-3 px-5">
          <h2 className="text-[15px] font-medium text-paper">הלידים שלך</h2>
          <Link href="/search" className={`${btn.ghost} -ml-2`}>
            <Icon name="plus" size={16} />
            חיפוש לידים
          </Link>
        </div>
        <ul className="-mt-1">
          {STAGES.map((s) => {
            const stat = stats?.[s.key] || { total: 0, today: 0 };
            return (
              <li key={s.key}>
                <Link
                  href={s.href}
                  className="flex items-center gap-3.5 border-t border-line px-5 py-3.5 transition-colors hover:bg-slate-50"
                >
                  <Dot color={STATUS_DOT[s.key]} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-paper">{s.title}</span>
                    <span className="block text-xs text-slate-500">{s.description}</span>
                  </span>
                  {stat.today > 0 && <span className="chip !text-emerald-700">+{stat.today} היום</span>}
                  <span className="w-12 text-left text-lg font-light tabular-nums text-paper">
                    {isLoadingFresh ? <Skeleton className="mr-auto h-6 w-8" /> : stat.total}
                  </span>
                  <Icon name="chevron" size={16} className="text-slate-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>

      {totalLeads > 0 && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Panel title="משפך" aside={<span className="chip">{conversionRate}% המרה</span>}>
            <div className="space-y-3">
              {funnelData.map((d, i) => (
                <div key={d.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-700">{d.label}</span>
                    <span className="tabular-nums text-slate-600">{d.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max((d.value / funnelMax) * 100, d.value > 0 ? 3 : 0)}%`,
                        background: i === funnelData.length - 1 ? "var(--pearl)" : `rgba(75,91,176,${0.7 - i * 0.15})`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {activity.length > 0 && (
            <Panel
              title="לידים שנוספו השבוע"
              aside={<span className="text-xs tabular-nums text-slate-500">{activity.reduce((s, d) => s + d.count, 0)}</span>}
            >
              <div className="flex h-28 items-end justify-between gap-2">
                {activity.map((d) => {
                  const max = Math.max(...activity.map((x) => x.count), 1);
                  const isToday = d.date === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={d.date} className="flex h-full flex-1 flex-col items-center gap-1.5">
                      <span className="h-3 text-[10px] tabular-nums text-slate-500">{d.count > 0 ? d.count : ""}</span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-md transition-all duration-500"
                          style={{
                            height: `${Math.max((d.count / max) * 100, d.count > 0 ? 6 : 3)}%`,
                            background: isToday ? "var(--pearl)" : d.count > 0 ? "rgba(75,91,176,0.25)" : "rgba(17,17,20,0.06)",
                          }}
                        />
                      </div>
                      <span className={`text-[11px] ${isToday ? "text-paper" : "text-slate-500"}`}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      )}

      {recentJob && recentJob.status === "completed" && recentJob.saved_count > 0 && (
        <p className="text-center text-xs text-slate-500">
          חיפוש אחרון: {recentJob.business_type} · נשמרו {recentJob.saved_count} לידים
        </p>
      )}

      {toast && (
        <div role="status" className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full border border-line bg-white px-5 py-2.5 text-sm text-paper shadow-xl md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}

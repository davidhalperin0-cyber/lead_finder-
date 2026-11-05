"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { quickStatus, patchLead, logActivity } from "../_components/useLeads";
import { TrustBadgeSmall } from "../_components/TrustBadge";
import CallBriefCard, { fetchCallBrief, type CallBrief } from "../_components/CallBriefCard";
import DemoLink from "../_components/DemoLink";
import { Icon, Panel, btn } from "../_components/ui";

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

function detectSocialPlatform(url: string): {
  platform: "instagram" | "facebook" | "gmaps" | "other";
  emoji: string;
  label: string;
  dmUrl: string;
  bgClass: string;
} | null {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) {
    const handle = url.split("instagram.com/")[1]?.split("/")[0]?.split("?")[0] || "";
    return {
      platform: "instagram",
      emoji: "",
      label: "Instagram DM",
      dmUrl: handle ? `https://www.instagram.com/${handle}/` : url,
      bgClass: "bg-gradient-to-r from-pink-500 to-orange-500",
    };
  }
  if (u.includes("facebook.com") || u.includes("fb.com")) {
    const handle = url.split("facebook.com/")[1]?.split("/")[0]?.split("?")[0] || "";
    return {
      platform: "facebook",
      emoji: "",
      label: "Messenger",
      dmUrl: handle && !handle.includes(".") ? `https://m.me/${handle}` : url,
      bgClass: "bg-gradient-to-r from-blue-600 to-blue-700",
    };
  }
  if (u.includes("google.com/maps") || u.includes("maps.google")) {
    return {
      platform: "gmaps",
      emoji: "",
      label: "Google Maps",
      dmUrl: url,
      bgClass: "bg-gradient-to-r from-emerald-600 to-teal-600",
    };
  }
  return null;
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
      .map((L) => ({ ...L, _hot: hotScore(L) } as Lead & { _hot: number }))
      .sort((a, b) => b._hot - a._hot);
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

  // מכינים מראש את שני הלידים הבאים — הכנה לוקחת כדקה, שיחה לוקחת יותר,
  // אז כשהיא מגיעה אליהם התסריט כבר מחכה מוכן
  const upNext = queue.slice(idx + 1, idx + 3);
  const upNextKey = upNext.map((L) => L.id).join(",");
  useEffect(() => {
    upNext.forEach((L) => {
      if (!L.call_brief) fetchCallBrief(String(L.id)).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upNextKey]);

  function nextLead() {
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
      <div className="mt-8 rounded-[1.25rem] border border-line bg-white p-10 text-center animate-fadeIn">
        <h1 className="text-[2rem] font-light tracking-tight text-paper">אין לידים לחיוג</h1>
        <p className="mt-2 text-sm text-slate-600">אין כרגע לידים פעילים עם טלפון. חיפוש חדש ימלא את התור.</p>
        <Link href="/search" className={`${btn.primary} mt-6`}>
          <Icon name="search" />
          חיפוש לידים
        </Link>
      </div>
    );
  }

  // סיימנו את כל התור
  if (idx >= queue.length) {
    return (
      <div className="mt-8 rounded-[1.25rem] border border-line bg-white p-10 text-center animate-scaleIn">
        <h1 className="text-[2rem] font-light tracking-tight text-paper">סיימת את כל התור</h1>
        <p className="mt-2 text-sm text-slate-600">כל הכבוד. ככה נראה הסבב:</p>
        <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 divide-x divide-x-reverse divide-line">
          {[
            ["שיחות", stats.done],
            ["מתעניינים", stats.interested],
            ["לא ענו", stats.no_answer],
          ].map(([l, v]) => (
            <div key={l as string} className="px-2">
              <div className="text-3xl font-light tabular-nums text-paper">{v}</div>
              <div className="mt-1 text-xs text-slate-500">{l}</div>
            </div>
          ))}
        </div>
        <button onClick={load} className={`${btn.primary} mt-8`}>
          <Icon name="refresh" />
          לטעון שוב את התור
        </button>
      </div>
    );
  }


  const social = detectSocialPlatform(String(current.social_url || ""));
  const outcomeBtn =
    "flex items-center justify-center gap-2 rounded-2xl border border-line bg-white py-4 text-[15px] transition-colors disabled:opacity-40";

  return (
    <div className="space-y-4 pb-6 animate-fadeIn">
      {/* התקדמות: שורה אחת שקטה */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            ליד <span className="tabular-nums text-paper">{idx + 1}</span> מתוך <span className="tabular-nums">{queue.length}</span>
          </span>
          <span className="tabular-nums">
            {stats.interested} מעוניינים · {stats.no_answer} לא ענו · נשארו {remaining}
          </span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full transition-all" style={{ width: `${((idx + 1) / queue.length) * 100}%`, background: "var(--pearl)" }} />
        </div>
      </div>

      {/* הליד: שם, טלפון, ואז חיוג */}
      <Panel className="animate-scaleIn">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[1.75rem] font-light leading-tight tracking-tight text-paper sm:text-[2.25rem]">
              {String(current.business_name || "ללא שם")}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              {[current.search_city, current.search_business_type].filter(Boolean).map(String).join(" · ")}
            </p>
            <div className="mt-2">
              <TrustBadgeSmall lead={current} />
            </div>
          </div>
          {Boolean(current.no_website) && <span className="chip shrink-0">בלי אתר</span>}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          {tel && (
            <a href={tel} className={`${btn.primary} py-3.5 text-base sm:flex-1`}>
              <Icon name="phone" />
              <span dir="ltr" className="tabular-nums tracking-wide">{phone}</span>
            </a>
          )}
          {social && (
            <a href={social.dmUrl} target="_blank" rel="noopener noreferrer" className={`${btn.secondary} py-3.5`}>
              <Icon name="chat" />
              {social.label}
            </a>
          )}
        </div>
      </Panel>

      {/* הכנה לשיחה + דוגמת אתר */}
      <section className="overflow-hidden rounded-[1.25rem] border border-line bg-white">
        <CallBriefCard
          key={String(current.id)}
          leadId={String(current.id)}
          initial={(current.call_brief as CallBrief | null) || null}
        />
        <DemoLink
          key={"demo-" + String(current.id)}
          leadId={String(current.id)}
          name={String(current.business_name || "")}
          phone={String(current.whatsapp || current.phone || "")}
          hasDemo={Boolean((current.call_brief as { demo?: unknown } | null)?.demo)}
        />
      </section>

      {/* אחרי השיחה */}
      {!postpone ? (
        <Panel title="איך הלכה השיחה?">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={markInterested} disabled={busy} className={`${outcomeBtn} col-span-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50`}>
              <Icon name="check" />
              מעוניין, להמשיך איתו
            </button>
            <button onClick={markNoAnswer} disabled={busy} className={`${outcomeBtn} text-slate-800 hover:border-slate-400`}>
              לא ענה
            </button>
            <button onClick={() => setPostpone(true)} disabled={busy} className={`${outcomeBtn} text-slate-800 hover:border-slate-400`}>
              <Icon name="calendar" size={16} />
              לחזור אליו
            </button>
            <button onClick={markNotInterested} disabled={busy} className={`${outcomeBtn} col-span-2 text-rose-700 hover:border-rose-300`}>
              לא מעוניין
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button onClick={nextLead} className={btn.ghost}>
              לדלג בלי לעדכן
              <Icon name="chevron" size={16} />
            </button>
            <Link href={`/leads/${current.id}`} className={btn.ghost}>
              כל הפרטים
            </Link>
          </div>
        </Panel>
      ) : (
        <Panel title="מתי לחזור אליו?">
          <div className="grid grid-cols-4 gap-2">
            {[
              { l: "מחר", d: 1 },
              { l: "עוד 3 ימים", d: 3 },
              { l: "שבוע", d: 7 },
              { l: "שבועיים", d: 14 },
            ].map((q) => {
              const d = new Date();
              d.setDate(d.getDate() + q.d);
              const iso = d.toISOString().slice(0, 10);
              const on = postponeDate === iso;
              return (
                <button
                  key={q.d}
                  onClick={() => setPostponeDate(iso)}
                  className={`rounded-full py-2 text-xs transition-colors ${on ? "bg-paper text-ink" : "border border-line text-slate-700 hover:text-paper"}`}
                >
                  {q.l}
                </button>
              );
            })}
          </div>
          <input
            type="date"
            value={postponeDate}
            onChange={(e) => setPostponeDate(e.target.value)}
            min={todayISO()}
            aria-label="תאריך לחזרה"
            className="mt-3 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm"
          />
          <div className="mt-4 flex gap-2">
            <button onClick={() => setPostpone(false)} className={`${btn.secondary} flex-1`}>
              ביטול
            </button>
            <button onClick={applyPostpone} disabled={busy || !postponeDate} className={`${btn.primary} flex-1`}>
              לשמור ולעבור לבא
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import { TrustBadgeFull } from "../../_components/TrustBadge";
import CallBriefCard, { type CallBrief } from "../../_components/CallBriefCard";
import DemoLink from "../../_components/DemoLink";
import { Icon, Panel, btn } from "../../_components/ui";

type Lead = Record<string, unknown>;

function waLink(phone: string, wa: string): string | null {
  const raw = (wa || phone || "").replace(/\D/g, "");
  if (raw.length < 9) return null;
  let d = raw;
  if (d.startsWith("0")) d = "972" + d.slice(1);
  if (!d.startsWith("972")) d = "972" + d;
  return `https://wa.me/${d}`;
}

function telHref(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.length < 9) return null;
  if (d.startsWith("972")) return `tel:+${d}`;
  if (d.startsWith("0")) return `tel:+972${d.slice(1)}`;
  return `tel:+${d}`;
}

/**
 * מבטיח שכתובת URL מכילה פרוטוקול תקין (https://).
 * אם המשתמש שמר רק "instagram.com/foo" או "www.example.com",
 * הדפדפן היה מתייחס אליו ככתובת יחסית באתר שלנו → 404.
 */
function ensureHttps(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  // כבר יש פרוטוקול
  if (/^https?:\/\//i.test(s)) return s;
  // מתחיל ב-// (פרוטוקול יחסי)
  if (s.startsWith("//")) return `https:${s}`;
  // נראה כמו דומיין רגיל
  return `https://${s.replace(/^\/+/, "")}`;
}

/**
 * מזהה את סוג ה-URL החברתי ומחזיר אובייקט עם פרטי הפלטפורמה.
 * תומך באינסטגרם, פייסבוק, ו-Google Maps.
 */
function detectSocialPlatform(url: string): {
  platform: "instagram" | "facebook" | "gmaps" | "other";
  label: string;
  emoji: string;
  dmUrl: string;
  bgClass: string;
} | null {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) {
    // אינסטגרם DM: שולחים ל-/direct/new עם handle
    const handle = url.split("instagram.com/")[1]?.split("/")[0]?.split("?")[0] || "";
    return {
      platform: "instagram",
      label: "שליחת הודעה באינסטגרם",
      emoji: "",
      dmUrl: handle ? `https://www.instagram.com/${handle}/` : url,
      bgClass: "bg-gradient-to-r from-pink-500 to-orange-500",
    };
  }
  if (u.includes("facebook.com") || u.includes("fb.com")) {
    // פייסבוק Messenger: m.me/{handle}
    const handle = url.split("facebook.com/")[1]?.split("/")[0]?.split("?")[0] || "";
    return {
      platform: "facebook",
      label: "שליחת הודעה ב-Messenger",
      emoji: "",
      dmUrl: handle && !handle.includes(".") ? `https://m.me/${handle}` : url,
      bgClass: "bg-gradient-to-r from-blue-600 to-blue-700",
    };
  }
  if (u.includes("google.com/maps") || u.includes("maps.google")) {
    return {
      platform: "gmaps",
      label: "פתיחה ב-Google Maps",
      emoji: "",
      dmUrl: url,
      bgClass: "bg-gradient-to-r from-emerald-600 to-teal-600",
    };
  }
  return {
    platform: "other",
    label: "פתיחת קישור",
    emoji: "",
    dmUrl: url,
    bgClass: "bg-slate-600",
  };
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("new");
  const [followUp, setFollowUp] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
    if (error || !data) {
      setLead(null);
      return;
    }
    setLead(data);
    setNotes((data.notes as string) || "");
    setStatus((data.status as string) || "new");
    setFollowUp((data.follow_up_date as string)?.slice(0, 10) || "");
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    try {
      await apiFetch(`/api/leads/${id}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          notes,
          follow_up_date: followUp || null,
        }),
      });
      setToast("נשמר");
      setTimeout(() => setToast(null), 2000);
      load();
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "שגיאה");
    }
  }

  async function quick(action: string) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    try {
      await apiFetch(`/api/leads/${id}/quick-status?action=${action}`, session.access_token, {
        method: "POST",
      });
      load();
    } catch {
      /* ignore */
    }
  }

  async function remove(scope: "lead" | "brand" = "lead") {
    const businessName = String(lead?.business_name || "הליד");
    const msg =
      scope === "brand"
        ? `להסיר את כל הרשת של "${businessName}"?\n\nכל הסניפים יימחקו, וגם סניפים שעוד לא נמצאו לא יופיעו בחיפושים הבאים.`
        : `להסיר את "${businessName}"?\n\nהליד לא יחזור בחיפושים הבאים.`;
    const ok = window.confirm(msg);
    if (!ok) return;
    setDeleting(true);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setDeleting(false);
      return;
    }
    try {
      const res = await apiFetch<{ deleted: number }>(
        `/api/leads/${id}?scope=${scope}`,
        session.access_token,
        { method: "DELETE" }
      );
      setToast(
        scope === "brand" ? `הוסרו ${res?.deleted ?? 1} סניפים` : "הוסר — לא יחזור"
      );
      // חזרה לדאשבורד אחרי המחיקה
      setTimeout(() => router.push("/dashboard"), 600);
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "שגיאה במחיקה");
      setDeleting(false);
    }
  }

  async function copyText(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      setToast("הועתק");
      setTimeout(() => setToast(null), 1500);
    } catch {
      setToast("העתקה נכשלה");
    }
  }

  if (!lead) {
    return (
      <div>
        <p>לא נמצא</p>
        <Link href="/dashboard" className="text-brand">
          חזרה
        </Link>
      </div>
    );
  }

  const phone = String(lead.phone || "");
  const wa = String(lead.whatsapp || "");
  const url = ensureHttps(String(lead.final_url || lead.website || ""));
  const opening =
    String(lead.opening_line || lead.best_talking_point || "").trim() || "משפט פתיחה — הוסיפי ידנית";
  const mainProblems = (lead.main_problems as string[]) || [];
  const ux = (lead.ux_issues as string[]) || [];
  const trust = (lead.trust_issues as string[]) || [];
  const conv = (lead.conversion_issues as string[]) || [];
  const issues = (lead.issues as string[]) || [];
  const matchScore = Number(lead.match_score || 0);
  const matchReason = String(lead.match_reason || "");
  const firstYear = Number(lead.first_seen_year || 0);
  const ageYears = Number(lead.domain_age_years || 0);
  const loadMs = Number(lead.load_time_ms || 0);
  const htmlKb = Number(lead.html_size_kb || 0);
  const hasHttps = lead.has_https as boolean | null;
  const isMobile = lead.is_mobile_friendly as boolean | null;
  const lastCopyright = String(lead.last_copyright || "");
  const cms = String(lead.cms || "");
  const leadError = String(lead.lead_error || lead.error_reason || "");
  const score = Number(lead.score || 0);
  const couldNotAnalyze = score === 0 && !!leadError;
  const noWebsite = Boolean(lead.no_website);
  const socialUrl = ensureHttps(String(lead.social_url || ""));

  const social = detectSocialPlatform(socialUrl);
  const tel = phone ? telHref(phone) : null;
  const wam = waLink(phone, wa);
  const dl = "text-slate-500";
  const dd = "text-slate-800";
  const field = "mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm";
  const STATUSES: [string, string][] = [
    ["new", "חדש"],
    ["in_progress", "בתהליך"],
    ["interested", "מתעניין"],
    ["follow_up", "לחזור אליו"],
    ["not_interested", "לא מעוניין"],
    ["won", "נסגר"],
    ["lost", "לא נסגר"],
  ];
  const listBlock = (title: string, items: string[]) =>
    items.length > 0 && (
      <div>
        <h3 className="mb-1.5 text-xs text-slate-500">{title}</h3>
        <ul className="list-disc space-y-1 pr-4 text-sm text-slate-800">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="space-y-4 pb-10">
      <Link href="/dashboard" className={`${btn.ghost} -mr-3`}>
        <Icon name="back" size={16} />
        חזרה
      </Link>

      {/* מי הם ואיך מגיעים אליהם */}
      <Panel>
        <h1 className="text-[1.75rem] font-light leading-tight tracking-tight text-paper sm:text-[2.25rem]">
          {String(lead.business_name)}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {[lead.search_city, lead.search_business_type].filter(Boolean).map(String).join(" · ")}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {tel && (
            <a href={tel} className={`${btn.primary} min-w-[9rem]`}>
              <Icon name="phone" size={16} />
              <span dir="ltr" className="tabular-nums">{phone}</span>
            </a>
          )}
          {wam && (
            <a href={wam} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
              <Icon name="chat" size={16} />
              WhatsApp
            </a>
          )}
          {social && (
            <a href={social.dmUrl} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
              <Icon name={social.platform === "gmaps" ? "pin" : "chat"} size={16} />
              {social.label}
            </a>
          )}
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
              <Icon name="globe" size={16} />
              האתר שלהם
            </a>
          )}
        </div>
        <div className="mt-5">
          <TrustBadgeFull lead={lead} />
        </div>
      </Panel>

      {/* למה דווקא הם */}
      <Panel title="למה דווקא הם">
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-slate-500">הבעיה החזקה</dt>
            <dd className="mt-0.5 text-[17px] leading-snug text-paper">{String(lead.strongest_problem || "—")}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">למה זה פוגע בעסק</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-slate-800">{String(lead.business_impact || "—")}</dd>
          </div>
          {noWebsite && (
            <div>
              <dt className="text-xs text-slate-500">מצב ברשת</dt>
              <dd className="mt-0.5 text-sm text-slate-800">
                אין להם אתר בכלל. אפשר להציע את כל החבילה: דומיין, אחסון ועיצוב.
              </dd>
            </div>
          )}
        </dl>
      </Panel>

      {/* הכנה לשיחה */}
      <section className="overflow-hidden rounded-[1.25rem] border border-line bg-white">
        <h2 className="border-b border-line px-5 py-4 text-[15px] font-medium text-paper">הכנה לשיחה</h2>
        <CallBriefCard leadId={String(lead.id)} initial={(lead.call_brief as CallBrief | null) || null} />
        <DemoLink
          key={"demo-" + String(lead.id)}
          leadId={String(lead.id)}
          name={String(lead.business_name || "")}
          phone={String(lead.whatsapp || lead.phone || "")}
          hasDemo={Boolean((lead.call_brief as { demo?: unknown } | null)?.demo)}
        />
      </section>

      {/* ניהול הליד */}
      <Panel title="מעקב">
        <p className="text-xs text-slate-500">סטטוס</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {STATUSES.map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setStatus(v)}
              aria-pressed={status === v}
              className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                status === v ? "bg-paper text-ink" : "border border-line text-slate-700 hover:text-paper"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-xs text-slate-500">
          תאריך לחזור אליו
          <input type="date" className={field} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
        </label>
        <label className="mt-4 block text-xs text-slate-500">
          הערות
          <textarea className={`${field} min-h-[110px] leading-relaxed`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={save} className={`${btn.primary} flex-1 py-3`}>
            שמירה
          </button>
          <button type="button" onClick={() => copyText(opening)} className={btn.secondary}>
            העתקת פתיחה
          </button>
        </div>
        {toast && <p role="status" className="mt-3 text-center text-sm text-emerald-700">{toast}</p>}
      </Panel>

      {/* פרטים נוספים, מקופלים */}
      <section className="overflow-hidden rounded-[1.25rem] border border-line bg-white">
        {(matchScore > 0 || matchReason) && (
          <details className="group border-b border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm text-slate-800 hover:text-paper">
              <span>התאמה לחיפוש שלך · {matchScore}/100</span>
              <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-slate-700">{matchReason || "—"}</p>
          </details>
        )}

        {!noWebsite && (
          <details className="group border-b border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm text-slate-800 hover:text-paper">
              <span>פרטי האתר · ציון {score} ({String(lead.grade || "—")})</span>
              <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="space-y-4 px-5 pb-5">
              {couldNotAnalyze && (
                <p className="text-sm text-amber-700">
                  לא הצלחנו להגיע לאתר, אז ציון 0 לא אומר שהוא טוב. שווה לפתוח אותו ידנית.
                </p>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                <dt className={dl}>שנת יצירה</dt>
                <dd className={dd}>{firstYear > 0 ? `${firstYear} (${ageYears} שנים)` : "לא ידוע"}</dd>
                <dt className={dl}>Copyright אחרון</dt>
                <dd className={dd}>{lastCopyright || "לא נמצא"}</dd>
                <dt className={dl}>HTTPS</dt>
                <dd className={hasHttps === null ? dd : hasHttps ? "text-emerald-700" : "text-rose-700"}>
                  {hasHttps === null ? "—" : hasHttps ? "מאובטח" : "לא מאובטח"}
                </dd>
                <dt className={dl}>מותאם למובייל</dt>
                <dd className={isMobile === null ? dd : isMobile ? "text-emerald-700" : "text-rose-700"}>
                  {isMobile === null ? "—" : isMobile ? "כן" : "לא"}
                </dd>
                <dt className={dl}>פלטפורמה</dt>
                <dd className={dd}>{cms || "לא זוהתה"}</dd>
                <dt className={dl}>זמן טעינה</dt>
                <dd className={loadMs > 5000 ? "text-rose-700" : loadMs > 3000 ? "text-amber-700" : dd}>
                  {loadMs > 0 ? `${(loadMs / 1000).toFixed(1)} שניות` : "—"}
                </dd>
                <dt className={dl}>גודל הדף</dt>
                <dd className={dd}>{htmlKb > 0 ? `${htmlKb} KB` : "—"}</dd>
              </dl>
              {listBlock(`כל הבעיות שזוהו (${issues.length})`, issues)}
              {url && (
                <div className="overflow-hidden rounded-xl border border-line">
                  <iframe src={url} className="h-[280px] w-full bg-paper" title="תצוגה מקדימה של האתר" />
                </div>
              )}
              {leadError && <p className="text-xs text-slate-500" dir="ltr">{leadError}</p>}
            </div>
          </details>
        )}

        <details className="group border-b border-line last:border-b-0">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm text-slate-800 hover:text-paper">
            <span>ניתוח AI</span>
            <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="space-y-4 px-5 pb-5">
            <p className="text-sm leading-relaxed text-slate-800">{String(lead.ai_summary || "—")}</p>
            {listBlock("בעיות מרכזיות", mainProblems.slice(0, 5))}
            {listBlock("חוויית משתמש", ux)}
            {listBlock("אמון", trust)}
            {listBlock("המרה", conv)}
            <p className="text-sm text-slate-800">
              <span className="text-slate-500">נקודת שיחה: </span>
              {String(lead.best_talking_point || "—")}
            </p>
          </div>
        </details>

        {Boolean(lead.call_prep) && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm text-slate-800 hover:text-paper">
              <span>הכנה ישנה (טקסט)</span>
              <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-45">+</span>
            </summary>
            <pre className="whitespace-pre-wrap px-5 pb-5 font-sans text-xs leading-relaxed text-slate-700">{String(lead.call_prep)}</pre>
          </details>
        )}
      </section>

      {/* הסרה */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <button
          onClick={() => remove("lead")}
          disabled={deleting}
          className={`${btn.ghost} hover:!text-rose-700`}
          title="הליד יוסר ולא יחזור בחיפושים הבאים"
        >
          <Icon name="trash" size={16} />
          {deleting ? "מסירה…" : "להסיר את הליד"}
        </button>
        <button
          onClick={() => remove("brand")}
          disabled={deleting}
          className={`${btn.ghost} hover:!text-rose-700`}
          title="לרשתות כמו ארומה: מסיר את כל הסניפים, גם עתידיים"
        >
          להסיר את כל הרשת
        </button>
      </div>
    </div>
  );
}

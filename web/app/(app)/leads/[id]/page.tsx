"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";

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

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("new");
  const [followUp, setFollowUp] = useState("");
  const [toast, setToast] = useState<string | null>(null);

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
  const url = String(lead.final_url || lead.website || "");
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
  const socialUrl = String(lead.social_url || "");

  return (
    <div className="space-y-4 pb-28">
      <Link href="/dashboard" className="text-sm text-brand">
        ← חזרה לרשימה
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{String(lead.business_name)}</h1>
        <p className="text-sm text-slate-600 mt-1">
          ציון {Number(lead.score)} · {String(lead.grade)} · הזדמנות {Number(lead.opportunity_score)}%
          · סגירה משוערת {Number(lead.close_probability)}% · {String(lead.priority_level)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium"
            >
              פתיחת אתר
            </a>
          )}
          {phone && telHref(phone) && (
            <a
              href={telHref(phone)!}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
            >
              חיוג
            </a>
          )}
          {waLink(phone, wa) && (
            <a
              href={waLink(phone, wa)!}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white"
            >
              WhatsApp (ידני)
            </a>
          )}
          <button
            type="button"
            onClick={() => copyText(opening)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            העתקת משפט פתיחה
          </button>
        </div>
      </div>

      <section className="rounded-2xl border-2 border-brand bg-gradient-to-br from-[#1f4e78] to-[#2d6a9f] p-5 text-white shadow-lg">
        <h2 className="text-lg font-bold text-brand-accent mb-3">כרטיס קרב — שיחה</h2>
        <p className="text-sm opacity-90 mb-1">הבעיה החזקה</p>
        <p className="font-semibold mb-3">{String(lead.strongest_problem || "—")}</p>
        <p className="text-sm opacity-90 mb-1">למה זה פוגע בעסק</p>
        <p className="text-sm mb-3">{String(lead.business_impact || "—")}</p>
        <p className="text-sm opacity-90 mb-1">משפט פתיחה</p>
        <p className="font-medium mb-3">{opening}</p>
        <p className="text-sm opacity-90 mb-1">אם אומרים &quot;לא מעניין&quot;</p>
        <p className="text-sm mb-3">{String(lead.if_not_interested || "—")}</p>
        <p className="text-sm opacity-90 mb-1">מה להציע</p>
        <p className="text-sm mb-3">{String(lead.what_to_offer || "—")}</p>
        <p className="text-sm">
          <strong>צעד מומלץ:</strong> {String(lead.next_action || "—")} (את מבצעת ידנית — לא בוט)
        </p>
      </section>

      {url && (
        <div className="rounded-xl border bg-slate-100 overflow-hidden">
          <p className="text-xs text-slate-500 p-2">תצוגה מקדימה (אם האתר חוסם — ריק)</p>
          <iframe src={url} className="w-full h-[280px] bg-white" title="preview" />
        </div>
      )}

      {noWebsite && (
        <section className="rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
          <h2 className="text-lg font-bold text-amber-900 mb-2">
            🔥 הזדמנות זהב — עסק בלי אתר
          </h2>
          <p className="text-sm text-amber-900 mb-3">
            לעסק הזה <strong>אין אתר אינטרנט</strong>. זה הליד הכי שווה שיש — הם צריכים אתר חדש מאפס,
            ואת יכולה להציע להם את כל החבילה (דומיין, אחסון, עיצוב).
          </p>
          {socialUrl && (
            <a
              href={socialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white"
            >
              דף הסושיאל שלהם →
            </a>
          )}
        </section>
      )}

      {(matchScore > 0 || matchReason) && (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-bold text-brand mb-2">למה הליד הזה?</h2>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-slate-600">התאמה לתיאור שלך:</span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                matchScore >= 75
                  ? "bg-emerald-100 text-emerald-800"
                  : matchScore >= 50
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {matchScore}/100
            </span>
          </div>
          {matchReason && (
            <p className="text-sm text-slate-800">
              <span className="text-slate-500">💡 </span>
              {matchReason}
            </p>
          )}
        </section>
      )}

      {couldNotAnalyze && (
        <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <h2 className="font-bold text-amber-900 mb-2">⚠ לא הצלחנו לנתח את האתר</h2>
          <p className="text-sm text-amber-900 mb-2">
            ציון 0 כאן <strong>לא</strong> אומר שהאתר טוב — הוא אומר שלא הצלחנו להגיע אליו (timeout, חסום,
            או שגיאת SSL). שווה לפתוח ידנית.
          </p>
          <p className="text-xs text-amber-800 font-mono">{leadError}</p>
        </section>
      )}

      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-bold text-brand mb-3">פרטים טכניים על האתר</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">שנת יצירת האתר</dt>
          <dd className="font-medium">
            {firstYear > 0 ? (
              <>
                {firstYear}{" "}
                <span className="text-slate-500 text-xs">
                  ({ageYears} שנים)
                </span>
              </>
            ) : (
              <span className="text-slate-400">לא ידוע</span>
            )}
          </dd>

          <dt className="text-slate-500">Copyright אחרון</dt>
          <dd className="font-medium">
            {lastCopyright || <span className="text-slate-400">לא נמצא</span>}
          </dd>

          <dt className="text-slate-500">HTTPS</dt>
          <dd className={`font-medium ${hasHttps ? "text-emerald-700" : "text-rose-700"}`}>
            {hasHttps === null ? "—" : hasHttps ? "✓ מאובטח" : "✗ לא מאובטח"}
          </dd>

          <dt className="text-slate-500">מותאם למובייל</dt>
          <dd className={`font-medium ${isMobile ? "text-emerald-700" : "text-rose-700"}`}>
            {isMobile === null ? "—" : isMobile ? "✓ כן" : "✗ לא"}
          </dd>

          <dt className="text-slate-500">פלטפורמה (CMS)</dt>
          <dd className="font-medium">{cms || <span className="text-slate-400">לא זוהה</span>}</dd>

          <dt className="text-slate-500">זמן טעינה</dt>
          <dd className="font-medium">
            {loadMs > 0 ? (
              <span className={loadMs > 5000 ? "text-rose-700" : loadMs > 3000 ? "text-amber-700" : "text-emerald-700"}>
                {loadMs} ms
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </dd>

          <dt className="text-slate-500">גודל HTML</dt>
          <dd className="font-medium">
            {htmlKb > 0 ? `${htmlKb} KB` : <span className="text-slate-400">—</span>}
          </dd>

          <dt className="text-slate-500">ציון בעיות</dt>
          <dd className="font-medium">
            {score} ({String(lead.grade || "—")})
          </dd>
        </dl>

        {issues.length > 0 && (
          <>
            <h3 className="text-sm font-semibold mt-4 mb-2">כל הבעיות שזוהו ({issues.length})</h3>
            <ul className="list-disc list-inside text-sm space-y-1 text-slate-800">
              {issues.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-bold text-brand mb-2">ניתוח AI</h2>
        <p className="text-sm text-slate-800">{String(lead.ai_summary || "—")}</p>
        <h3 className="text-sm font-semibold mt-3">בעיות מרכזיות</h3>
        <ul className="list-disc list-inside text-sm space-y-1">
          {mainProblems.slice(0, 5).map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
        <h3 className="text-sm font-semibold mt-2">UX</h3>
        <ul className="list-disc list-inside text-sm">
          {ux.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
        <h3 className="text-sm font-semibold mt-2">אמון</h3>
        <ul className="list-disc list-inside text-sm">
          {trust.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
        <h3 className="text-sm font-semibold mt-2">המרה</h3>
        <ul className="list-disc list-inside text-sm">
          {conv.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
        <p className="text-sm mt-2">
          <strong>נקודת שיחה:</strong> {String(lead.best_talking_point || "—")}
        </p>
        <p className="text-sm">
          <strong>זווית:</strong> {String(lead.suggested_angle || "—")}
        </p>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-bold">ניהול ליד</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => quick("contacted")}
            className="rounded-lg bg-slate-200 px-3 py-2 text-sm"
          >
            סמנתי כהתקשרתי
          </button>
          <button
            type="button"
            onClick={() => quick("hot")}
            className="rounded-lg bg-orange-200 px-3 py-2 text-sm"
          >
            לקוח חם
          </button>
        </div>
        <div>
          <label className="text-sm font-medium">סטטוס</label>
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["new", "contacted", "interested", "follow_up", "closed", "not_relevant"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">תאריך מעקב</label>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">הערות</label>
          <textarea
            className="mt-1 w-full rounded-lg border px-3 py-2 min-h-[100px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={save}
          className="w-full rounded-xl bg-brand py-3 font-bold text-white"
        >
          שמור
        </button>
        {toast && <p className="text-sm text-center text-emerald-700">{toast}</p>}
      </section>

      {Boolean(lead.call_prep) && (
        <section className="rounded-xl border bg-slate-50 p-4">
          <h2 className="font-bold mb-2">הכנה מלאה (טקסט)</h2>
          <pre className="text-xs whitespace-pre-wrap font-sans">{String(lead.call_prep)}</pre>
        </section>
      )}

      {/* Mobile-first action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          {phone && telHref(phone) ? (
            <a
              href={telHref(phone)!}
              className="flex-1 rounded-xl bg-emerald-600 py-3 text-center text-sm font-bold text-white"
            >
              חיוג
            </a>
          ) : (
            <button type="button" className="flex-1 rounded-xl bg-slate-200 py-3 text-sm font-bold" disabled>
              חיוג
            </button>
          )}
          {waLink(phone, wa) ? (
            <a
              href={waLink(phone, wa)!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-xl bg-green-500 py-3 text-center text-sm font-bold text-white"
            >
              WhatsApp
            </a>
          ) : (
            <button type="button" className="flex-1 rounded-xl bg-slate-200 py-3 text-sm font-bold" disabled>
              WhatsApp
            </button>
          )}
          <button
            type="button"
            onClick={() => copyText(opening)}
            className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-bold"
          >
            העתקה
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white"
          >
            שמור
          </button>
        </div>
      </div>
    </div>
  );
}

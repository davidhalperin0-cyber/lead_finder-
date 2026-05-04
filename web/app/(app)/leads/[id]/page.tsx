"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

  async function remove() {
    const businessName = String(lead?.business_name || "הליד");
    const ok = window.confirm(
      `למחוק את "${businessName}" לצמיתות? אי אפשר לשחזר.`
    );
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
      await apiFetch(`/api/leads/${id}`, session.access_token, {
        method: "DELETE",
      });
      setToast("נמחק");
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

  // ===== תסריט שיחה =====
  const scriptIntro = String(lead.script_intro || "").trim();
  const scriptDiscovery = (lead.script_discovery as string[]) || [];
  const scriptValuePitch = String(lead.script_value_pitch || "").trim();
  const scriptOffer = String(lead.script_offer || "").trim();
  const scriptClose = String(lead.script_close || "").trim();
  const scriptObjections = (lead.script_objections as Record<string, string>) || {};
  const scriptDosAndDonts = (lead.script_dos_and_donts as string[]) || [];
  const hasScript = Boolean(
    scriptIntro || scriptDiscovery.length || scriptValuePitch || scriptOffer || scriptClose
  );
  // טקסט מלא לקופי-פייסט מהיר
  const fullScriptText = [
    scriptIntro && `[פתיחה]\n${scriptIntro}`,
    scriptDiscovery.length && `[שאלות גילוי]\n${scriptDiscovery.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
    scriptValuePitch && `[הצגת ערך]\n${scriptValuePitch}`,
    scriptOffer && `[הצעה]\n${scriptOffer}`,
    scriptClose && `[סגירה]\n${scriptClose}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-brand">
          ← חזרה לרשימה
        </Link>
        <button
          onClick={remove}
          disabled={deleting}
          className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          title="מחיקה לצמיתות"
        >
          {deleting ? "מוחק..." : "🗑️ מחק לצמיתות"}
        </button>
      </div>

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

      {/* תקציר ההזדמנות */}
      <section className="rounded-2xl border-2 border-brand bg-gradient-to-br from-[#1f4e78] to-[#2d6a9f] p-5 text-white shadow-lg">
        <h2 className="text-lg font-bold text-brand-accent mb-3">למה דווקא הם?</h2>
        <p className="text-sm opacity-90 mb-1">הבעיה החזקה</p>
        <p className="font-semibold mb-3">{String(lead.strongest_problem || "—")}</p>
        <p className="text-sm opacity-90 mb-1">למה זה פוגע בעסק</p>
        <p className="text-sm">{String(lead.business_impact || "—")}</p>
      </section>

      {/* ===== תסריט שיחה אנושי ===== */}
      {hasScript ? (
        <section className="rounded-2xl border-2 border-emerald-200 bg-white shadow-md overflow-hidden">
          <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">📞 תסריט השיחה</h2>
              <p className="text-xs text-emerald-50">קראי לפי הסדר. דברי טבעי, לא מהדף.</p>
            </div>
            <button
              type="button"
              onClick={() => copyText(fullScriptText)}
              className="rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-bold text-white"
            >
              📋 העתק תסריט
            </button>
          </div>

          <div className="divide-y divide-slate-200">
            {/* שלב 1: פתיחה */}
            {scriptIntro && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-emerald-700">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs ml-2">1</span>
                    פתיחה
                  </h3>
                  <button
                    type="button"
                    onClick={() => copyText(scriptIntro)}
                    className="text-xs text-emerald-600 hover:text-emerald-800"
                  >
                    📋 העתק
                  </button>
                </div>
                <p className="text-base leading-relaxed text-slate-800 whitespace-pre-wrap bg-emerald-50 rounded-lg p-3">
                  {scriptIntro}
                </p>
              </div>
            )}

            {/* שלב 2: שאלות גילוי */}
            {scriptDiscovery.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-bold text-emerald-700 mb-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs ml-2">2</span>
                  שאלות לגלות בעיות
                </h3>
                <ol className="space-y-2 mr-2">
                  {scriptDiscovery.map((q, i) => (
                    <li key={i} className="flex items-start gap-2 bg-emerald-50 rounded-lg p-3">
                      <span className="font-bold text-emerald-700 shrink-0">{i + 1}.</span>
                      <p className="text-base leading-relaxed text-slate-800">{q}</p>
                      <button
                        type="button"
                        onClick={() => copyText(q)}
                        className="text-xs text-emerald-600 hover:text-emerald-800 shrink-0"
                        title="העתק"
                      >
                        📋
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-slate-500">💡 תני להם לדבר 70% מהזמן. שתקי אחרי שאלה.</p>
              </div>
            )}

            {/* שלב 3: הצגת ערך */}
            {scriptValuePitch && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-emerald-700">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs ml-2">3</span>
                    הצגת הערך שלך
                  </h3>
                  <button
                    type="button"
                    onClick={() => copyText(scriptValuePitch)}
                    className="text-xs text-emerald-600 hover:text-emerald-800"
                  >
                    📋 העתק
                  </button>
                </div>
                <p className="text-base leading-relaxed text-slate-800 whitespace-pre-wrap bg-emerald-50 rounded-lg p-3">
                  {scriptValuePitch}
                </p>
              </div>
            )}

            {/* שלב 4: ההצעה */}
            {scriptOffer && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-emerald-700">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs ml-2">4</span>
                    ההצעה הקונקרטית
                  </h3>
                  <button
                    type="button"
                    onClick={() => copyText(scriptOffer)}
                    className="text-xs text-emerald-600 hover:text-emerald-800"
                  >
                    📋 העתק
                  </button>
                </div>
                <p className="text-base leading-relaxed text-slate-800 whitespace-pre-wrap bg-emerald-50 rounded-lg p-3">
                  {scriptOffer}
                </p>
              </div>
            )}

            {/* שלב 5: סגירה */}
            {scriptClose && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-emerald-700">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs ml-2">5</span>
                    סגירה — מה לבקש
                  </h3>
                  <button
                    type="button"
                    onClick={() => copyText(scriptClose)}
                    className="text-xs text-emerald-600 hover:text-emerald-800"
                  >
                    📋 העתק
                  </button>
                </div>
                <p className="text-base leading-relaxed text-slate-800 whitespace-pre-wrap bg-emerald-50 rounded-lg p-3 font-semibold">
                  {scriptClose}
                </p>
                <p className="mt-2 text-xs text-slate-500">💡 שאלי שאלה סגורה. ואז שתקי.</p>
              </div>
            )}
          </div>

          {/* התנגדויות */}
          {Object.keys(scriptObjections).length > 0 && (
            <div className="bg-amber-50 border-t-2 border-amber-200 p-4">
              <h3 className="text-sm font-bold text-amber-900 mb-3">
                ⚠️ אם הם אומרים...
              </h3>
              <div className="space-y-2">
                {Object.entries(scriptObjections).map(([objection, response], i) => (
                  <details key={i} className="bg-white rounded-lg border border-amber-200">
                    <summary className="cursor-pointer px-3 py-2 font-semibold text-sm text-amber-900">
                      &ldquo;{objection}&rdquo;
                    </summary>
                    <p className="px-3 pb-3 text-sm text-slate-700 leading-relaxed border-t border-amber-100">
                      {response}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          )}

          {/* טיפים */}
          {scriptDosAndDonts.length > 0 && (
            <div className="bg-slate-50 border-t border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-2">💡 טיפים מהירים</h3>
              <ul className="space-y-1.5">
                {scriptDosAndDonts.map((tip, i) => (
                  <li key={i} className="text-sm text-slate-700 flex gap-2">
                    <span className="text-emerald-600">✓</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        // אם ל-AI לא יצא לייצר תסריט מלא — תצוגה ישנה כגיבוי
        <section className="rounded-2xl border-2 border-brand bg-gradient-to-br from-[#1f4e78] to-[#2d6a9f] p-5 text-white shadow-lg">
          <h2 className="text-lg font-bold text-brand-accent mb-3">כרטיס קרב — שיחה</h2>
          <p className="text-sm opacity-90 mb-1">משפט פתיחה</p>
          <p className="font-medium mb-3">{opening}</p>
          {String(lead.if_not_interested || "") && (
            <>
              <p className="text-sm opacity-90 mb-1">אם אומרים &quot;לא מעניין&quot;</p>
              <p className="text-sm mb-3">{String(lead.if_not_interested)}</p>
            </>
          )}
          {String(lead.what_to_offer || "") && (
            <>
              <p className="text-sm opacity-90 mb-1">מה להציע</p>
              <p className="text-sm mb-3">{String(lead.what_to_offer)}</p>
            </>
          )}
          <p className="text-xs opacity-80 mt-3">
            ⚠️ התסריט המלא לא נוצר. נריץ ניתוח מחדש בפעם הבאה שתחפשי.
          </p>
        </section>
      )}

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
            onClick={() => quick("start")}
            className="rounded-lg bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-800"
          >
            💬 בתהליך
          </button>
          <button
            type="button"
            onClick={() => quick("interested")}
            className="rounded-lg bg-orange-200 px-3 py-2 text-sm font-semibold text-orange-900"
          >
            🔥 מתעניין
          </button>
          <button
            type="button"
            onClick={() => quick("not_interested")}
            className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold"
          >
            ❌ לא מעוניין
          </button>
        </div>
        <div>
          <label className="text-sm font-medium">סטטוס</label>
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="new">🆕 חדש</option>
            <option value="in_progress">💬 בתהליך</option>
            <option value="interested">🔥 מתעניין</option>
            <option value="follow_up">⏰ צריך לחזור</option>
            <option value="not_interested">❌ לא מעוניין</option>
            <option value="won">💰 נסגר</option>
            <option value="lost">💔 לא נסגר</option>
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

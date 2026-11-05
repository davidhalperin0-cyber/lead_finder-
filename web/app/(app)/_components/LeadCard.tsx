"use client";

import Link from "next/link";
import { useState } from "react";
import { TrustBadgeSmall } from "./TrustBadge";
import { deleteLead, type DeleteScope } from "./useLeads";

export type LeadCardData = {
  id: string;
  business_name?: string;
  phone?: string;
  whatsapp?: string;
  final_url?: string;
  website?: string;
  score?: number;
  grade?: string;
  opportunity_score?: number;
  match_score?: number;
  match_reason?: string;
  no_website?: boolean;
  social_url?: string;
  strongest_problem?: string;
  business_impact?: string;
  opening_line?: string;
  follow_up_date?: string;
  status?: string;
  notes?: string;
  last_contacted_at?: string;
  call_count?: number;
  search_city?: string;
  search_business_type?: string;
  domain_age_years?: number;
  google_rating?: number;
  google_review_count?: number;
  web_category?: string;
  liveness?: string;
  call_priority_score?: number;
};

export function telHref(phone: string | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (d.length < 9) return null;
  if (d.startsWith("972")) return `tel:+${d}`;
  if (d.startsWith("0")) return `tel:+972${d.slice(1)}`;
  return `tel:+${d}`;
}

export function waLink(phone: string | undefined, wa?: string): string | null {
  const raw = ((wa || phone || "") as string).replace(/\D/g, "");
  if (raw.length < 9) return null;
  let d = raw;
  if (d.startsWith("0")) d = "972" + d.slice(1);
  if (!d.startsWith("972")) d = "972" + d;
  return `https://wa.me/${d}`;
}

/** מה יש לעסק היום — הזווית שהשיחה נפתחת ממנה. */
function presenceLabel(lead: LeadCardData): { icon: string; text: string; tone: string } | null {
  const url = (lead.social_url || "").toLowerCase();
  if (url.includes("instagram")) return { icon: "", text: "רק אינסטגרם", tone: "bg-pink-100 text-pink-800" };
  if (url.includes("facebook")) return { icon: "", text: "רק פייסבוק", tone: "bg-blue-100 text-blue-800" };
  if (url.includes("tiktok")) return { icon: "", text: "רק טיקטוק", tone: "bg-slate-900 text-white" };
  if (lead.no_website) return { icon: "", text: "אין שום נוכחות ברשת", tone: "bg-amber-100 text-amber-900" };
  return null;
}

/** קישור לפרופיל החברתי — רק אם זה באמת רשת חברתית ולא קישור Google Maps. */
function socialProfileLink(lead: LeadCardData): string | null {
  const url = (lead.social_url || "").trim();
  if (!url) return null;
  if (/instagram|facebook|tiktok|linktr/i.test(url)) return url;
  return null;
}

const TONES: Record<string, string> = {
  brand: "border border-[rgba(17,17,20,0.14)] text-slate-800 hover:text-paper",
  emerald: "border border-emerald-300 text-emerald-700 hover:bg-emerald-50",
  amber: "border border-amber-300 text-amber-700 hover:bg-amber-50",
  rose: "border border-rose-300 text-rose-700 hover:bg-rose-50",
  slate: "border border-line text-slate-700 hover:text-paper",
};

type Props = {
  lead: LeadCardData;
  primaryAction?: { label: string; onClick: () => void; tone?: "brand" | "emerald" | "amber" | "rose" };
  secondaryActions?: Array<{ label: string; onClick: () => void; tone?: "slate" | "emerald" | "amber" | "rose" | "brand" }>;
  /** נקרא אחרי מחיקה מוצלחת — כדי להסיר את הכרטיס מהרשימה */
  onDeleted?: (result: { deleted: number; scope: DeleteScope }) => void;
};

export default function LeadCard({ lead, primaryAction, secondaryActions, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const phone = (lead.phone || "").trim();
  const wa = (lead.whatsapp || "").trim();
  const tel = telHref(phone);
  const wam = waLink(phone, wa);
  const presence = presenceLabel(lead);
  const social = socialProfileLink(lead);
  const reviews = Number(lead.google_review_count || 0);
  const rating = Number(lead.google_rating || 0);

  async function handleDelete(scope: DeleteScope) {
    setBusy(true);
    setErr(null);
    try {
      const res = await deleteLead(lead.id, scope);
      setConfirming(false);
      onDeleted?.({ deleted: res.deleted, scope });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "המחיקה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-elevated p-5">
      <Link href={`/leads/${lead.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[17px] font-semibold leading-snug text-paper">
            {lead.business_name || "ללא שם"}
          </span>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {presence && (
              <span className="chip">
                {presence.text}
              </span>
            )}
            {Number(lead.match_score || 0) > 0 && (
              <span
                className={`chip ${Number(lead.match_score) >= 75 ? "!text-emerald-700" : "!text-amber-700"}`}
                title={lead.match_reason || ""}
              >
                {lead.match_score}%
              </span>
            )}
            {/* ציון האתר רלוונטי רק כשיש אתר לנתח */}
            {!lead.no_website && (
              <span className="chip !text-brand">
                {lead.grade || "—"}/{lead.score || 0}
              </span>
            )}
          </div>
        </div>

        {/* הוכחת חיוּת — האות החזק ביותר שהעסק אמיתי ופעיל */}
        {reviews > 0 && (
          <p className="mt-2 text-sm text-slate-800">
            <span className="text-amber-600"></span> {rating > 0 ? rating.toFixed(1) : "—"}
            <span className="text-slate-500 font-normal">
              {" · "}
              {reviews.toLocaleString("he-IL")} ביקורות בגוגל
            </span>
            {reviews >= 100 && (
              <span className="chip mr-1.5 !py-0 !text-emerald-700">
                עסק פעיל
              </span>
            )}
          </p>
        )}

        <div className="mt-1 flex items-center gap-1 flex-wrap">
          <TrustBadgeSmall lead={lead as Record<string, unknown>} />
        </div>

        <p className="mt-1.5 text-xs text-slate-500">
          {lead.search_city || ""}
          {lead.search_business_type ? " · " + lead.search_business_type : ""}
          {Number(lead.domain_age_years || 0) > 0 ? ` · דומיין בן ${lead.domain_age_years}` : ""}
          {Number(lead.call_count || 0) > 0 ? ` · ${lead.call_count} שיחות` : ""}
        </p>

        {lead.strongest_problem && !lead.no_website && (
          <p className="mt-2 line-clamp-2 text-sm text-slate-700">
            <span className="text-slate-500">הבעיה: </span>
            {lead.strongest_problem}
          </p>
        )}

        {phone && (
          <p className="mt-2 text-right text-base font-medium tracking-wide text-slate-800" dir="ltr">
            {phone}
          </p>
        )}
      </Link>

      {/* פס פעולות */}
      <div className="mt-4 flex items-center gap-2">
        {tel && (
          <a
            href={tel}
            className="btn-pearl flex-1 py-2.5 text-center text-sm"
          >
            חיוג
          </a>
        )}
        {wam && (
          <a
            href={wam}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-full border border-emerald-300 py-2.5 text-center text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            WhatsApp
          </a>
        )}
        {social && (
          <a
            href={social}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line px-4 py-2.5 text-center text-sm text-slate-700 transition-colors hover:text-paper"
            title="פתחי את הפרופיל לפני השיחה — תדעי איך העסק נראה"
          >
            פרופיל
          </a>
        )}
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className={`flex-1 rounded-full py-2.5 text-sm font-semibold ${TONES[primaryAction.tone || "brand"]}`}
          >
            {primaryAction.label}
          </button>
        )}
      </div>

      {secondaryActions && secondaryActions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {secondaryActions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={a.onClick}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${TONES[a.tone || "slate"]}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* מחיקה */}
      {onDeleted && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-2 text-xs text-slate-400 underline hover:text-rose-600"
        >
          הסירי ליד
        </button>
      )}

      {confirming && (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-semibold text-rose-900">
            להסיר את &quot;{lead.business_name || "הליד"}&quot;?
          </p>
          <p className="mt-1 text-xs text-rose-800">הליד לא יחזור בחיפושים הבאים.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => handleDelete("lead")}
              className="rounded-full bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy ? "מסירה…" : "הסירי את הליד"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleDelete("brand")}
              className="rounded-full bg-rose-500 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              title="לרשתות — מסיר את כל הסניפים, גם כאלה שעוד לא נמצאו"
            >
              כל הרשת
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setErr(null);
              }}
              className="rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-slate-800"
            >
              ביטול
            </button>
          </div>
          {err && <p className="mt-2 text-xs font-medium text-rose-700">{err}</p>}
        </div>
      )}
    </div>
  );
}

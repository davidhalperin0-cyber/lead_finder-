"use client";

import Link from "next/link";

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

type Props = {
  lead: LeadCardData;
  /** primary action button — נראה גדול, צמוד לטלפון */
  primaryAction?: { label: string; onClick: () => void; tone?: "brand" | "emerald" | "amber" | "rose" };
  /** secondary actions — כפתורים קטנים בשורה נפרדת */
  secondaryActions?: Array<{ label: string; onClick: () => void; tone?: "slate" | "emerald" | "amber" | "rose" | "brand" }>;
};

const TONES: Record<string, string> = {
  brand:   "bg-brand text-white",
  emerald: "bg-emerald-600 text-white",
  amber:   "bg-amber-500 text-white",
  rose:    "bg-rose-600 text-white",
  slate:   "bg-slate-200 text-slate-800",
};

export default function LeadCard({ lead, primaryAction, secondaryActions }: Props) {
  const phone = (lead.phone || "").trim();
  const wa = (lead.whatsapp || "").trim();
  const tel = telHref(phone);
  const wam = waLink(phone, wa);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <Link href={`/leads/${lead.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-slate-900 leading-snug">
            {lead.business_name || "ללא שם"}
          </span>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {lead.no_website && (
              <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
                🔥 אין אתר
              </span>
            )}
            {Number(lead.match_score || 0) > 0 && (
              <span
                className={`rounded px-2 py-0.5 text-xs font-bold ${
                  Number(lead.match_score) >= 75
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
                title={lead.match_reason || ""}
              >
                {lead.match_score}%
              </span>
            )}
            <span className="rounded bg-brand/10 px-2 py-0.5 text-sm font-bold text-brand">
              {lead.grade || "—"}/{lead.score || 0}
            </span>
          </div>
        </div>

        <p className="mt-1 text-xs text-slate-500">
          {(lead.search_city || "")} {lead.search_business_type ? "· " + lead.search_business_type : ""}
          {Number(lead.domain_age_years || 0) > 0 ? ` · 🗓️ ${lead.domain_age_years} שנים` : ""}
          {Number(lead.call_count || 0) > 0 ? ` · 📞 ${lead.call_count}` : ""}
        </p>

        {lead.strongest_problem && (
          <p className="mt-2 line-clamp-2 text-sm text-slate-700">
            <span className="text-slate-500">הבעיה: </span>
            {lead.strongest_problem}
          </p>
        )}

        {phone && (
          <p className="mt-1 text-sm text-emerald-700 font-medium">📞 {phone}</p>
        )}
      </Link>

      {/* פס פעולות */}
      <div className="mt-3 flex items-center gap-2">
        {tel && (
          <a
            href={tel}
            className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-center text-sm font-bold text-white"
          >
            חיוג
          </a>
        )}
        {wam && (
          <a
            href={wam}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-green-500 py-2.5 text-center text-sm font-bold text-white"
          >
            WhatsApp
          </a>
        )}
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${TONES[primaryAction.tone || "brand"]}`}
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
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${TONES[a.tone || "slate"]}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * רכיב TrustBadge - מציג סימן אמינות לליד
 * עוזר למשתמש לדעת בכל זמן נתון שהליד אמיתי, לא מחורטט.
 *
 * 4 רמות אמון:
 * 🟢 100% Google Places (מאומת בגוגל)
 * 🟢 OpenStreetMap (קהילתי, תרומה ידנית)
 * 🟡 Instagram/Facebook (יש דף סושיאל אמיתי + טלפון בתיאור)
 * 🔵 OSM Google Maps (יש מיקום אמיתי)
 */

export type LeadTrust = {
  level: "verified" | "community" | "social" | "unknown";
  source: string;
  emoji: string;
  description: string;
  bgClass: string;
  borderClass: string;
};

export function getLeadTrust(lead: Record<string, unknown>): LeadTrust {
  const socialUrl = String(lead.social_url || "").toLowerCase();
  const website = String(lead.website || lead.final_url || "").toLowerCase();
  const noWebsite = Boolean(lead.no_website);
  const googleRating = lead.google_rating;
  const reviewCount = lead.google_review_count;

  // 🟢 רמה 1: Google Places - הכי אמין
  // מזוהה לפי: יש דירוג גוגל או source_url מ-Google Maps
  if (
    googleRating !== undefined && googleRating !== null ||
    reviewCount !== undefined && reviewCount !== null ||
    (noWebsite && socialUrl.includes("google.com/maps"))
  ) {
    return {
      level: "verified",
      source: "Google Places",
      emoji: "",
      description: "מאומת על ידי גוגל",
      bgClass: "bg-emerald-100 text-emerald-800",
      borderClass: "border-emerald-300",
    };
  }

  // 🟡 רמה 2: דף אינסטגרם או פייסבוק אמיתי
  if (socialUrl.includes("instagram.com")) {
    return {
      level: "social",
      source: "Instagram",
      emoji: "",
      description: "יש דף אינסטגרם אמיתי",
      bgClass: "bg-pink-100 text-pink-800",
      borderClass: "border-pink-300",
    };
  }
  if (socialUrl.includes("facebook.com") || socialUrl.includes("fb.com")) {
    return {
      level: "social",
      source: "Facebook",
      emoji: "",
      description: "יש דף פייסבוק אמיתי",
      bgClass: "bg-blue-100 text-blue-800",
      borderClass: "border-blue-300",
    };
  }

  // 🟢 רמה 3: עסק עם אתר אמיתי (מ-AI search) - בדקנו את האתר
  if (website && website.startsWith("http")) {
    return {
      level: "verified",
      source: "אתר עסק",
      emoji: "",
      description: "אתר אמיתי שניתן לבדוק",
      bgClass: "bg-teal-100 text-teal-800",
      borderClass: "border-teal-300",
    };
  }

  // 🟢 רמה 4: OSM (קהילתי)
  if (noWebsite) {
    return {
      level: "community",
      source: "OpenStreetMap",
      emoji: "",
      description: "נתוני קהילה אמיתיים",
      bgClass: "bg-amber-100 text-amber-800",
      borderClass: "border-amber-300",
    };
  }

  // אחרת
  return {
    level: "unknown",
    source: "לא ידוע",
    emoji: "",
    description: "מקור לא מאומת",
    bgClass: "bg-slate-100 text-slate-600",
    borderClass: "border-slate-300",
  };
}

/**
 * תווית קטנה - להצגה בקלפים
 */
export function TrustBadgeSmall({ lead }: { lead: Record<string, unknown> }) {
  const trust = getLeadTrust(lead);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-slate-500"
      title={trust.description}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${trust.level === "unknown" ? "bg-slate-400" : "bg-emerald-500"}`} />
      {trust.source}
    </span>
  );
}

/**
 * כרטיס מורחב - להצגה בעמוד הליד הבודד
 */
export function TrustBadgeFull({ lead }: { lead: Record<string, unknown> }) {
  const trust = getLeadTrust(lead);
  return (
    <div
      className="rounded-2xl border border-line bg-white p-4"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${trust.level === "unknown" ? "bg-slate-400" : "bg-emerald-500"}`} />
        <div>
          <p className="text-sm font-medium text-paper">
            {trust.level === "verified" && "ליד מאומת"}
            {trust.level === "community" && "ליד אמיתי"}
            {trust.level === "social" && "ליד מסושיאל אמיתי"}
            {trust.level === "unknown" && "מקור לא ידוע"}
          </p>
          <p className="text-xs text-slate-600">
            {trust.description} · מקור: {trust.source}
          </p>
        </div>
      </div>
    </div>
  );
}

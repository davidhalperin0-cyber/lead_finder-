"use client";

import Link from "next/link";
import LeadCard, { LeadCardData } from "../../_components/LeadCard";
import { useLeadsByStatus, quickStatus, deleteLead } from "../../_components/useLeads";
import { useMemo, useState } from "react";

type WebsiteFilter = "all" | "with_website" | "no_website";

export default function NewLeadsPage() {
  const { leads, loading, reload } = useLeadsByStatus("new");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // סינון וחיפוש
  const [search, setSearch] = useState("");
  const [businessType, setBusinessType] = useState<string>("all");
  const [city, setCity] = useState<string>("all");
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilter>("all");

  // אופציות לתפריטי הסינון - מחושבות לפי הלידים הקיימים
  const businessTypes = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((L) => {
      const t = String(L.search_business_type || "").trim();
      if (t) set.add(t);
    });
    return Array.from(set).sort();
  }, [leads]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((L) => {
      const c = String(L.search_city || "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [leads]);

  // מסננים את הלידים לפי הבחירות
  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((L) => {
      // סוג עסק
      if (businessType !== "all" && String(L.search_business_type || "") !== businessType) {
        return false;
      }
      // עיר
      if (city !== "all" && String(L.search_city || "") !== city) {
        return false;
      }
      // עם/בלי אתר
      const noSite = Boolean(L.no_website);
      if (websiteFilter === "with_website" && noSite) return false;
      if (websiteFilter === "no_website" && !noSite) return false;
      // חיפוש חופשי
      if (q) {
        const hay = [
          L.business_name,
          L.phone,
          L.whatsapp,
          L.search_city,
          L.search_business_type,
          L.strongest_problem,
        ]
          .map((x) => String(x || "").toLowerCase())
          .join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, businessType, city, websiteFilter]);

  // קיבוץ לפי קטגוריה (סוג עסק)
  const grouped = useMemo(() => {
    const map = new Map<string, Record<string, unknown>[]>();
    filteredLeads.forEach((L) => {
      const k = String(L.search_business_type || "").trim() || "אחר";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(L);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filteredLeads]);

  const hasFilters = search || businessType !== "all" || city !== "all" || websiteFilter !== "all";

  async function startWork(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      await quickStatus(id, "start");
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function removeLead(id: string, name: string) {
    if (busy) return;
    const ok = window.confirm(
      `למחוק את "${name}" לצמיתות מהמערכת? אי אפשר לשחזר.`
    );
    if (!ok) return;
    setBusy(id);
    try {
      await deleteLead(id);
      setToast("נמחק ✓");
      setTimeout(() => setToast(null), 2000);
      await reload();
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "שגיאה במחיקה");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setBusy(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setBusinessType("all");
    setCity("all");
    setWebsiteFilter("all");
  }

  return (
    <div className="space-y-3 pb-4">
      <header className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">🆕 לידים חדשים</h1>
          <p className="text-xs text-slate-500">לידים שעדיין לא דיברתי איתם</p>
        </div>
        <span className="rounded bg-blue-100 px-2 py-0.5 text-sm font-bold text-blue-700">
          {hasFilters ? `${filteredLeads.length}/${leads.length}` : leads.length}
        </span>
      </header>

      {toast && (
        <div className="rounded-lg bg-slate-900 px-3 py-2 text-center text-sm text-white">
          {toast}
        </div>
      )}

      {/* פילטרים */}
      {leads.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          {/* תיבת חיפוש */}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 חיפוש לפי שם, טלפון, עיר..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />

          {/* כפתורי בחירה: עם/בלי אתר */}
          <div className="flex gap-2">
            {([
              { v: "all" as WebsiteFilter, l: "הכל" },
              { v: "no_website" as WebsiteFilter, l: "🔥 בלי אתר" },
              { v: "with_website" as WebsiteFilter, l: "🌐 עם אתר" },
            ]).map((b) => (
              <button
                key={b.v}
                type="button"
                onClick={() => setWebsiteFilter(b.v)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${
                  websiteFilter === b.v
                    ? "bg-brand text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {b.l}
              </button>
            ))}
          </div>

          {/* תפריט קטגוריות */}
          <div className="flex gap-2">
            {businessTypes.length > 0 && (
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              >
                <option value="all">כל סוגי העסקים</option>
                {businessTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
            {cities.length > 0 && (
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              >
                <option value="all">כל הערים</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="w-full rounded-lg bg-slate-100 py-1.5 text-xs font-semibold text-slate-700"
            >
              ✕ ניקוי סינון
            </button>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">טוען…</p>}

      {!loading && leads.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-bold text-slate-800">אין לידים חדשים 🎉</p>
          <p className="mt-1 text-sm text-slate-500">
            כל הלידים כבר בטיפול. רוצה להוסיף עוד?
          </p>
          <Link
            href="/search"
            className="mt-4 inline-block rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white"
          >
            חיפוש חדש
          </Link>
        </div>
      )}

      {!loading && leads.length > 0 && filteredLeads.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">לא נמצאו לידים שעונים לסינון.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 inline-block rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            ניקוי סינון
          </button>
        </div>
      )}

      {/* תצוגה: כשיש סינון פעיל - רשימה רגילה. אחרת - מקובץ לפי קטגוריה. */}
      {filteredLeads.length > 0 && (businessType !== "all" || hasFilters) && (
        <ul className="space-y-3">
          {filteredLeads.map((L) => (
            <li key={String(L.id)}>
              <LeadCard
                lead={L as LeadCardData}
                primaryAction={{
                  label: busy === L.id ? "..." : "התחל טיפול",
                  onClick: () => startWork(String(L.id)),
                  tone: "brand",
                }}
                secondaryActions={[
                  {
                    label: busy === L.id ? "..." : "🗑️ מחק לא רלוונטי",
                    onClick: () => removeLead(String(L.id), String(L.business_name || "ליד")),
                    tone: "rose",
                  },
                ]}
              />
            </li>
          ))}
        </ul>
      )}

      {filteredLeads.length > 0 && businessType === "all" && !hasFilters && (
        <div className="space-y-4">
          {grouped.map(([category, items]) => (
            <section key={category} className="space-y-2">
              <h2 className="sticky top-0 z-10 -mx-1 bg-slate-50 px-1 py-1 text-sm font-bold text-slate-700">
                {category} <span className="text-slate-400">({items.length})</span>
              </h2>
              <ul className="space-y-3">
                {items.map((L) => (
                  <li key={String(L.id)}>
                    <LeadCard
                      lead={L as LeadCardData}
                      primaryAction={{
                        label: busy === L.id ? "..." : "התחל טיפול",
                        onClick: () => startWork(String(L.id)),
                        tone: "brand",
                      }}
                      secondaryActions={[
                        {
                          label: busy === L.id ? "..." : "🗑️ מחק לא רלוונטי",
                          onClick: () => removeLead(String(L.id), String(L.business_name || "ליד")),
                          tone: "rose",
                        },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

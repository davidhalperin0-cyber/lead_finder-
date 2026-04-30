"use client";

import Link from "next/link";
import LeadCard, { LeadCardData } from "../../_components/LeadCard";
import { useLeadsByStatus, quickStatus } from "../../_components/useLeads";
import { useState } from "react";

export default function NewLeadsPage() {
  const { leads, loading, reload } = useLeadsByStatus("new");
  const [busy, setBusy] = useState<string | null>(null);

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

  return (
    <div className="space-y-3 pb-4">
      <header className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">🆕 לידים חדשים</h1>
          <p className="text-xs text-slate-500">לידים שעדיין לא דיברתי איתם</p>
        </div>
        <span className="rounded bg-blue-100 px-2 py-0.5 text-sm font-bold text-blue-700">
          {leads.length}
        </span>
      </header>

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

      <ul className="space-y-3">
        {leads.map((L) => (
          <li key={String(L.id)}>
            <LeadCard
              lead={L as LeadCardData}
              primaryAction={{
                label: busy === L.id ? "..." : "התחל טיפול",
                onClick: () => startWork(String(L.id)),
                tone: "brand",
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

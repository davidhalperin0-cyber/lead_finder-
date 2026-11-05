"use client";

import { useState } from "react";
import LeadCard, { LeadCardData } from "../../_components/LeadCard";
import { useLeadsByStatus, quickStatus, patchLead, logActivity } from "../../_components/useLeads";

export default function InProgressPage() {
  const { leads, loading, reload } = useLeadsByStatus("in_progress");
  const [busy, setBusy] = useState<string | null>(null);
  const [followUpFor, setFollowUpFor] = useState<string | null>(null);
  const [followDate, setFollowDate] = useState<string>("");

  async function act(id: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(id);
    try {
      await fn();
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function setFollowUp(id: string) {
    if (!followDate) return;
    await patchLead(id, { status: "follow_up", follow_up_date: followDate });
    setFollowUpFor(null);
    setFollowDate("");
    await reload();
  }

  return (
    <div className="space-y-3 pb-4">
      <header className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[2rem] font-light leading-tight tracking-tight text-paper sm:text-[2.5rem]">בתהליך</h1>
          <p className="mt-1 text-[15px] text-slate-600">לידים שכבר התחלתי לטפל בהם</p>
        </div>
        <span className="chip tabular-nums">
          {leads.length}
        </span>
      </header>

      {loading && <p className="text-sm text-slate-500">טוען…</p>}

      {!loading && leads.length === 0 && (
        <div className="rounded-[1.25rem] border border-line bg-white p-6 text-center">
          <p className="text-base font-bold text-slate-800">אין לידים בטיפול</p>
          <p className="mt-1 text-sm text-slate-500">
            כדי להתחיל, היכנס ל"חדשים" ולחץ "התחל טיפול"
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {leads.map((L) => {
          const id = String(L.id);
          return (
            <li key={id}>
              <LeadCard
                lead={L as LeadCardData}
                onDeleted={() => reload()}
                secondaryActions={[
                  {
                    label: "לא ענה",
                    tone: "slate",
                    onClick: () =>
                      act(id, () => logActivity(id, { activity_type: "call_attempt", outcome: "no_answer" })),
                  },
                  {
                    label: "ענה",
                    tone: "brand",
                    onClick: () =>
                      act(id, () => logActivity(id, { activity_type: "call_done", outcome: "answered" })),
                  },
                  {
                    label: "מתעניין",
                    tone: "emerald",
                    onClick: () => act(id, () => quickStatus(id, "interested")),
                  },
                  {
                    label: "לא מעוניין",
                    tone: "rose",
                    onClick: () => act(id, () => quickStatus(id, "not_interested")),
                  },
                  {
                    label: "קבע מעקב",
                    tone: "amber",
                    onClick: () => {
                      setFollowUpFor(id);
                      setFollowDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
                    },
                  },
                ]}
              />
              {followUpFor === id && (
                <div className="mt-2 rounded-2xl border border-line bg-slate-50 p-4">
                  <p className="text-sm font-medium text-amber-900">בוחר תאריך לחזרה:</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="date"
                      value={followDate}
                      onChange={(e) => setFollowDate(e.target.value)}
                      className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setFollowUp(id)}
                      className="rounded-full btn-pearl px-4 py-2 text-sm"
                    >
                      שמור
                    </button>
                    <button
                      type="button"
                      onClick={() => setFollowUpFor(null)}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

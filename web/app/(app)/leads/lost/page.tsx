"use client";

import { useMemo, useState } from "react";
import LeadCard, { LeadCardData } from "../../_components/LeadCard";
import { useLeadsByStatus, patchLead, quickStatus } from "../../_components/useLeads";

const REASON_LABEL: Record<string, string> = {
  price:        "💰 מחיר גבוה",
  competitor:   "🏃 הלכו למתחרה",
  no_decision:  "🤷 לא קיבלו החלטה",
  bad_timing:   "⏳ עיתוי לא טוב",
  ghosted:      "👻 הפסיקו להגיב",
  other:        "אחר",
};

type LeadLost = LeadCardData & {
  lost_reason?: string;
  lost_can_return?: boolean;
  lost_return_date?: string;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LostPage() {
  const { leads, loading, reload } = useLeadsByStatus("lost");
  const [busy, setBusy] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>("");

  const today = todayISO();

  const groups = useMemo(() => {
    const canReturn: LeadLost[] = [];
    const dead: LeadLost[] = [];
    for (const L of leads as unknown as LeadLost[]) {
      if (L.lost_can_return) canReturn.push(L);
      else dead.push(L);
    }
    return { canReturn, dead };
  }, [leads]);

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

  async function saveEditDate(id: string) {
    if (!editDate) return;
    await act(id, () =>
      patchLead(id, { lost_can_return: true, lost_return_date: editDate })
    );
    setEditFor(null);
    setEditDate("");
  }

  function renderLost(L: LeadLost) {
    const id = String(L.id);
    const reason = L.lost_reason || "other";
    const date = (L.lost_return_date || "").slice(0, 10);
    const dueNow = date && date <= today;
    return (
      <li key={id}>
        <LeadCard
          lead={L}
          primaryAction={
            L.lost_can_return
              ? {
                  label: busy === id ? "..." : "🔄 חזור לטיפול",
                  tone: "brand",
                  onClick: () => act(id, () => quickStatus(id, "start")),
                }
              : undefined
          }
          secondaryActions={[
            {
              label: "📅 קבע תאריך חזרה",
              tone: "amber",
              onClick: () => {
                setEditFor(id);
                setEditDate(
                  L.lost_return_date?.slice(0, 10) ||
                    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
                );
              },
            },
          ]}
        />
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-700">
            {REASON_LABEL[reason] || reason}
          </span>
          {date && (
            <span
              className={`rounded px-2 py-0.5 font-bold ${
                dueNow ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-700"
              }`}
            >
              {dueNow ? "⏰ הזמן לחזור: " : "חזרה: "}
              {date}
            </span>
          )}
        </div>

        {editFor === id && (
          <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">תאריך לחזור אליהם:</p>
            <div className="mt-2 flex gap-2">
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => saveEditDate(id)}
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white"
              >
                שמור
              </button>
              <button
                type="button"
                onClick={() => setEditFor(null)}
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
              >
                ביטול
              </button>
            </div>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">💔 לא נסגרו</h1>
          <p className="text-xs text-slate-500">היה עניין, לא הסתדר — לפעמים אפשר לחזור</p>
        </div>
        <span className="rounded bg-rose-100 px-2 py-0.5 text-sm font-bold text-rose-700">
          {leads.length}
        </span>
      </header>

      {loading && <p className="text-sm text-slate-500">טוען…</p>}

      {!loading && leads.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-bold text-slate-800">אין כאן כלום 🎉</p>
        </div>
      )}

      {groups.canReturn.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-amber-700">⏰ אפשר לחזור אליהם</h2>
            <span className="text-xs text-amber-700">{groups.canReturn.length}</span>
          </div>
          <ul className="space-y-3">{groups.canReturn.map(renderLost)}</ul>
        </section>
      )}

      {groups.dead.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-700">🪦 ארכיון</h2>
            <span className="text-xs text-slate-500">{groups.dead.length}</span>
          </div>
          <ul className="space-y-3">{groups.dead.map(renderLost)}</ul>
        </section>
      )}
    </div>
  );
}

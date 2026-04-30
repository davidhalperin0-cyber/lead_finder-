"use client";

import { useMemo, useState } from "react";
import LeadCard, { LeadCardData } from "../../_components/LeadCard";
import { useLeadsByStatus, patchLead, quickStatus } from "../../_components/useLeads";

const REASONS = [
  { key: "no_budget",    label: "💰 אין תקציב" },
  { key: "has_site",     label: "🌐 יש להם אתר" },
  { key: "not_relevant", label: "🚫 לא רלוונטי" },
  { key: "bad_time",     label: "⏳ עיתוי לא טוב" },
  { key: "no_answer",    label: "📵 לא עונים" },
  { key: "other",        label: "אחר" },
];

const REASON_LABEL: Record<string, string> = REASONS.reduce(
  (a, r) => ({ ...a, [r.key]: r.label }),
  {} as Record<string, string>
);

type LeadDetail = LeadCardData & {
  not_interested_reason?: string;
  not_interested_note?: string;
};

export default function NotInterestedPage() {
  const { leads, loading, reload } = useLeadsByStatus("not_interested");
  const [busy, setBusy] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editReason, setEditReason] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");

  const grouped = useMemo(() => {
    const map: Record<string, LeadDetail[]> = {};
    for (const L of leads as unknown as LeadDetail[]) {
      const k = L.not_interested_reason || "other";
      (map[k] ||= []).push(L);
    }
    return map;
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

  async function saveEdit(id: string) {
    if (!editReason) return;
    await act(id, () =>
      patchLead(id, {
        not_interested_reason: editReason,
        not_interested_note: editNote || null,
      })
    );
    setEditFor(null);
    setEditReason("");
    setEditNote("");
  }

  function renderLead(L: LeadDetail) {
    const id = String(L.id);
    return (
      <li key={id}>
        <LeadCard
          lead={L}
          secondaryActions={[
            {
              label: "✏️ ערוך סיבה",
              tone: "slate",
              onClick: () => {
                setEditFor(id);
                setEditReason(L.not_interested_reason || "");
                setEditNote(L.not_interested_note || "");
              },
            },
            {
              label: "🔄 חזור לטיפול",
              tone: "brand",
              onClick: () => act(id, () => quickStatus(id, "start")),
            },
          ]}
        />
        {L.not_interested_note && (
          <p className="mt-1 text-xs text-slate-500 italic">"{L.not_interested_note}"</p>
        )}

        {editFor === id && (
          <div className="mt-2 rounded-xl border border-slate-300 bg-slate-50 p-3">
            <p className="text-sm font-bold text-slate-800">סיבה:</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setEditReason(r.key)}
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                    editReason === r.key
                      ? "border-slate-700 bg-slate-200 text-slate-900"
                      : "border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              placeholder="הערה (אופציונלי)"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => saveEdit(id)}
                disabled={!editReason || busy === id}
                className="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                שמור
              </button>
              <button
                type="button"
                onClick={() => setEditFor(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
          <h1 className="text-xl font-bold">❌ לא מעוניינים</h1>
          <p className="text-xs text-slate-500">לידים שאמרו לא — מקובץ לפי סיבה</p>
        </div>
        <span className="rounded bg-slate-200 px-2 py-0.5 text-sm font-bold text-slate-700">
          {leads.length}
        </span>
      </header>

      {loading && <p className="text-sm text-slate-500">טוען…</p>}

      {!loading && leads.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-bold text-slate-800">אין כאן כלום</p>
          <p className="mt-1 text-sm text-slate-500">כל הכבוד 💪</p>
        </div>
      )}

      {Object.keys(grouped).map((reasonKey) => {
        const list = grouped[reasonKey];
        return (
          <section key={reasonKey} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-700">
                {REASON_LABEL[reasonKey] || reasonKey}
              </h2>
              <span className="text-xs text-slate-500">{list.length}</span>
            </div>
            <ul className="space-y-3">{list.map(renderLead)}</ul>
          </section>
        );
      })}
    </div>
  );
}

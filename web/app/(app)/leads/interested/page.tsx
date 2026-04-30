"use client";

import { useState } from "react";
import LeadCard, { LeadCardData } from "../../_components/LeadCard";
import { useLeadsByStatus, patchLead } from "../../_components/useLeads";

type WonForm = { amount: string; what: string };
type LostForm = { reason: string; canReturn: boolean; returnDate: string };

const LOST_REASONS = [
  { key: "price",        label: "💰 מחיר גבוה" },
  { key: "competitor",   label: "🏃 הלכו למתחרה" },
  { key: "no_decision",  label: "🤷 לא קיבלו החלטה" },
  { key: "bad_timing",   label: "⏳ עיתוי לא טוב" },
  { key: "ghosted",      label: "👻 הפסיקו להגיב" },
  { key: "other",        label: "אחר" },
];

export default function InterestedPage() {
  const { leads, loading, reload } = useLeadsByStatus("interested");
  const [busy, setBusy] = useState<string | null>(null);
  const [wonFor, setWonFor] = useState<string | null>(null);
  const [wonF, setWonF] = useState<WonForm>({ amount: "", what: "" });
  const [lostFor, setLostFor] = useState<string | null>(null);
  const [lostF, setLostF] = useState<LostForm>({ reason: "", canReturn: false, returnDate: "" });

  async function saveWon(id: string) {
    if (!wonF.amount) return;
    setBusy(id);
    try {
      await patchLead(id, {
        status: "won",
        deal_amount: parseFloat(wonF.amount) || 0,
        deal_what_sold: wonF.what || null,
        deal_closed_at: new Date().toISOString().slice(0, 10),
      });
      setWonFor(null);
      setWonF({ amount: "", what: "" });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function saveLost(id: string) {
    if (!lostF.reason) return;
    setBusy(id);
    try {
      await patchLead(id, {
        status: "lost",
        lost_reason: lostF.reason,
        lost_can_return: lostF.canReturn,
        lost_return_date: lostF.canReturn && lostF.returnDate ? lostF.returnDate : null,
      });
      setLostFor(null);
      setLostF({ reason: "", canReturn: false, returnDate: "" });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 pb-4">
      <header className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">🔥 מתעניינים</h1>
          <p className="text-xs text-slate-500">לידים שהביעו עניין — תור לסגור!</p>
        </div>
        <span className="rounded bg-orange-100 px-2 py-0.5 text-sm font-bold text-orange-700">
          {leads.length}
        </span>
      </header>

      {loading && <p className="text-sm text-slate-500">טוען…</p>}

      {!loading && leads.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-bold text-slate-800">אין לידים מתעניינים כרגע</p>
          <p className="mt-1 text-sm text-slate-500">
            סמן ב"בתהליך" לידים שהביעו עניין — הם יופיעו כאן
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {leads.map((L) => {
          const id = String(L.id);
          const showWon = wonFor === id;
          const showLost = lostFor === id;
          return (
            <li key={id}>
              <LeadCard
                lead={L as LeadCardData}
                primaryAction={{
                  label: busy === id ? "..." : "💰 סגור עסקה",
                  tone: "emerald",
                  onClick: () => {
                    setWonFor(id);
                    setLostFor(null);
                  },
                }}
                secondaryActions={[
                  {
                    label: "💔 לא נסגר",
                    tone: "rose",
                    onClick: () => {
                      setLostFor(id);
                      setWonFor(null);
                    },
                  },
                ]}
              />

              {showWon && (
                <div className="mt-2 rounded-xl border-2 border-emerald-400 bg-emerald-50 p-3">
                  <p className="text-sm font-bold text-emerald-900">🎉 מזל טוב! איזה עסקה סגרת?</p>
                  <div className="mt-2 space-y-2">
                    <input
                      type="number"
                      placeholder="סכום (₪)"
                      inputMode="numeric"
                      value={wonF.amount}
                      onChange={(e) => setWonF({ ...wonF, amount: e.target.value })}
                      className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-base"
                    />
                    <input
                      type="text"
                      placeholder="מה מכרת? (אופציונלי)"
                      value={wonF.what}
                      onChange={(e) => setWonF({ ...wonF, what: e.target.value })}
                      className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-base"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveWon(id)}
                        disabled={!wonF.amount || busy === id}
                        className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {busy === id ? "שומר..." : "סגירה!"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setWonFor(null)}
                        className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm"
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showLost && (
                <div className="mt-2 rounded-xl border-2 border-rose-300 bg-rose-50 p-3">
                  <p className="text-sm font-bold text-rose-900">למה זה לא נסגר?</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {LOST_REASONS.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setLostF({ ...lostF, reason: r.key })}
                        className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                          lostF.reason === r.key
                            ? "border-rose-500 bg-rose-200 text-rose-900"
                            : "border-rose-200 bg-white text-rose-800"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm text-rose-900">
                    <input
                      type="checkbox"
                      checked={lostF.canReturn}
                      onChange={(e) => setLostF({ ...lostF, canReturn: e.target.checked })}
                    />
                    אפשר לחזור אליהם בעתיד?
                  </label>
                  {lostF.canReturn && (
                    <input
                      type="date"
                      value={lostF.returnDate}
                      onChange={(e) => setLostF({ ...lostF, returnDate: e.target.value })}
                      className="mt-2 w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm"
                    />
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveLost(id)}
                      disabled={!lostF.reason || busy === id}
                      className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {busy === id ? "שומר..." : "שמור"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLostFor(null)}
                      className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm"
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

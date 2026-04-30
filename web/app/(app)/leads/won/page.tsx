"use client";

import { useMemo } from "react";
import LeadCard, { LeadCardData } from "../../_components/LeadCard";
import { useLeadsByStatus } from "../../_components/useLeads";

type LeadWon = LeadCardData & {
  deal_amount?: number;
  deal_closed_at?: string;
  deal_what_sold?: string;
};

export default function WonPage() {
  const { leads, loading } = useLeadsByStatus("won");

  const totals = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const L of leads as unknown as LeadWon[]) {
      total += Number(L.deal_amount || 0);
      count += 1;
    }
    const avg = count > 0 ? Math.round(total / count) : 0;
    return { total, count, avg };
  }, [leads]);

  return (
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="text-xl font-bold">💰 נסגרו</h1>
        <p className="text-xs text-slate-500">כל העסקאות שסגרת</p>
      </header>

      <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white shadow-lg">
        <p className="text-xs opacity-90">סה"כ הכנסות</p>
        <p className="mt-1 text-3xl font-extrabold">₪{totals.total.toLocaleString()}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/15 p-2">
            <p className="text-[11px] opacity-80">עסקאות</p>
            <p className="text-lg font-bold">{totals.count}</p>
          </div>
          <div className="rounded-lg bg-white/15 p-2">
            <p className="text-[11px] opacity-80">ממוצע לעסקה</p>
            <p className="text-lg font-bold">₪{totals.avg.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">טוען…</p>}

      {!loading && leads.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-bold text-slate-800">עוד אין עסקאות סגורות</p>
          <p className="mt-1 text-sm text-slate-500">העסקה הראשונה שלך תופיע כאן 💪</p>
        </div>
      )}

      <ul className="space-y-3">
        {(leads as unknown as LeadWon[]).map((L) => {
          const id = String(L.id);
          const amount = Number(L.deal_amount || 0);
          const dt = (L.deal_closed_at || "").slice(0, 10);
          return (
            <li key={id}>
              <LeadCard lead={L} />
              <div className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <div className="flex items-center justify-between">
                  <span className="font-bold">₪{amount.toLocaleString()}</span>
                  {dt && <span className="opacity-80">{dt}</span>}
                </div>
                {L.deal_what_sold && <p className="mt-0.5 opacity-90">{L.deal_what_sold}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

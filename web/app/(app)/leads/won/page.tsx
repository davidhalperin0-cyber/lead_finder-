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
  const { leads, loading, reload } = useLeadsByStatus("won");

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
        <h1 className="text-[2rem] font-light leading-tight tracking-tight text-paper sm:text-[2.5rem]">נסגרו</h1>
        <p className="mt-1 text-[15px] text-slate-600">כל העסקאות שסגרת</p>
      </header>

      <section className="grid grid-cols-3 divide-x divide-x-reverse divide-line rounded-[1.25rem] border border-line bg-white">
        {[
          ["סה\"כ הכנסות", `₪${totals.total.toLocaleString("he-IL")}`],
          ["עסקאות", totals.count.toLocaleString("he-IL")],
          ["ממוצע לעסקה", `₪${totals.avg.toLocaleString("he-IL")}`],
        ].map(([l, v]) => (
          <div key={l} className="p-5">
            <p className="text-xs text-slate-500">{l}</p>
            <p className="mt-1.5 text-[1.6rem] font-light tabular-nums text-paper">{v}</p>
          </div>
        ))}
      </section>

      {loading && <p className="text-sm text-slate-500">טוען…</p>}

      {!loading && leads.length === 0 && (
        <div className="rounded-[1.25rem] border border-line bg-white p-6 text-center">
          <p className="text-base font-bold text-slate-800">עוד אין עסקאות סגורות</p>
          <p className="mt-1 text-sm text-slate-500">העסקה הראשונה שלך תופיע כאן</p>
        </div>
      )}

      <ul className="space-y-3">
        {(leads as unknown as LeadWon[]).map((L) => {
          const id = String(L.id);
          const amount = Number(L.deal_amount || 0);
          const dt = (L.deal_closed_at || "").slice(0, 10);
          return (
            <li key={id}>
              <LeadCard lead={L} onDeleted={() => reload()} />
              <div className="mt-2 rounded-2xl border border-line px-4 py-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="tabular-nums text-emerald-700">₪{amount.toLocaleString("he-IL")}</span>
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

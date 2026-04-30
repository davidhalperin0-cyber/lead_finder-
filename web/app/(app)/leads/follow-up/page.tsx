"use client";

import { useMemo, useState } from "react";
import LeadCard, { LeadCardData } from "../../_components/LeadCard";
import { useLeadsByStatus, patchLead, logActivity, quickStatus } from "../../_components/useLeads";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FollowUpPage() {
  const { leads, loading, reload } = useLeadsByStatus("follow_up");
  const [busy, setBusy] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>("");

  const today = todayISO();

  const groups = useMemo(() => {
    const overdue: LeadCardData[] = [];
    const todayList: LeadCardData[] = [];
    const future: LeadCardData[] = [];
    for (const L of leads as unknown as LeadCardData[]) {
      const d = (L.follow_up_date || "").slice(0, 10);
      if (!d) {
        future.push(L);
      } else if (d < today) {
        overdue.push(L);
      } else if (d === today) {
        todayList.push(L);
      } else {
        future.push(L);
      }
    }
    return { overdue, todayList, future };
  }, [leads, today]);

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

  async function rescheduleSave(id: string) {
    if (!editDate) return;
    await act(id, () => patchLead(id, { follow_up_date: editDate }));
    setEditFor(null);
    setEditDate("");
  }

  function renderList(list: LeadCardData[]) {
    return (
      <ul className="space-y-3">
        {list.map((L) => {
          const id = String(L.id);
          const date = (L.follow_up_date || "").slice(0, 10);
          const isToday = date === today;
          const isOverdue = date && date < today;
          return (
            <li key={id}>
              <div className="relative">
                {isOverdue && (
                  <span className="absolute -top-1 -right-1 z-10 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    באיחור
                  </span>
                )}
                {isToday && (
                  <span className="absolute -top-1 -right-1 z-10 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    היום
                  </span>
                )}
                <LeadCard
                  lead={L}
                  primaryAction={{
                    label: busy === id ? "..." : "✅ דיברתי",
                    tone: "brand",
                    onClick: () =>
                      act(id, async () => {
                        await logActivity(id, { activity_type: "call_done", outcome: "answered" });
                        await quickStatus(id, "interested");
                      }),
                  }}
                  secondaryActions={[
                    {
                      label: "📞 לא ענה",
                      tone: "slate",
                      onClick: () =>
                        act(id, () =>
                          logActivity(id, { activity_type: "call_attempt", outcome: "no_answer" })
                        ),
                    },
                    {
                      label: "📅 דחה",
                      tone: "amber",
                      onClick: () => {
                        setEditFor(id);
                        setEditDate(
                          new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
                        );
                      },
                    },
                    {
                      label: "❌ לא מעוניין",
                      tone: "rose",
                      onClick: () => act(id, () => quickStatus(id, "not_interested")),
                    },
                  ]}
                />
                {date && (
                  <p className={`mt-1 text-xs ${isOverdue ? "text-rose-700 font-bold" : "text-slate-500"}`}>
                    תאריך חזרה: {date}
                  </p>
                )}
              </div>

              {editFor === id && (
                <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">תאריך חדש לחזרה:</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => rescheduleSave(id)}
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
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">⏰ צריך לחזור אליהם</h1>
          <p className="text-xs text-slate-500">
            לידים עם תאריך חזרה — קודם איחורים, אחרי זה היום
          </p>
        </div>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-sm font-bold text-amber-700">
          {leads.length}
        </span>
      </header>

      {loading && <p className="text-sm text-slate-500">טוען…</p>}

      {!loading && leads.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-bold text-slate-800">אין מעקבים פתוחים 🎉</p>
          <p className="mt-1 text-sm text-slate-500">כל המעקבים סגורים. כל הכבוד!</p>
        </div>
      )}

      {groups.overdue.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-rose-700">🚨 באיחור</h2>
            <span className="text-xs text-rose-700">{groups.overdue.length}</span>
          </div>
          {renderList(groups.overdue)}
        </section>
      )}

      {groups.todayList.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-amber-700">📞 היום</h2>
            <span className="text-xs text-amber-700">{groups.todayList.length}</span>
          </div>
          {renderList(groups.todayList)}
        </section>
      )}

      {groups.future.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-700">📅 בהמשך</h2>
            <span className="text-xs text-slate-700">{groups.future.length}</span>
          </div>
          {renderList(groups.future)}
        </section>
      )}
    </div>
  );
}

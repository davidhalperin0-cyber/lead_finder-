"use client";

import { useEffect, useState } from "react";

export type Period = {
  open: { day: number; hour: number; minute?: number };
  close?: { day: number; hour: number; minute?: number };
};

const DAY_MIN = 24 * 60;
const WEEK_MIN = 7 * DAY_MIN;

function israelNow(): { day: number; min: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, min: Number(get("hour")) * 60 + Number(get("minute")) };
}

const hhmm = (h: number, m = 0) => `${h}:${String(m).padStart(2, "0")}`;

/** "פתוח עכשיו · עד 19:00" לפי שעון ישראל. אם אין שעות — לא מציג כלום. */
export function status(periods: Period[]): { open: boolean; text: string } | null {
  if (!periods.length) return null;
  const { day, min } = israelNow();
  const now = day * DAY_MIN + min;
  // פתוח 24/7: period אחד בלי close
  if (periods.length === 1 && !periods[0].close) return { open: true, text: "פתוח עכשיו, 24 שעות" };

  let nextOpen: { at: number; p: Period } | null = null;
  for (const p of periods) {
    if (!p.close) continue;
    const start = p.open.day * DAY_MIN + p.open.hour * 60 + (p.open.minute || 0);
    let end = p.close.day * DAY_MIN + p.close.hour * 60 + (p.close.minute || 0);
    if (end <= start) end += WEEK_MIN;
    for (const t of [now, now + WEEK_MIN]) {
      if (t >= start && t < end) return { open: true, text: `פתוח עכשיו · עד ${hhmm(p.close.hour, p.close.minute)}` };
    }
    const until = (start - now + WEEK_MIN) % WEEK_MIN;
    if (!nextOpen || until < nextOpen.at) nextOpen = { at: until, p };
  }
  if (!nextOpen) return null;
  const { p } = nextOpen;
  const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const when = p.open.day === day ? "היום" : p.open.day === (day + 1) % 7 ? "מחר" : `ביום ${days[p.open.day]}`;
  return { open: false, text: `סגור עכשיו · נפתח ${when} ב-${hhmm(p.open.hour, p.open.minute)}` };
}

export default function OpenNow({ periods, accent }: { periods: Period[]; accent: string }) {
  // מחושב רק בדפדפן, כדי שהשעה תהיה של המבקר ולא של השרת
  const [s, setS] = useState<ReturnType<typeof status>>(null);
  useEffect(() => {
    setS(status(periods));
    const t = setInterval(() => setS(status(periods)), 60_000);
    return () => clearInterval(t);
  }, [periods]);
  if (!s) return null;
  return (
    <p className="flex items-center gap-2 text-base font-semibold">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: s.open ? "#1E9E5A" : accent, opacity: s.open ? 1 : 0.5 }}
      />
      {s.text}
    </p>
  );
}

/** היום הנוכחי בשבוע (0 = ראשון) בשעון ישראל, להדגשת השורה בטבלת השעות. */
export function TodayMark({ index, children }: { index: number; children: React.ReactNode }) {
  const [today, setToday] = useState(-1);
  useEffect(() => setToday(israelNow().day), []);
  // weekdayDescriptions של גוגל מתחילים ביום שני
  const isToday = today >= 0 && (index + 1) % 7 === today;
  return <tr className={isToday ? "font-bold" : ""}>{children}</tr>;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

const PRESET_CITIES = ["תל אביב", "ירושלים", "חיפה", "ראשון לציון", "פתח תקווה", "באר שבע"];
const PRESET_TYPES = ["מסעדה", "מספרה", "רופא שיניים", "עורך דין", "מוסך", "חנות", "סטודיו"];

export default function SearchPage() {
  const router = useRouter();
  const [city, setCity] = useState("תל אביב");
  const [businessType, setBusinessType] = useState("מסעדה");
  const [description, setDescription] = useState("");
  const [limit, setLimit] = useState(15);
  const [useAi, setUseAi] = useState(true);
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [screenshots, setScreenshots] = useState(false);
  const [workers, setWorkers] = useState(4);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  async function cleanFakeLeads() {
    const ok = window.confirm(
      "למחוק את כל הלידים שמסומנים כ'בלי אתר'?\n\n" +
      "אלה הלידים שנוצרו על ידי AI לפני התיקון, ויש להם מספרי טלפון לא אמיתיים.\n\n" +
      "אי אפשר לשחזר!"
    );
    if (!ok) return;
    setCleaning(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setMsg("אין סשן — התחברי מחדש");
        return;
      }
      const res = await apiFetch<{ deleted: number }>(
        "/api/leads/bulk-delete-no-website",
        session.access_token,
        { method: "POST" }
      );
      setMsg(`✓ נמחקו ${res.deleted} לידים מזויפים. עכשיו תחפשי שוב — יבואו רק לידים אמיתיים!`);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setCleaning(false);
    }
  }

  async function startSearch(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setMsg("אין סשן — התחברי מחדש");
        setLoading(false);
        return;
      }
      await apiFetch("/api/search-leads", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          city: city.trim(),
          business_type: businessType.trim(),
          description: description.trim(),
          limit,
          use_ai: useAi,
          workers,
          screenshots,
          only_without_website: onlyWithoutWebsite,
        }),
      });
      // החיפוש התחיל ברקע - חוזר לדאשבורד שם רואים את ההתקדמות בבאנר
      router.push("/dashboard");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "שגיאה");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand">חיפוש לידים חדש</h1>
        <p className="mt-1 text-sm text-slate-600">
          המערכת תחפש עסקים בעיר, תסרוק את האתרים שלהם, ותדרג מי הכי מתאים לפנייה.
        </p>
      </div>

      <form onSubmit={startSearch} className="space-y-4 rounded-xl border bg-white p-4">
        {/* עיר */}
        <div>
          <label className="text-sm font-medium">עיר</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {PRESET_CITIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCity(c)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  city === c
                    ? "border-brand bg-brand text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* סוג עסק */}
        <div>
          <label className="text-sm font-medium">סוג עסק</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            required
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {PRESET_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setBusinessType(t)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  businessType === t
                    ? "border-brand bg-brand text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* תיאור חופשי - מי בדיוק מחפשים */}
        <div>
          <label className="text-sm font-medium">
            תיאור חופשי <span className="text-xs font-normal text-slate-500">(אופציונלי, אבל ממליץ!)</span>
          </label>
          <textarea
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            rows={3}
            placeholder='לדוגמה: "מסעדות קטנות בתל אביב עם אתר ישן, לא רשתות גדולות. אני מציע להן לבנות אתר חדש מודרני עם תפריט והזמנות"'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
          <p className="mt-1 text-xs text-slate-500">
            ה-AI ישתמש בתיאור הזה כדי להבין מי בדיוק את מחפשת ולמצוא לידים מתאימים יותר
          </p>
        </div>

        {/* כמות */}
        <div>
          <label className="text-sm font-medium">
            כמות לידים: <span className="font-bold text-brand">{limit}</span>
          </label>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            className="mt-1 w-full"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>5 (מהיר)</span>
            <span>30 (מומלץ)</span>
            <span>60 (איטי)</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            ⏱️ זמן משוער: ~{Math.ceil(limit / 8)} דקות
          </p>
        </div>

        {/* AI */}
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <input
            type="checkbox"
            checked={useAi}
            onChange={(e) => setUseAi(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <div className="font-medium">ניתוח AI</div>
            <div className="text-xs text-slate-500">
              משתמש ב-OpenAI כדי להפיק "שורת פתיחה" מותאמת אישית לכל ליד. מומלץ.
            </div>
          </div>
        </label>

        {/* רק עסקים בלי אתר - מתג מודגש */}
        <label
          className={`flex cursor-pointer items-start gap-2 rounded-lg border-2 p-3 text-sm transition ${
            onlyWithoutWebsite
              ? "border-amber-400 bg-amber-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <input
            type="checkbox"
            checked={onlyWithoutWebsite}
            onChange={(e) => setOnlyWithoutWebsite(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <div className="font-medium">
              🔥 רק עסקים בלי אתר{" "}
              <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-bold text-amber-900">
                100% אמיתי
              </span>
            </div>
            <div className="text-xs text-slate-600 mt-1">
              <strong>רק נתונים אמיתיים מ-OpenStreetMap</strong> — קהילה של אנשים אמיתיים
              שתרמו ידנית את המספרים. בלי AI, בלי המצאות.
              <br />
              ⚠️ עיר קטנה? יכול להיות שיהיו מעט תוצאות. נסי תל אביב/חיפה/ירושלים.
            </div>
          </div>
        </label>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-slate-500 underline"
        >
          {showAdvanced ? "הסתר אפשרויות מתקדמות" : "אפשרויות מתקדמות"}
        </button>

        {showAdvanced && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <label className="text-sm font-medium">מקביליות</label>
              <input
                type="number"
                min={1}
                max={10}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={workers}
                onChange={(e) => setWorkers(parseInt(e.target.value, 10) || 4)}
              />
              <p className="text-xs text-slate-500">
                כמה אתרים לסרוק במקביל (1-10). יותר = מהיר יותר אבל עומס גדול יותר.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={screenshots}
                onChange={(e) => setScreenshots(e.target.checked)}
              />
              צילומי מסך של האתרים (דורש Playwright)
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand py-3 text-base font-bold text-white disabled:opacity-50"
        >
          {loading ? "שולח…" : "התחל חיפוש"}
        </button>

        <p className="text-center text-xs text-slate-500">
          אחרי הלחיצה תועברי לדשבורד עם פס התקדמות
        </p>
      </form>

      {msg && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {msg}
        </div>
      )}

      <Link href="/dashboard" className="block text-center text-sm text-brand underline">
        חזרה ללידים
      </Link>

      {/* אזור ניקוי - לידים מזויפים שנוצרו לפני התיקון */}
      <div className="mt-6 rounded-xl border-2 border-rose-200 bg-rose-50 p-4">
        <h3 className="font-bold text-rose-900 text-sm mb-1">
          🧹 ניקוי לידים מזויפים
        </h3>
        <p className="text-xs text-rose-800 mb-3">
          קיבלת מספרים מזויפים בלידים &quot;בלי אתר&quot;? זה היה באג של ה-AI שכבר תוקן.
          לחצי כאן כדי למחוק את כל הלידים הישנים בלי אתר ולהתחיל נקי.
          <br />
          <strong>לידים חדשים יבואו רק מ-OpenStreetMap (אמיתי 100%).</strong>
        </p>
        <button
          type="button"
          onClick={cleanFakeLeads}
          disabled={cleaning}
          className="w-full rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 px-4 py-2 text-sm font-bold text-white"
        >
          {cleaning ? "מנקה..." : "🗑️ מחק את כל הלידים בלי אתר"}
        </button>
      </div>
    </div>
  );
}

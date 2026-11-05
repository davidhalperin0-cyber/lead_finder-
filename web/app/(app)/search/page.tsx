"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { PageHeader, btn } from "../_components/ui";

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
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="חיפוש לידים" subtitle="המערכת תמצא עסקים בעיר, תבדוק את האתרים שלהם ותדרג מי הכי מתאים לפנייה." />

      <form onSubmit={startSearch} className="space-y-6 rounded-[1.25rem] border border-line bg-white p-5">
        {/* עיר */}
        <div>
          <label className="text-sm text-slate-700">עיר</label>
          <input
            className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5"
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
                    ? "border-paper bg-paper text-ink"
                    : "border-line text-slate-700 hover:text-paper"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* סוג עסק */}
        <div>
          <label className="text-sm text-slate-700">סוג עסק</label>
          <input
            className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5"
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
                    ? "border-paper bg-paper text-ink"
                    : "border-line text-slate-700 hover:text-paper"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* תיאור חופשי - מי בדיוק מחפשים */}
        <div>
          <label className="text-sm text-slate-700">
            תיאור חופשי <span className="text-xs font-normal text-slate-500">(אופציונלי, אבל ממליץ!)</span>
          </label>
          <textarea
            className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm leading-relaxed"
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
          <label className="text-sm text-slate-700">
            כמות לידים: <span className="tabular-nums text-paper">{limit}</span>
          </label>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            className="mt-2 w-full accent-[#4b5bb0]"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>5 (מהיר)</span>
            <span>30 (מומלץ)</span>
            <span>60 (איטי)</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            זמן משוער: ~{Math.max(1, Math.ceil(limit / 12))} דקות
          </p>
        </div>

        {/* AI */}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-4 text-sm">
          <input
            type="checkbox"
            checked={useAi}
            onChange={(e) => setUseAi(e.target.checked)}
            className="mt-0.5 accent-[#4b5bb0]"
          />
          <div>
            <div className="text-paper">ניתוח AI</div>
            <div className="text-xs text-slate-500">
              משתמש ב-OpenAI כדי להפיק "שורת פתיחה" מותאמת אישית לכל ליד. מומלץ.
            </div>
          </div>
        </label>

        {/* רק עסקים בלי אתר - מתג מודגש */}
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm transition ${
            onlyWithoutWebsite
              ? "border-slate-400 bg-slate-50"
              : "border-line"
          }`}
        >
          <input
            type="checkbox"
            checked={onlyWithoutWebsite}
            onChange={(e) => setOnlyWithoutWebsite(e.target.checked)}
            className="mt-0.5 accent-[#4b5bb0]"
          />
          <div>
            <div className="text-paper">
              רק עסקים בלי אתר{" "}
              <span className="chip mr-1 !py-0 !text-emerald-700">
                מאומת בגוגל
              </span>
            </div>
            <div className="text-xs text-slate-600 mt-1">
              עסקים שקיימים רק באינסטגרם, בפייסבוק, או בלי שום נוכחות —
              <strong> השיחה הכי קלה למכור בה אתר</strong>.
              <br />
              כל הנתונים מ-Google Places. סניפי רשתות ומספרי שירות מסוננים אוטומטית.
            </div>
          </div>
        </label>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-slate-500 underline-offset-4 hover:text-paper hover:underline"
        >
          {showAdvanced ? "הסתר אפשרויות מתקדמות" : "אפשרויות מתקדמות"}
        </button>

        {showAdvanced && (
          <div className="space-y-3 rounded-2xl border border-line p-4">
            <div>
              <label className="text-sm text-slate-700">מקביליות</label>
              <input
                type="number"
                min={1}
                max={10}
                className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5"
                value={workers}
                onChange={(e) => setWorkers(parseInt(e.target.value, 10) || 4)}
              />
              <p className="mt-1 text-xs text-slate-500">
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
          className={`${btn.primary} w-full py-3.5 text-base`}
        >
          {loading ? "שולח…" : "התחל חיפוש"}
        </button>

        <p className="text-center text-xs text-slate-500">
          אחרי הלחיצה תועברי לדשבורד עם פס התקדמות
        </p>
      </form>

      {msg && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
          {msg}
        </div>
      )}

      <Link href="/dashboard" className={`${btn.ghost} mx-auto flex w-fit`}>
        חזרה ללוח
      </Link>
    </div>
  );
}

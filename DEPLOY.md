# 🚀 העלאת המערכת לאוויר (פריסה)

המטרה: שתוכלי להיכנס למערכת **מכל מכשיר** (טלפון, מחשב של חברה, וכו') בלי שהמחשב שלך יצטרך להיות פתוח.

## ארכיטקטורה - מה רץ איפה?

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   טלפון     │  →→→→  │  Next.js     │  →→→→  │  FastAPI     │
│   נייד      │         │  (Vercel)    │         │  (Render)    │
└─────────────┘         └──────────────┘         └──────────────┘
                                                        ↓
                                                 ┌──────────────┐
                                                 │  Supabase    │
                                                 │  (כבר עובד)  │
                                                 └──────────────┘
```

| חלק | איפה | עלות |
|------|------|------|
| Web (Next.js) | **Vercel** | חינם |
| API (Python) | **Render** | חינם (עם cold start) |
| מסד נתונים | **Supabase** | כבר רץ - חינם |
| **סה"כ** | | **0 ₪/חודש** |

> ⚠️ הערה: ב-Render החינמי - אם לא נכנסים ~15 דקות, השרת "נרדם". כניסה ראשונה אחרי שינה לוקחת 30-60 שניות. אם זה מציק - אפשר לשדרג ל-$7/חודש לשרת תמידי.

---

## 🔵 שלב 1: Web → Vercel (10 דקות)

### 1.1 - להעלות את הקוד ל-GitHub

אם הפרויקט שלך **כבר ב-GitHub** - דלגי לשלב 1.2.

אחרת:
1. צרי חשבון ב-[github.com](https://github.com) (חינם)
2. צרי repository חדש בשם `lead-finder` (פרטי, לא public!)
3. בטרמינל:
   ```bash
   cd ~/Desktop/lead_finder
   git init
   git add .
   git commit -m "First commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/lead-finder.git
   git push -u origin main
   ```
   החליפי `YOUR-USERNAME` בשם המשתמש שלך ב-GitHub.

### 1.2 - להעלות ל-Vercel

1. לכי ל-[vercel.com](https://vercel.com) → "Sign up with GitHub"
2. **Add New → Project**
3. בחרי את ה-repo `lead-finder`
4. **חשוב**: בשדה **Root Directory** לחצי "Edit" ותכתבי `web`
5. ב-**Environment Variables** הוסיפי:
   - `NEXT_PUBLIC_SUPABASE_URL` = הערך מהקובץ `web/.env.local`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = הערך מהקובץ `web/.env.local`
   - `NEXT_PUBLIC_API_URL` = **השאירי ריק לרגע** (נוסיף אחרי שלב 2)
6. לחצי **Deploy**.

אחרי 1-2 דקות יהיה לך URL כמו: `lead-finder.vercel.app` 🎉

---

## 🟢 שלב 2: API → Render (15 דקות)

### 2.1 - להירשם ל-Render

1. לכי ל-[render.com](https://render.com) → "Sign up with GitHub"
2. אשרי גישה לרפו `lead-finder`

### 2.2 - ליצור Web Service

1. **New + → Web Service**
2. בחרי את הרפו `lead-finder`
3. הגדרות:
   - **Name**: `lead-finder-api`
   - **Region**: Frankfurt (הכי קרוב לישראל)
   - **Branch**: `main`
   - **Root Directory**: השאירי ריק (כדי שיהיה לפי הרוט)
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `api/Dockerfile`
   - **Plan**: **Free** ($0/month)
4. תחת **Environment Variables**, הוסיפי את אלה (העתיקי מ-`api/.env`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET`
   - `OPENAI_API_KEY`
   - `SUPABASE_SCREENSHOTS_BUCKET` = `screenshots`
   - `CORS_ORIGINS` = `https://lead-finder.vercel.app` (החליפי ל-URL האמיתי שקיבלת מ-Vercel)
5. לחצי **Create Web Service**.

הבנייה הראשונה לוקחת 5-10 דקות. כשמוכן יהיה לך URL כמו: `https://lead-finder-api.onrender.com`

### 2.3 - בדיקה

פתחי בדפדפן: `https://lead-finder-api.onrender.com/health`

אמור להופיע משהו כמו: `{"ok": true}` ✅

---

## 🔴 שלב 3: לחבר את Web ל-API

עכשיו צריך לעדכן את Vercel שיתחבר ל-API החדש:

1. לכי ל-Vercel → הפרויקט שלך → **Settings → Environment Variables**
2. ערכי את `NEXT_PUBLIC_API_URL` והכניסי את ה-URL של Render (למשל `https://lead-finder-api.onrender.com`)
3. לכי ל-**Deployments** → לחצי על שלוש הנקודות ליד הפריסה האחרונה → **Redeploy**

---

## 📱 שלב 4: שימוש מהטלפון

1. במכשיר הטלפון - פתחי את ה-URL של Vercel (למשל `lead-finder.vercel.app`)
2. התחברי עם המייל והסיסמה (אותו אחד מ-Supabase)
3. אם רוצה אייקון על המסך הראשי - בספארי: **Share → Add to Home Screen**

---

## 👥 שלב 5: להוסיף את העובד שלך

1. לכי ל-[Supabase Dashboard](https://supabase.com/dashboard) → הפרויקט
2. **Authentication → Users → Invite User**
3. הכניסי את המייל של העובד
4. הוא יקבל מייל הזמנה - יבחר סיסמה - יוכל להיכנס לאפליקציה.

> 💡 שני המשתמשים רואים אותם הלידים (כי הם באותו הפרויקט). אם רוצים הפרדה - זה דורש קוד נוסף.

---

## ⚙️ תחזוקה שוטפת

### עדכוני קוד
1. עורכת את הקוד מקומית
2. `git push`
3. Vercel ו-Render מעדכנים אוטומטית - תוך 1-2 דקות

### לוגים
- Vercel → Deployments → לחיצה על פריסה → "Logs"
- Render → Logs (תפריט שמאל)

### לעצור הכל (ולא לשלם)
- Render: בפלאן ה-Free אין תשלום, אבל אם רוצה אפשר Suspend Service
- Vercel: בפלאן Free אין תשלום בכלל

---

## 🆘 בעיות נפוצות

### "Internal Server Error" / 500 ב-API
לכי ללוגים של Render. סביר שחסר Environment Variable או שה-JWT Secret לא נכון.

### "Network Error" / 401 בדפדפן
- ב-Render → Environment - וודאי שיש `CORS_ORIGINS` עם ה-URL של Vercel
- ב-Vercel → Environment - וודאי ש-`NEXT_PUBLIC_API_URL` מצביע ל-Render

### Cold Start איטי (30-60 שניות בכניסה הראשונה)
זה תופעה ידועה של Render Free. פתרונות:
1. שדרוג ל-Starter ($7/חודש) - שרת תמידי
2. או שירות "ping" חיצוני שמעיר את השרת כל 10 דק' (לא ממש מתאים לחיסכון)

---

## 📊 סיכום עלויות חודשיות

| שירות | חינמי | מומלץ |
|-------|-------|-------|
| Vercel | ✅ חינם | חינם (Hobby plan) |
| Render | ✅ חינם (עם cold start) | $7/חודש (Starter) |
| Supabase | ✅ חינם (עד 50K משתמשים) | חינם |
| OpenAI | לא חינם - לפי שימוש | ~$5-15/חודש לשימוש סביר |
| **סה"כ מינימום** | **~$5-15** | **~$15-25** |

הוצאה עיקרית: **OpenAI** (לניתוח לידים ב-AI). אם תכבי "ניתוח AI" בכל חיפוש - זה ירד ל-$0.

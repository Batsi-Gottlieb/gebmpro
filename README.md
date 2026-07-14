# מערכת מעקב מסמכים - גוטליב את ביטון

מערכת לניהול ומעקב אחר מסמכים שלקוחות מעלים, מחולקת לפי פרויקטים/מחלקות.

## הארכיטקטורה

- **פרונט**: React + Vite (כמו שהיה, כמעט בלי שינוי חזותי)
- **DB + התחברות + אחסון קבצים**: Supabase (Postgres, Auth, Storage) - הפרונט מדבר איתו ישירות
- **לוגיקה מיוחדת** (כניסת לקוח עם קוד גישה, יצירת לקוחות, שליחת מיילים): Supabase Edge Functions - קוד ב-`supabase/functions`, רץ בענן של Supabase

קבצים חדשים/שהשתנו:
```
frontend/
  src/
    lib/supabaseClient.ts   <- חיבור ל-Supabase
    lib/api.ts              <- כל הפעולות מול ה-DB
    App.tsx                 <- הוחלף localStorage בקריאות אמיתיות
    types.ts                <- נוסף שדה projectId ל-Client
    components/AdminPanel.tsx  <- תיקון קטן: סינון לקוחות לפי פרויקט, הורדת קובץ אמיתית
backend/
  supabase/
    schema.sql              <- כל טבלאות ה-DB + הרשאות אבטחה (RLS)
    seed.sql                <- נתוני פרויקט "ניצנים" הראשון עם רשימת המסמכים
    functions/
      client-login/         <- כניסת לקוח עם קוד גישה
      create-client/        <- יצירת לקוח חדש (אדמין בלבד)
      import-clients/       <- ייבוא לקוחות בכמות מאקסל (אדמין בלבד)
      send-reminder/        <- שליחת תזכורת מייל אמיתית (בודדת/גורפת)
```

---

## שלב 1: יצירת פרויקט Supabase

1. היכנסו ל-https://supabase.com והירשמו / התחברו
2. New Project -> תנו שם (למשל `gottlieb-biton-docs`) -> בחרו סיסמת DB (שמרו אותה במקום בטוח, לא כאן בצ'אט) -> Region: קרוב לישראל (למשל `eu-central-1` פרנקפורט)
3. המתינו כ-2 דקות עד שהפרויקט מוכן

## שלב 2: הרצת הסכימה

1. בתפריט הצד: **SQL Editor** -> **New query**
2. פתחו את הקובץ `backend/supabase/schema.sql`, העתיקו את **כל** התוכן, הדביקו, לחצו **Run**
3. חזרו על אותו תהליך עם `backend/supabase/seed.sql` (זה יוצר את פרויקט "ניצנים" עם 10 המסמכים הנדרשים מהאפיון שלך)

> אם ה-Storage bucket לא נוצר אוטומטית מה-SQL (לפעמים דורש הרשאה נפרדת): לכו ל-**Storage** בתפריט הצד -> **New bucket** -> שם: `documents` -> **Private** (לא Public) -> Create.

## שלב 3: יצירת המשתמש הראשון שלך (אדמין/רו"ח)

1. **Authentication** -> **Users** -> **Add user** -> **Create new user**
2. הכניסו את האימייל והסיסמה שבהם תתחברי לפאנל הניהול -> Create user
3. העתיקו את ה-`User UID` שמופיע ליד המשתמש שנוצר
4. חזרו ל-**SQL Editor** והריצו (עם ה-UID שהעתקתם):

```sql
insert into staff (id, full_name, email)
values ('ההדבק-כאן-את-ה-UID', 'השם שלך', 'האימייל שלך');
```

מעכשיו תוכלי להתחבר לפאנל הניהול עם האימייל/סיסמה האלה (יש קישור "כניסת צוות המשרד" בתחתית מסך הכניסה).

## שלב 4: פרטי החיבור לפרונט (.env)

1. **Project Settings** -> **API**
2. העתיקו **Project URL** ו-**anon public key** (אלה בטוחים לשימוש בפרונט - הם מוגנים ע"י ה-RLS שכתבתי)
3. בתיקיית הפרויקט, העתיקו את `.env.example` לקובץ בשם `.env` ומלאו:

```
VITE_SUPABASE_URL="https://xxxxx.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJxxxxx..."
```

## שלב 5: הרצה מקומית לבדיקה

```bash
npm install
npm run dev
```

נסי להתחבר עם "כניסת צוות המשרד" באימייל/סיסמה שיצרת בשלב 3. תוכלי ליצור לקוח חדש, לקבל קוד גישה, ולהתחבר איתו בחלון גלישה נסתר (Incognito) כדי לבדוק את חוויית הלקוח.

---

## שלב 6: הגדרת שליחת מיילים אמיתית (SMTP)

כדי ש"שליחת תזכורת" תשלח מייל אמיתי (ולא רק תרשום ביומן), צריך פרטי SMTP של מערכת המייל הייעודית של המשרד (קיים אצל כל ספק אחסון מייל - IONOS, Google Workspace, Office 365, וכו' תחת "SMTP settings" או "Outgoing mail server").

צרכי מידע:
- `SMTP_HOST` (למשל smtp.office365.com)
- `SMTP_PORT` (בד"כ 587)
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM` (כתובת השולח, למשל office@gottlieb-biton.co.il)

כשיהיו לך אלה, מגדירים אותם כ-Secrets ל-Edge Functions (ראו שלב 7 - `supabase secrets set`).

---

## שלב 7: פריסת ה-Edge Functions (דרך Supabase CLI)

1. התקנת ה-CLI (חד פעמי):
```bash
npm install -g supabase
```
2. התחברות:
```bash
supabase login
```
3. מתוך תיקיית `backend`, קישור לפרויקט (המזהה נמצא ב-Project Settings -> General -> Reference ID):
```bash
cd backend
supabase link --project-ref YOUR_PROJECT_REF
```
4. הגדרת ה-Secrets (מיילים + מפתחות פנימיים):
```bash
supabase secrets set SMTP_HOST=smtp.example.com SMTP_PORT=587 SMTP_USERNAME=xxx SMTP_PASSWORD=xxx SMTP_FROM=office@example.co.il
```
(את `SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY` הפונקציות מקבלות אוטומטית - לא צריך להגדיר ידנית)

5. פריסת כל הפונקציות:
```bash
supabase functions deploy client-login
supabase functions deploy create-client
supabase functions deploy import-clients
supabase functions deploy send-reminder
```

---

## שלב 8: העלאה ל-GitHub

```bash
git init
git add .
git commit -m "מערכת מעקב מסמכים - גוטליב את ביטון"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```

**חשוב**: קובץ `.env` לא יעלה ל-GitHub (הוא ב-`.gitignore` הקיים) - זה נכון ורצוי, כי אלה משתני סביבה. ב-Vercel/Netlify תגדירי אותם מחדש בממשק (שלב הבא).

## שלב 9: פריסת הפרונט (Vercel - מומלץ, מתחבר אוטומטית ל-GitHub)

1. https://vercel.com -> Add New Project -> יבוא מ-GitHub -> בחרי את ה-repo
2. Framework Preset: Vite (יזוהה אוטומטית)
3. Environment Variables: הוסיפי `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY` (אותם ערכים מה-`.env` המקומי)
4. Deploy - מעכשיו כל `git push` יעדכן אוטומטית את האתר החי

---

## מה עובד עכשיו במלואו

- הרשמת/הוספת לקוחות (בודד + ייבוא אקסל) עם קוד גישה אמיתי שנוצר אוטומטית
- כניסת לקוח עם קוד גישה בלבד (מאובטח דרך Supabase Auth "מתחת למכסה המנוע")
- העלאת קבצים אמיתית ל-Storage + היסטוריית גרסאות
- בדיקה ואישור/פסילה של מסמכים ע"י הרו"ח, עם הורדת הקובץ בפועל
- שליחת מייל תזכורת אמיתי (בודד או גורף לכולם) - לאחר הגדרת שלב 6-7
- הפרדת נתונים מלאה בין פרויקטים/מחלקות (RLS ברמת מסד הנתונים, לא רק בממשק)

## מה נשאר לשלב הבא (לא נבנה כרגע, כדי לא להכביד סחורה שלא ביקשת)

- **תזמון אוטומטי** לשליחת תזכורות כל X ימים ללא לחיצה ידנית (אפשר להוסיף cron ב-Supabase או GitHub Actions שקורא ל-`send-reminder` כל יום)
- **SMS** - אמרת שלא דחוף כרגע; כשתרצי, מוסיפים ספק (019/InforU/Twilio) לאותה Edge Function
- הורדת קובץ מהצד של הלקוח עצמו (כרגע יש רק לרו"ח בפאנל הניהול)

תגידי לי כשתרצי שאבנה את אחד מאלה, או אם נתקלת בשגיאה בדרך - תשלחי לי את הודעת השגיאה (בלי סיסמאות!) ונפתור ביחד.

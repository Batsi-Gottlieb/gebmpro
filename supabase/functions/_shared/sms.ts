// עוזר משותף לשליחת SMS - כרגע SCAFFOLD גנרי בלבד.
//
// עדיין לא נבחר ספק SMS. כדי להפעיל שליחה בפועל:
// 1. פתחו חשבון אצל ספק SMS (מומלץ ספק ישראלי שתומך בעברית ותווים בעבריה
//    בלי בעיות קידוד, כמו "019 SMS" או "InforU" - יש כמה אפשרויות סבירות).
// 2. הגדירו את ה-Secrets הבאים בפרויקט Supabase:
//    SMS_API_URL, SMS_API_KEY, SMS_SENDER (שם השולח שיוצג ללקוח)
// 3. עדכנו את פונקציית sendSms למטה כך שתתאים לפורמט הבקשה המדויק
//    של הספק שבחרתם (כל ספק מגדיר פרמטרים שונים - יש לבדוק בתיעוד שלו).
//    כרגע הפונקציה שולחת POST גנרי בפורמט JSON סביר, אבל זה עלול לא
//    להתאים 1:1 לספק הספציפי - יש לאמת מול הדוגמאות בתיעוד הספק.
//
// עד אז, שליחת SMS תיכשל בצורה מבוקרת (best-effort, לא תפיל את יצירת הלקוח)
// ותתועד ב-notification_logs עם status='failed' והודעת שגיאה מתאימה.

export async function sendSms(
  to: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const apiUrl = Deno.env.get('SMS_API_URL')
  const apiKey = Deno.env.get('SMS_API_KEY')
  const sender = Deno.env.get('SMS_SENDER')

  if (!apiUrl || !apiKey) {
    return { ok: false, error: 'שליחת SMS לא הוגדרה עדיין (חסרים SMS_API_URL / SMS_API_KEY)' }
  }

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ to, message, sender }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `SMS provider returned ${res.status}: ${text.slice(0, 200)}` }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'שגיאת שליחת SMS' }
  }
}

export function buildWelcomeSms(clientName: string, accessCode: string, appUrl?: string): string {
  const link = appUrl ? ` ${appUrl}` : ''
  return `שלום ${clientName}, קוד הגישה שלך לפורטל מסמכים גוטליב את ביטון: ${accessCode}.${link}`
}

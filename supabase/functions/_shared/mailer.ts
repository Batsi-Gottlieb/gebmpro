// עוזר משותף לשליחת מייל - עובר על HTTP (Resend API) ולא על SMTP גולמי.
//
// למה השינוי: חיבור SMTP גולמי (denomailer) בסביבת Deno Edge Functions
// גרם לקריסות "קשות" של כל התהליך (503, לא שגיאת JS רגילה שאפשר לתפוס
// ב-try/catch) כשהחיבור נכשל/נתקע - ללא קשר לתיקוני timeout שניסינו.
// קריאת HTTP רגילה (fetch) לא סובלת מהבעיה הזו.
//
// דורש את ה-Secrets: RESEND_API_KEY, RESEND_FROM (כתובת/שם השולח, למשל
// "גוטליב את ביטון <no-reply@gebm.co.il>" - הדומיין חייב להיות מאומת ב-Resend,
// או להשתמש בכתובת הבדיקה onboarding@resend.dev לפני אימות דומיין).

export async function sendMail(
  to: string,
  subject: string,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM')

  if (!apiKey || !from) {
    return { ok: false, error: 'שליחת מייל לא הוגדרה עדיין (חסרים RESEND_API_KEY / RESEND_FROM)' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text: content,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `Resend API החזיר ${res.status}: ${text.slice(0, 300)}` }
    }

    return { ok: true }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'שליחת המייל חלפה מעבר לזמן המוקצב (8 שניות)' }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'שגיאת שליחה' }
  } finally {
    clearTimeout(timeoutId)
  }
}

export function buildWelcomeEmail(clientName: string, accessCode: string, appUrl?: string): string {
  const link = appUrl ? `\n\nלכניסה לפורטל: ${appUrl}` : ''
  return (
    `שלום ${clientName},\n\n` +
    `נפתח לך חשבון בפורטל הגשת המסמכים של גוטליב את ביטון.\n` +
    `קוד הגישה שלך לכניסה לפורטל: ${accessCode}${link}\n\n` +
    `נא לשמור קוד זה - הוא משמש אותך במקום שם משתמש וסיסמה.`
  )
}

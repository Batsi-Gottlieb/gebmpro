// עוזר משותף לשליחת מייל (SMTP) - משמש create-client / import-clients /
// create-staff / add-client-contact / resend-access-code.
// דורש את ה-Secrets: SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { withTimeout } from './withTimeout.ts'

export async function sendMail(
  to: string,
  subject: string,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  const smtpClient = new SMTPClient({
    connection: {
      hostname: Deno.env.get('SMTP_HOST')!,
      port: Number(Deno.env.get('SMTP_PORT') ?? '587'),
      tls: true,
      auth: {
        username: Deno.env.get('SMTP_USERNAME')!,
        password: Deno.env.get('SMTP_PASSWORD')!,
      },
    },
  })

  try {
    await withTimeout(
      smtpClient.send({
        from: Deno.env.get('SMTP_FROM')!,
        to,
        subject,
        content,
      }),
      8000,
      'שליחת מייל (SMTP)'
    )
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'שגיאת שליחה' }
  } finally {
    // סוגרים את החיבור בצורה בטוחה (עם timeout משלה) - אם השליחה נכשלה
    // או נתקעה, close() עלול לזרוק שגיאה משלו ולהקריס את כל הפונקציה
    // (500 / net::ERR_FAILED) במקום להחזיר תשובה מבוקרת.
    try {
      await withTimeout(smtpClient.close(), 3000, 'סגירת חיבור SMTP')
    } catch {
      // מתעלמים - זה רק ניקוי חיבור, לא צריך להשפיע על תוצאת השליחה
    }
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

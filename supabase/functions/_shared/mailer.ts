// עוזר משותף לשליחת מייל (SMTP) - משמש create-client / import-clients
// לשליחת קוד הגישה של לקוח חדש, ואפשר גם ל-send-reminder בעתיד.
// דורש את ה-Secrets: SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

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
    await smtpClient.send({
      from: Deno.env.get('SMTP_FROM')!,
      to,
      subject,
      content,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'שגיאת שליחה' }
  } finally {
    await smtpClient.close()
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

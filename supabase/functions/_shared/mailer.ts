// עוזר משותף לשליחת מייל - עובר על HTTP (Resend API) ולא על SMTP גולמי.
// דורש את ה-Secrets: RESEND_API_KEY, RESEND_FROM

export async function sendMail(
  to: string,
  subject: string,
  content: string,
  html?: string
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
        ...(html ? { html } : {}),
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// עוטף טקסט מייל רגיל בתבנית HTML נאה עם לוגו החברה בכותרת.
// הלוגו נטען מהדומיין של האתר עצמו (appUrl/logo.png) - חייב שה-appUrl
// שהתקבל מהפרונט (window.location.origin) יהיה כתובת ה-Vercel החיה.
export function buildEmailHtml(bodyText: string, appUrl?: string): string {
  const logoUrl = appUrl ? `${appUrl}/logo.png` : null
  const bodyHtml = bodyText
    .split('\n')
    .map((line) => (line.length ? `<p style="margin:0 0 10px 0;">${escapeHtml(line)}</p>` : '<div style="height:8px;"></div>'))
    .join('')

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;max-width:90%;">
          <tr>
            <td align="center" style="padding:28px 24px 12px 24px;">
              ${logoUrl ? `<img src="${logoUrl}" alt="גוטליב את ביטון" width="72" style="display:block;margin:0 auto 12px auto;" />` : ''}
              <div style="font-size:16px;font-weight:bold;color:#1e293b;">גוטליב את ביטון</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px 28px;color:#1e293b;font-size:14px;line-height:1.7;text-align:right;direction:rtl;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

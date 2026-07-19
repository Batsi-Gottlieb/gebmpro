// עוזר משותף לשליחת הודעות WhatsApp - כרגע SCAFFOLD גנרי בלבד.
//
// עדיין לא נבחר ספק WhatsApp. כדי להפעיל שליחה בפועל, יש לבחור אחת מהאפשרויות:
// 1. WhatsApp Business Cloud API הרשמי של Meta (מחייב אימות עסק / מספר וואטסאפ עסקי).
// 2. ספק מתווך כמו Twilio WhatsApp, Green API, WATI, MessageBird ועוד - בדרך כלל
//    קלים יותר להקמה ראשונית, אך יש להם עלות לפי הודעה.
//
// לאחר בחירת ספק, הגדירו את ה-Secrets הבאים בפרויקט Supabase:
//    WHATSAPP_API_URL, WHATSAPP_API_KEY, WHATSAPP_FROM (מספר/שם השולח, אם נדרש ע"י הספק)
// ועדכנו את פונקציית sendWhatsApp למטה כך שתתאים לפורמט הבקשה המדויק של הספק
// שבחרתם (כל ספק מגדיר פרמטרים שונים - יש לבדוק בתיעוד שלו).
//
// עד אז, שליחת WhatsApp תיכשל בצורה מבוקרת (best-effort, לא תפיל את שליחת התזכורת)
// ותתועד ב-notification_logs עם status='failed' והודעת שגיאה מתאימה - שליחת המייל
// באותה תזכורת תמשיך לעבוד כרגיל בלי תלות בזה.

export async function sendWhatsApp(
  to: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const apiUrl = Deno.env.get('WHATSAPP_API_URL')
  const apiKey = Deno.env.get('WHATSAPP_API_KEY')
  const from = Deno.env.get('WHATSAPP_FROM')

  if (!apiUrl || !apiKey) {
    return { ok: false, error: 'שליחת WhatsApp לא הוגדרה עדיין (חסרים WHATSAPP_API_URL / WHATSAPP_API_KEY)' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ to, message, from }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `WhatsApp provider returned ${res.status}: ${text.slice(0, 200)}` }
    }

    return { ok: true }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'שליחת ה-WhatsApp חלפה מעבר לזמן המוקצב (8 שניות)' }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'שגיאת שליחת WhatsApp' }
  } finally {
    clearTimeout(timeoutId)
  }
}

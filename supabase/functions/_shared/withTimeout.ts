// עוזר משותף: מבצע Promise עם הגבלת זמן.
//
// שימושי לחיבורי רשת (כמו SMTP) שיכולים "להיתקע" (host/port שגויים
// או לא נגישים) ולגרום לכל הפונקציה להיתקע עד שהפלטפורמה של Supabase
// מפילה אותה - וזה מתבטא בדפדפן כ-503 או net::ERR_FAILED בלי שום
// הודעת שגיאה שימושית. עם timeout מפורש נקבל כשל מהיר וברור, שגם
// יתועד כראוי ב-notification_logs.
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label}: חלף הזמן המוקצב (${ms}ms) - כנראה host/port שגויים או לא נגישים`)),
          ms
        )
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

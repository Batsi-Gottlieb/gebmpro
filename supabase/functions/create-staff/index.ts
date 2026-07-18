// supabase/functions/create-staff/index.ts
//
// יוצר איש/אשת צוות חדש (אדמין נוסף) שיכול להתחבר לפאנל הניהול.
// חייב להגיע ממשתמש מחובר שכבר נמצא בטבלת staff.
// יוצר משתמש Auth חדש + שורת staff, ושולח מייל עם קישור להגדרת סיסמה
// (בדיוק כמו איפוס סיסמה - reuse את אותו מסך "קביעת סיסמה חדשה" בפרונט).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { sendMail } from '../_shared/mailer.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'נדרש חיבור' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token)
    if (callerError || !callerData.user) {
      return new Response(JSON.stringify({ error: 'חיבור לא תקין' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: staffRow } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('id', callerData.user.id)
      .maybeSingle()

    if (!staffRow) {
      return new Response(JSON.stringify({ error: 'אין הרשאה - פעולה זו מיועדת לצוות המשרד בלבד' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { fullName, email, appUrl } = await req.json()

    if (!fullName || !email) {
      return new Response(JSON.stringify({ error: 'שדות חובה חסרים (שם, אימייל)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // שלב 1: יצירת משתמש Auth חדש עם סיסמה אקראית (יוחלף ע"י הקישור שיישלח)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
    })

    if (authError || !authUser.user) {
      return new Response(JSON.stringify({ error: authError?.message ?? 'שגיאה ביצירת חשבון המשתמש' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // שלב 2: שורת staff
    const { data: newStaff, error: insertError } = await supabaseAdmin
      .from('staff')
      .insert({ id: authUser.user.id, full_name: fullName, email })
      .select()
      .single()

    if (insertError || !newStaff) {
      // מנקים את משתמש ה-Auth אם לא הצלחנו לרשום אותו כ-staff
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return new Response(JSON.stringify({ error: insertError?.message ?? 'שגיאה ביצירת רשומת הצוות' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // שלב 3: קישור להגדרת סיסמה - אותו מנגנון בדיוק כמו "שכחתי סיסמה"
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: appUrl ? { redirectTo: appUrl } : undefined,
    })

    let emailSent = false
    if (!linkError && linkData?.properties?.action_link) {
      const body =
        `שלום ${fullName},\n\n` +
        `נוצר לך חשבון ניהול במערכת מסמכים - גוטליב את ביטון.\n` +
        `להגדרת סיסמה וכניסה ראשונה, לחץ/י על הקישור הבא:\n${linkData.properties.action_link}\n\n` +
        `הקישור תקף לזמן מוגבל.`
      const mailResult = await sendMail(email, 'הזמנה לניהול המערכת', body)
      emailSent = mailResult.ok
    }

    return new Response(
      JSON.stringify({
        staff: { id: newStaff.id, fullName: newStaff.full_name, email: newStaff.email },
        emailSent,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: 'שגיאה כללית בשרת' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

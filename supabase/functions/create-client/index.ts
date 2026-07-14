// supabase/functions/create-client/index.ts
//
// קריאה זו חייבת להגיע ממשתמש מחובר שנמצא בטבלת staff (איש צוות המשרד).
// יוצרת: 1) לקוח חדש בטבלת clients  2) משתמש פנימי ב-Auth שמאפשר
// לו להתחבר בהמשך רק עם קוד הגישה (client-login).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

function generateAccessCode(prefix: string) {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}-${num}`
}

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

    // מוודאים שהקורא הוא משתמש מחובר ושהוא איש צוות
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

    const { projectId, name, email, phone, role, sendNotificationsToManager, notes, codePrefix } =
      await req.json()

    if (!projectId || !name || !email) {
      return new Response(JSON.stringify({ error: 'שדות חובה חסרים (פרויקט, שם, אימייל)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accessCode = generateAccessCode(codePrefix || 'GB')

    // שלב 1: יצירת שורת הלקוח
    const { data: newClient, error: insertError } = await supabaseAdmin
      .from('clients')
      .insert({
        project_id: projectId,
        name,
        email,
        phone: phone ?? null,
        role: role === 'manager' ? 'manager' : 'regular',
        send_notifications_to_manager: !!sendNotificationsToManager,
        notes: notes ?? null,
        access_code: accessCode,
      })
      .select()
      .single()

    if (insertError || !newClient) {
      return new Response(JSON.stringify({ error: insertError?.message ?? 'שגיאה ביצירת הלקוח' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // שלב 2: יצירת משתמש פנימי ב-Auth (אימייל סינתטי, לא ישמש לתקשורת בפועל)
    const internalEmail = `client-${newClient.id}@clients.internal`
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: crypto.randomUUID(), // סיסמה אקראית - הלקוח לעולם לא ישתמש בה, רק בקוד הגישה
      email_confirm: true,
    })

    if (authError || !authUser.user) {
      // מנקים את שורת הלקוח אם יצירת המשתמש נכשלה, כדי לא להשאיר רשומה תקולה
      await supabaseAdmin.from('clients').delete().eq('id', newClient.id)
      return new Response(JSON.stringify({ error: authError?.message ?? 'שגיאה ביצירת חשבון גישה' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // שלב 3: קישור המשתמש הפנימי לשורת הלקוח
    const { error: linkError } = await supabaseAdmin
      .from('clients')
      .update({ auth_user_id: authUser.user.id })
      .eq('id', newClient.id)

    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ client: { ...newClient, access_code: accessCode } }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: 'שגיאה כללית בשרת' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

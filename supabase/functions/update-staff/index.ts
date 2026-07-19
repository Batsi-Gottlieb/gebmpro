// supabase/functions/update-staff/index.ts
//
// מעדכן פרטים של איש צוות קיים (שם/אימייל/סיסמה). חייב להגיע ממשתמש
// מחובר שנמצא בטבלת staff. מעדכן גם את משתמש ה-Auth (email/password)
// וגם את שורת staff (full_name/email). לא נשלח כל מייל בתהליך.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

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

    const { data: callerStaffRow } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('id', callerData.user.id)
      .maybeSingle()

    if (!callerStaffRow) {
      return new Response(JSON.stringify({ error: 'אין הרשאה - פעולה זו מיועדת לצוות המשרד בלבד' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { staffId, fullName, email, password } = await req.json()

    if (!staffId) {
      return new Response(JSON.stringify({ error: 'נא לספק staffId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!fullName && !email && !password) {
      return new Response(JSON.stringify({ error: 'נא לספק לפחות שדה אחד לעדכון (שם/אימייל/סיסמה)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (password !== undefined && password !== null && password !== '') {
      if (typeof password !== 'string' || password.length < 6) {
        return new Response(JSON.stringify({ error: 'הסיסמה חייבת להיות באורך 6 תווים לפחות' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { data: existingStaff, error: existingError } = await supabaseAdmin
      .from('staff')
      .select('id, full_name, email')
      .eq('id', staffId)
      .maybeSingle()

    if (existingError || !existingStaff) {
      return new Response(JSON.stringify({ error: 'איש הצוות לא נמצא' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // שלב 1: עדכון משתמש ה-Auth (אימייל/סיסמה) אם התבקש
    if (email || password) {
      const authUpdates: Record<string, unknown> = {}
      if (email) {
        authUpdates.email = email
        authUpdates.email_confirm = true
      }
      if (password) {
        authUpdates.password = password
      }

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(staffId, authUpdates)
      if (authUpdateError) {
        return new Response(JSON.stringify({ error: authUpdateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // שלב 2: עדכון שורת staff (שם/אימייל)
    const staffUpdates: Record<string, unknown> = {}
    if (fullName) staffUpdates.full_name = fullName
    if (email) staffUpdates.email = email

    let updatedStaff = existingStaff
    if (Object.keys(staffUpdates).length > 0) {
      const { data, error: updateError } = await supabaseAdmin
        .from('staff')
        .update(staffUpdates)
        .eq('id', staffId)
        .select()
        .single()

      if (updateError || !data) {
        return new Response(JSON.stringify({ error: updateError?.message ?? 'שגיאה בעדכון רשומת הצוות' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      updatedStaff = data
    }

    return new Response(
      JSON.stringify({
        staff: { id: updatedStaff.id, fullName: updatedStaff.full_name, email: updatedStaff.email },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: 'שגיאה כללית בשרת' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

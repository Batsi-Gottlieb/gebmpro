// supabase/functions/client-login/index.ts
//
// מקבל קוד גישה (accessCode) מהלקוח, מאתר אותו בטבלת clients,
// ומחזיר session מלא (access_token + refresh_token) כדי שהפרונט
// יוכל להתחבר בפועל ל-Supabase Auth בלי שהלקוח יראה אימייל/סיסמה כלל.
//
// חשוב: פונקציה זו משתמשת ב-SERVICE_ROLE_KEY (מפתח על) ולכן
// חייבת לרוץ אך ורק בצד שרת (Edge Function) - לעולם לא בפרונט.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { accessCode } = await req.json()

    if (!accessCode || typeof accessCode !== 'string') {
      return new Response(JSON.stringify({ error: 'נא להזין קוד גישה' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // מאתרים את הלקוח לפי קוד הגישה (לא תלוי רישיות)
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, auth_user_id, project_id')
      .ilike('access_code', accessCode.trim())
      .maybeSingle()

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: 'קוד גישה אינו תקין' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!client.auth_user_id) {
      return new Response(
        JSON.stringify({ error: 'חשבון הלקוח טרם הופעל. נא לפנות למשרד.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // מייצרים session ישירות עבור המשתמש הפנימי של הלקוח,
    // בלי לחשוף את מנגנון האימייל/סיסמה הסינתטי
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(client.auth_user_id)

    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: 'שגיאה באיתור חשבון הלקוח' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // יוצרים קישור magic-link חד-פעמי ומממשים אותו מיידית לצורך קבלת session
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email,
    })

    if (linkError || !linkData.properties?.hashed_token) {
      return new Response(JSON.stringify({ error: 'שגיאה ביצירת חיבור מאובטח' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ממירים את ה-token ל-session אמיתי (access_token + refresh_token)
    const supabasePublic = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    const { data: sessionData, error: verifyError } = await supabasePublic.auth.verifyOtp({
      type: 'magiclink',
      token_hash: linkData.properties.hashed_token,
    })

    if (verifyError || !sessionData.session) {
      return new Response(JSON.stringify({ error: 'שגיאה באימות החיבור' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        session: sessionData.session,
        client: { id: client.id, name: client.name, projectId: client.project_id },
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

// supabase/functions/add-client-contact/index.ts
//
// מוסיף איש קשר נוסף ללקוח קיים (כמה עובדים מהחברה שנכנסים לפורטל
// עם אותו קוד גישה של הלקוח הראשי). שולח לאיש הקשר החדש מייל+SMS
// עם קוד הגישה - כמו בהוספת לקוח חדש. דורש הרשאת staff.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { sendMail, buildWelcomeEmail, buildEmailHtml } from '../_shared/mailer.ts'
import { sendSms, buildWelcomeSms } from '../_shared/sms.ts'

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
      return new Response(JSON.stringify({ error: 'אין הרשאה' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { clientId, name, email, phone, receivesNotifications, appUrl } = await req.json()

    if (!clientId || !name) {
      return new Response(JSON.stringify({ error: 'שדות חובה חסרים (לקוח, שם)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, access_code')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: 'הלקוח לא נמצא' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: newContact, error: insertError } = await supabaseAdmin
      .from('client_contacts')
      .insert({
        client_id: clientId,
        name,
        email: email ?? null,
        phone: phone ?? null,
        receives_notifications: receivesNotifications ?? true,
      })
      .select()
      .single()

    if (insertError || !newContact) {
      return new Response(JSON.stringify({ error: insertError?.message ?? 'שגיאה בהוספת איש הקשר' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // הודעת כניסה ראשונית עם קוד הגישה - נשלחת לכולם, ללא תלות בדגל ההתראות
    let emailSent = false
    let smsSent = false

    if (email) {
      const emailBody = buildWelcomeEmail(name, client.access_code, appUrl)
      const mailResult = await sendMail(email, 'פרטי כניסה לפורטל המסמכים', emailBody, buildEmailHtml(emailBody, appUrl))
      emailSent = mailResult.ok
      await supabaseAdmin.from('notification_logs').insert({
        client_id: clientId,
        client_name: client.name,
        type: 'email',
        recipient: email,
        subject: 'פרטי כניסה לפורטל המסמכים',
        content: emailBody,
        status: mailResult.ok ? 'sent' : 'failed',
        error_message: mailResult.ok ? null : mailResult.error ?? null,
      })
    }

    if (phone) {
      const smsBody = buildWelcomeSms(name, client.access_code, appUrl)
      const smsResult = await sendSms(phone, smsBody)
      smsSent = smsResult.ok
      await supabaseAdmin.from('notification_logs').insert({
        client_id: clientId,
        client_name: client.name,
        type: 'sms',
        recipient: phone,
        content: smsBody,
        status: smsResult.ok ? 'sent' : 'failed',
        error_message: smsResult.ok ? null : smsResult.error ?? null,
      })
    }

    return new Response(
      JSON.stringify({ contact: newContact, emailSent, smsSent }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: 'שגיאה כללית בשרת' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

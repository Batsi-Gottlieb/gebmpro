// supabase/functions/resend-access-code/index.ts
//
// שולח מחדש (מייל + SMS) את קוד הגישה הקיים של לקוח/לקוחות נבחרים -
// לא יוצר קוד גישה חדש, רק שולח שוב את אותו הקוד. נשלח לאיש הקשר
// הראשי וגם לכל אנשי הקשר הנוספים של אותו לקוח. דורש הרשאת staff.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { sendMail, buildWelcomeEmail } from '../_shared/mailer.ts'
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

    const { clientIds, appUrl } = (await req.json()) as { clientIds: string[]; appUrl?: string }

    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return new Response(JSON.stringify({ error: 'נא לבחור לפחות לקוח אחד' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: { clientId: string; emailsSent: number; smsSent: number }[] = []

    for (const clientId of clientIds) {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, name, email, phone, access_code')
        .eq('id', clientId)
        .maybeSingle()

      if (!client) {
        results.push({ clientId, emailsSent: 0, smsSent: 0 })
        continue
      }

      const { data: contacts } = await supabaseAdmin
        .from('client_contacts')
        .select('name, email, phone')
        .eq('client_id', clientId)

      // רשימת נמענים: הלקוח הראשי + כל אנשי הקשר הנוספים
      const recipients: { name: string; email: string | null; phone: string | null }[] = [
        { name: client.name, email: client.email, phone: client.phone },
        ...((contacts ?? []).map((c) => ({ name: c.name, email: c.email, phone: c.phone }))),
      ]

      let emailsSent = 0
      let smsSent = 0

      for (const recipient of recipients) {
        if (recipient.email) {
          const emailBody = buildWelcomeEmail(recipient.name, client.access_code, appUrl)
          const mailResult = await sendMail(recipient.email, 'שליחה חוזרת: פרטי כניסה לפורטל המסמכים', emailBody)
          if (mailResult.ok) emailsSent++
          await supabaseAdmin.from('notification_logs').insert({
            client_id: clientId,
            client_name: client.name,
            type: 'email',
            recipient: recipient.email,
            subject: 'שליחה חוזרת: פרטי כניסה לפורטל המסמכים',
            content: emailBody,
            status: mailResult.ok ? 'sent' : 'failed',
            error_message: mailResult.ok ? null : mailResult.error ?? null,
          })
        }

        if (recipient.phone) {
          const smsBody = buildWelcomeSms(recipient.name, client.access_code, appUrl)
          const smsResult = await sendSms(recipient.phone, smsBody)
          if (smsResult.ok) smsSent++
          await supabaseAdmin.from('notification_logs').insert({
            client_id: clientId,
            client_name: client.name,
            type: 'sms',
            recipient: recipient.phone,
            content: smsBody,
            status: smsResult.ok ? 'sent' : 'failed',
            error_message: smsResult.ok ? null : smsResult.error ?? null,
          })
        }
      }

      results.push({ clientId, emailsSent, smsSent })
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'שגיאה כללית בשרת' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

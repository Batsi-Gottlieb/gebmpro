// supabase/functions/import-clients/index.ts
//
// מקבל מערך לקוחות (שהפרונט כבר קרא מקובץ האקסל באמצעות ספריית
// כמו xlsx/sheetjs), ויוצר לכל אחד מהם לקוח + חשבון גישה, בדיוק
// כמו create-client אבל בכמות. דורש הרשאת staff.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { sendMail, buildWelcomeEmail, buildEmailHtml } from '../_shared/mailer.ts'
import { sendSms, buildWelcomeSms } from '../_shared/sms.ts'

function generateAccessCode(prefix: string) {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}-${num}`
}

interface ImportRow {
  name: string
  email: string
  phone?: string
  role?: 'manager' | 'regular'
  sendNotificationsToManager?: boolean
  notes?: string
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

    const { projectId, rows, codePrefix, appUrl } = (await req.json()) as {
      projectId: string
      rows: ImportRow[]
      codePrefix?: string
      appUrl?: string
    }

    if (!projectId || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'נא לספק פרויקט ורשימת לקוחות' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const created: unknown[] = []
    const failed: { row: ImportRow; error: string }[] = []

    for (const row of rows) {
      if (!row.name || !row.email) {
        failed.push({ row, error: 'שם או אימייל חסרים' })
        continue
      }

      const accessCode = generateAccessCode(codePrefix || 'GB')

      const { data: newClient, error: insertError } = await supabaseAdmin
        .from('clients')
        .insert({
          project_id: projectId,
          name: row.name,
          email: row.email,
          phone: row.phone ?? null,
          role: row.role === 'manager' ? 'manager' : 'regular',
          send_notifications_to_manager: !!row.sendNotificationsToManager,
          notes: row.notes ?? null,
          access_code: accessCode,
        })
        .select()
        .single()

      if (insertError || !newClient) {
        failed.push({ row, error: insertError?.message ?? 'שגיאה ביצירה' })
        continue
      }

      const internalEmail = `client-${newClient.id}@clients.internal`
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: internalEmail,
        password: crypto.randomUUID(),
        email_confirm: true,
      })

      if (authError || !authUser.user) {
        await supabaseAdmin.from('clients').delete().eq('id', newClient.id)
        failed.push({ row, error: authError?.message ?? 'שגיאה ביצירת חשבון גישה' })
        continue
      }

      await supabaseAdmin
        .from('clients')
        .update({ auth_user_id: authUser.user.id })
        .eq('id', newClient.id)

      // שליחת מייל + SMS עם קוד הגישה - best-effort, לא חוסמת/מפילה את שאר הייבוא
      const emailBody = buildWelcomeEmail(row.name, accessCode, appUrl)
      const mailResult = await sendMail(row.email, 'פרטי כניסה לפורטל המסמכים', emailBody, buildEmailHtml(emailBody, appUrl))
      await supabaseAdmin.from('notification_logs').insert({
        client_id: newClient.id,
        client_name: row.name,
        project_id: projectId,
        type: 'email',
        recipient: row.email,
        subject: 'פרטי כניסה לפורטל המסמכים',
        content: emailBody,
        status: mailResult.ok ? 'sent' : 'failed',
        error_message: mailResult.ok ? null : mailResult.error ?? null,
      })

      if (row.phone) {
        const smsBody = buildWelcomeSms(row.name, accessCode, appUrl)
        const smsResult = await sendSms(row.phone, smsBody)
        await supabaseAdmin.from('notification_logs').insert({
          client_id: newClient.id,
          client_name: row.name,
          project_id: projectId,
          type: 'sms',
          recipient: row.phone,
          content: smsBody,
          status: smsResult.ok ? 'sent' : 'failed',
          error_message: smsResult.ok ? null : smsResult.error ?? null,
        })
      }

      created.push({ ...newClient, access_code: accessCode })
    }

    return new Response(JSON.stringify({ created, failed, total: rows.length }), {
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

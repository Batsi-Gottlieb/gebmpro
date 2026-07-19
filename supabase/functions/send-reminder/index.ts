// supabase/functions/send-reminder/index.ts
//
// שולח תזכורת מייל אמיתית ללקוח אחד (mode: "single") או לכל
// הלקוחות בפרויקט שטרם השלימו הגשה (mode: "bulk"), לפי הגדרות
// הפרויקט (email_template) ורשימת המסמכים החסרים/הפסולים בפועל.
// דורש הרשאת staff. שולח מייל דרך Resend API (ראו _shared/mailer.ts).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { sendMail, buildEmailHtml } from '../_shared/mailer.ts'
import { sendWhatsApp } from '../_shared/whatsapp.ts'

interface RequiredDoc {
  id: string
  name: string
  is_required: boolean
}
interface FileVersionRow {
  document_id: string
  status: string
  review_comment: string | null
}
interface ClientRow {
  id: string
  name: string
  email: string
  phone: string
  role: string
  send_notifications_to_manager: boolean
  access_code: string
  receives_notifications: boolean
}

function buildMissingList(requiredDocs: RequiredDoc[], files: FileVersionRow[]): string {
  const latestByDoc = new Map<string, FileVersionRow>()
  for (const f of files) {
    if (!latestByDoc.has(f.document_id)) latestByDoc.set(f.document_id, f)
  }

  const missing: string[] = []
  for (const doc of requiredDocs) {
    if (!doc.is_required) continue
    const latest = latestByDoc.get(doc.id)
    if (!latest) {
      missing.push(`- ${doc.name} (חסר)`)
    } else if (latest.status === 'rejected') {
      missing.push(`- ${doc.name} (לא תקין: ${latest.review_comment || 'נא להעלות שוב'})`)
    }
  }
  return missing.join('\n')
}

function renderTemplate(
  template: string,
  vars: { clientName: string; projectName: string; accessCode: string; missingDocuments: string; appUrl: string }
) {
  return template
    .replaceAll('{clientName}', vars.clientName)
    .replaceAll('{projectName}', vars.projectName)
    .replaceAll('{accessCode}', vars.accessCode)
    .replaceAll('{missingDocuments}', vars.missingDocuments)
    .replaceAll('{appUrl}', vars.appUrl)
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

    const { projectId, clientId, appUrl } = (await req.json()) as {
      projectId: string
      clientId?: string
      appUrl: string
    }

    if (!projectId || !appUrl) {
      return new Response(JSON.stringify({ error: 'נא לספק projectId ו-appUrl' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()
    if (projectError || !project) {
      return new Response(JSON.stringify({ error: 'פרויקט לא נמצא' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: requiredDocs } = await supabaseAdmin
      .from('required_documents')
      .select('id, name, is_required')
      .eq('project_id', projectId)

    let clientsToNotify: ClientRow[] = []
    if (clientId) {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, name, email, phone, role, send_notifications_to_manager, access_code, receives_notifications')
        .eq('id', clientId)
        .single()
      if (client) clientsToNotify = [client]
    } else {
      const { data: clients } = await supabaseAdmin
        .from('clients')
        .select('id, name, email, phone, role, send_notifications_to_manager, access_code, receives_notifications')
        .eq('project_id', projectId)
      clientsToNotify = (clients ?? []).filter(
        (c) => c.role !== 'manager' || c.send_notifications_to_manager
      )
    }

    const results: { clientId: string; status: 'sent' | 'failed' | 'skipped' }[] = []

    for (const client of clientsToNotify) {
      const { data: files } = await supabaseAdmin
        .from('file_versions')
        .select('document_id, status, review_comment')
        .eq('client_id', client.id)
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false })

      const missingStr = buildMissingList((requiredDocs as RequiredDoc[]) ?? [], (files as FileVersionRow[]) ?? [])

      if (!missingStr) {
        results.push({ clientId: client.id, status: 'skipped' })
        continue
      }

      const subject = `תזכורת: מסמכים חסרים לפרויקט ${project.name}`
      const body = renderTemplate(project.email_template, {
        clientName: client.name,
        projectName: project.name,
        accessCode: client.access_code,
        missingDocuments: missingStr,
        appUrl,
      })
      // הודעת ה-WhatsApp מבוססת על תבנית ה-SMS של הפרויקט (טקסט קצר, בלי HTML)
      const whatsappBody = renderTemplate(project.sms_template, {
        clientName: client.name,
        projectName: project.name,
        accessCode: client.access_code,
        missingDocuments: missingStr,
        appUrl,
      })

      // בונים רשימת נמענים: הלקוח הראשי (אם לא ביטל התראות) + כל אנשי הקשר
      // הנוספים שלו שמוגדרים לקבל התראות (client_contacts.receives_notifications)
      const recipientEmails: string[] = []
      const recipientPhones: string[] = []
      if (client.receives_notifications && client.email) {
        recipientEmails.push(client.email)
      }
      if (client.receives_notifications && client.phone) {
        recipientPhones.push(client.phone)
      }
      const { data: contacts } = await supabaseAdmin
        .from('client_contacts')
        .select('email, phone, receives_notifications')
        .eq('client_id', client.id)
        .eq('receives_notifications', true)
      for (const contact of contacts ?? []) {
        if (contact.email) recipientEmails.push(contact.email)
        if (contact.phone) recipientPhones.push(contact.phone)
      }

      if (recipientEmails.length === 0 && recipientPhones.length === 0) {
        results.push({ clientId: client.id, status: 'skipped' })
        continue
      }

      let anySent = false
      for (const recipientEmail of recipientEmails) {
        const mailResult = await sendMail(recipientEmail, subject, body, buildEmailHtml(body, appUrl))
        if (mailResult.ok) anySent = true

        await supabaseAdmin.from('notification_logs').insert({
          client_id: client.id,
          client_name: client.name,
          project_id: projectId,
          type: 'email',
          recipient: recipientEmail,
          subject,
          content: body,
          status: mailResult.ok ? 'sent' : 'failed',
          error_message: mailResult.ok ? null : mailResult.error ?? null,
        })
      }

      for (const recipientPhone of recipientPhones) {
        const waResult = await sendWhatsApp(recipientPhone, whatsappBody)
        if (waResult.ok) anySent = true

        await supabaseAdmin.from('notification_logs').insert({
          client_id: client.id,
          client_name: client.name,
          project_id: projectId,
          type: 'whatsapp',
          recipient: recipientPhone,
          content: whatsappBody,
          status: waResult.ok ? 'sent' : 'failed',
          error_message: waResult.ok ? null : waResult.error ?? null,
        })
      }

      results.push({ clientId: client.id, status: anySent ? 'sent' : 'failed' })
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'שגיאה כללית בשרת' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

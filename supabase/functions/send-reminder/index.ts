// supabase/functions/send-reminder/index.ts
//
// שולח תזכורת מייל אמיתית ללקוח אחד (mode: "single") או לכל
// הלקוחות בפרויקט שטרם השלימו הגשה (mode: "bulk"), לפי הגדרות
// הפרויקט (email_template) ורשימת המסמכים החסרים/הפסולים בפועל.
// דורש הרשאת staff, ומשתמש בפרטי SMTP שהוגדרו כ-Secrets.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { withTimeout } from '../_shared/withTimeout.ts'

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
  role: string
  send_notifications_to_manager: boolean
  access_code: string
  receives_notifications: boolean
}

function buildMissingList(requiredDocs: RequiredDoc[], files: FileVersionRow[]): string {
  const latestByDoc = new Map<string, FileVersionRow>()
  // files מגיעות ממוינות כבר מהחדש לישן; לוקחים את הראשונה שנתקלים בה לכל מסמך
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
      clientId?: string // אם קיים -> תזכורת בודדת; אם לא -> גורפת לכל הפרויקט
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
        .select('id, name, email, role, send_notifications_to_manager, access_code, receives_notifications')
        .eq('id', clientId)
        .single()
      if (client) clientsToNotify = [client]
    } else {
      const { data: clients } = await supabaseAdmin
        .from('clients')
        .select('id, name, email, role, send_notifications_to_manager, access_code, receives_notifications')
        .eq('project_id', projectId)
      clientsToNotify = (clients ?? []).filter(
        (c) => c.role !== 'manager' || c.send_notifications_to_manager
      )
    }

    const smtpClient = new SMTPClient({
      connection: {
        hostname: Deno.env.get('SMTP_HOST')!,
        port: Number(Deno.env.get('SMTP_PORT') ?? '587'),
        tls: true,
        auth: {
          username: Deno.env.get('SMTP_USERNAME')!,
          password: Deno.env.get('SMTP_PASSWORD')!,
        },
      },
    })

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

      // בונים רשימת נמענים: הלקוח הראשי (אם לא ביטל התראות) + כל אנשי הקשר
      // הנוספים שלו שמוגדרים לקבל התראות (client_contacts.receives_notifications)
      const recipientEmails: string[] = []
      if (client.receives_notifications && client.email) {
        recipientEmails.push(client.email)
      }
      const { data: contacts } = await supabaseAdmin
        .from('client_contacts')
        .select('email, receives_notifications')
        .eq('client_id', client.id)
        .eq('receives_notifications', true)
      for (const contact of contacts ?? []) {
        if (contact.email) recipientEmails.push(contact.email)
      }

      if (recipientEmails.length === 0) {
        results.push({ clientId: client.id, status: 'skipped' })
        continue
      }

      let anySent = false
      for (const recipientEmail of recipientEmails) {
        let status: 'sent' | 'failed' = 'sent'
        let errorMessage: string | null = null

        try {
          await withTimeout(
            smtpClient.send({
              from: Deno.env.get('SMTP_FROM')!,
              to: recipientEmail,
              subject,
              content: body,
            }),
            8000,
            'שליחת מייל (SMTP)'
          )
          anySent = true
        } catch (sendErr) {
          status = 'failed'
          errorMessage = sendErr instanceof Error ? sendErr.message : 'שגיאת שליחה'
        }

        await supabaseAdmin.from('notification_logs').insert({
          client_id: client.id,
          client_name: client.name,
          project_id: projectId,
          type: 'email',
          recipient: recipientEmail,
          subject,
          content: body,
          status,
          error_message: errorMessage,
        })
      }

      results.push({ clientId: client.id, status: anySent ? 'sent' : 'failed' })
    }

    try {
      await withTimeout(smtpClient.close(), 3000, 'סגירת חיבור SMTP')
    } catch {
      // מתעלמים - זה רק ניקוי חיבור
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

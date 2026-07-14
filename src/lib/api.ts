import { supabase, FUNCTIONS_URL } from './supabaseClient';
import {
  Client,
  Project,
  ClientProjectState,
  FileVersion,
  NotificationLog,
} from '../types';

// ============================================================
// עזרי מיפוי: DB (snake_case) <-> טיפוסי הפרונט (camelCase)
// כך שרכיבי AdminPanel/ClientPortal לא צריכים להשתנות כלל
// ============================================================

function mapClientRow(row: any): Client {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? '',
    role: row.role,
    sendNotificationsToManager: row.send_notifications_to_manager,
    accessCode: row.access_code,
    notes: row.notes ?? undefined,
  };
}

function mapProjectRow(row: any, requiredDocs: any[]): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    requiredDocuments: requiredDocs
      .filter((d) => d.project_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((d) => ({
        id: d.id,
        name: d.name,
        isRequired: d.is_required,
        description: d.description ?? undefined,
      })),
    trackingSettings: {
      reminderIntervalDays: row.reminder_interval_days,
      emailTemplate: row.email_template,
      smsTemplate: row.sms_template,
    },
  };
}

function mapFileVersionRow(row: any): FileVersion {
  return {
    id: row.id,
    fileName: row.file_name,
    fileSize: row.file_size ? `${(row.file_size / (1024 * 1024)).toFixed(2)} MB` : undefined,
    storagePath: row.storage_path,
    uploadedAt: row.uploaded_at?.replace('T', ' ').substring(0, 16),
    version: row.version,
    status: row.status,
    reviewComment: row.review_comment ?? undefined,
    reviewedAt: row.reviewed_at ? row.reviewed_at.replace('T', ' ').substring(0, 16) : undefined,
  };
}

// ============================================================
// אימות (Auth)
// ============================================================

// כניסת לקוח עם קוד גישה - קורא ל-Edge Function שמחזירה session מלא
export async function loginWithAccessCode(
  accessCode: string
): Promise<{ client: { id: string; name: string; projectId: string } }> {
  const res = await fetch(`${FUNCTIONS_URL}/client-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'קוד גישה אינו תקין');

  const { error } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (error) throw error;

  return { client: data.client };
}

// כניסת איש צוות (רו"ח/אדמין) עם אימייל וסיסמה רגילים
export async function loginStaff(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
}

// בודק אם המשתמש המחובר כרגע הוא איש צוות (אדמין) או לקוח, ומחזיר פרטים
export async function getCurrentSessionInfo(): Promise<
  | { kind: 'staff' }
  | { kind: 'client'; client: Client; projectId: string }
  | { kind: 'none' }
> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { kind: 'none' };

  const userId = sessionData.session.user.id;

  const { data: staffRow } = await supabase.from('staff').select('id').eq('id', userId).maybeSingle();
  if (staffRow) return { kind: 'staff' };

  const { data: clientRow } = await supabase
    .from('clients')
    .select('*')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (clientRow) return { kind: 'client', client: mapClientRow(clientRow), projectId: clientRow.project_id };

  return { kind: 'none' };
}

// ============================================================
// שליפת נתונים
// ============================================================

export async function fetchProjects(): Promise<Project[]> {
  const { data: projects, error: pErr } = await supabase.from('projects').select('*').order('created_at');
  if (pErr) throw pErr;
  const { data: docs, error: dErr } = await supabase.from('required_documents').select('*');
  if (dErr) throw dErr;
  return (projects ?? []).map((p) => mapProjectRow(p, docs ?? []));
}

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase.from('clients').select('*').order('created_at');
  if (error) throw error;
  return (data ?? []).map(mapClientRow);
}

export async function fetchClientStates(): Promise<ClientProjectState[]> {
  const { data: files, error } = await supabase
    .from('file_versions')
    .select('*')
    .order('version', { ascending: false });
  if (error) throw error;

  const { data: submissions } = await supabase
    .from('client_submissions')
    .select('*')
    .order('submitted_at', { ascending: false });

  const grouped = new Map<string, ClientProjectState>();

  for (const row of files ?? []) {
    const key = `${row.client_id}::${row.project_id}`;
    if (!grouped.has(key)) {
      grouped.set(key, { clientId: row.client_id, projectId: row.project_id, documents: {} });
    }
    const state = grouped.get(key)!;
    if (!state.documents[row.document_id]) state.documents[row.document_id] = [];
    state.documents[row.document_id].push(mapFileVersionRow(row));
  }

  for (const sub of submissions ?? []) {
    const key = `${sub.client_id}::${sub.project_id}`;
    if (!grouped.has(key)) {
      grouped.set(key, { clientId: sub.client_id, projectId: sub.project_id, documents: {} });
    }
    const state = grouped.get(key)!;
    if (!state.comments) state.comments = sub.comments ?? undefined;
  }

  return Array.from(grouped.values());
}

export async function fetchNotificationLogs(): Promise<NotificationLog[]> {
  const { data, error } = await supabase
    .from('notification_logs')
    .select('*')
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    projectId: row.project_id,
    type: row.type,
    recipient: row.recipient,
    subject: row.subject ?? undefined,
    content: row.content,
    sentAt: row.sent_at?.replace('T', ' ').substring(0, 16),
    status: row.status,
  }));
}

// ============================================================
// פעולות לקוח
// ============================================================

// מעלה קובץ ל-Storage ורושם גרסה חדשה בטבלת file_versions
export async function uploadFile(
  clientId: string,
  projectId: string,
  documentId: string,
  file: File
): Promise<void> {
  const { data: versionData } = await supabase.rpc('next_file_version', {
    p_client_id: clientId,
    p_document_id: documentId,
  });
  const version = versionData ?? 1;

  const storagePath = `${projectId}/${clientId}/${documentId}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file);
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from('file_versions').insert({
    client_id: clientId,
    project_id: projectId,
    document_id: documentId,
    version,
    file_name: file.name,
    file_size: file.size,
    storage_path: storagePath,
    status: 'draft',
  });
  if (insertError) throw insertError;
}

// שליחת כל הטיוטות של הלקוח לרואה החשבון (draft -> pending) + שמירת הערות
export async function sendToCpa(clientId: string, projectId: string, comments: string): Promise<void> {
  const { data: draftFiles } = await supabase
    .from('file_versions')
    .select('id')
    .eq('client_id', clientId)
    .eq('project_id', projectId)
    .eq('status', 'draft');

  if (draftFiles && draftFiles.length > 0) {
    const ids = draftFiles.map((f) => f.id);
    const { error } = await supabase.from('file_versions').update({ status: 'pending' }).in('id', ids);
    if (error) throw error;
  }

  const { error: subError } = await supabase.from('client_submissions').insert({
    client_id: clientId,
    project_id: projectId,
    comments,
  });
  if (subError) throw subError;
}

export async function getFileDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(storagePath, 600);
  if (error || !data) throw error || new Error('שגיאה ביצירת קישור הורדה');
  return data.signedUrl;
}

// ============================================================
// פעולות אדמין (רו"ח)
// ============================================================

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token}` };
}

export async function addClient(
  projectId: string,
  client: Omit<Client, 'id' | 'accessCode' | 'projectId'>,
  codePrefix?: string
): Promise<Client> {
  const res = await fetch(`${FUNCTIONS_URL}/create-client`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      projectId,
      name: client.name,
      email: client.email,
      phone: client.phone,
      role: client.role,
      sendNotificationsToManager: client.sendNotificationsToManager,
      notes: client.notes,
      codePrefix,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה ביצירת לקוח');
  return mapClientRow(data.client);
}

export async function updateClient(clientId: string, updates: Partial<Client>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.role !== undefined) dbUpdates.role = updates.role;
  if (updates.sendNotificationsToManager !== undefined)
    dbUpdates.send_notifications_to_manager = updates.sendNotificationsToManager;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

  const { error } = await supabase.from('clients').update(dbUpdates).eq('id', clientId);
  if (error) throw error;
}

export async function deleteClient(clientId: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', clientId);
  if (error) throw error;
}

export async function importClients(
  projectId: string,
  rows: Omit<Client, 'id' | 'accessCode' | 'projectId'>[],
  codePrefix?: string
): Promise<{ created: number; failed: number }> {
  const res = await fetch(`${FUNCTIONS_URL}/import-clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      projectId,
      codePrefix,
      rows: rows.map((r) => ({
        name: r.name,
        email: r.email,
        phone: r.phone,
        role: r.role,
        sendNotificationsToManager: r.sendNotificationsToManager,
        notes: r.notes,
      })),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה בייבוא לקוחות');
  return { created: data.created.length, failed: data.failed.length };
}

export async function reviewFile(
  fileId: string,
  status: 'approved' | 'rejected',
  comment?: string
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const { error } = await supabase
    .from('file_versions')
    .update({
      status,
      review_comment: comment ?? (status === 'approved' ? 'מאושר' : 'לא תקין'),
      reviewed_at: new Date().toISOString(),
      reviewed_by: sessionData.session?.user.id,
    })
    .eq('id', fileId);
  if (error) throw error;
}

export async function sendManualReminder(clientId: string, projectId: string, appUrl: string): Promise<void> {
  const res = await fetch(`${FUNCTIONS_URL}/send-reminder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ projectId, clientId, appUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה בשליחת תזכורת');
}

export async function sendBulkReminders(projectId: string, appUrl: string): Promise<void> {
  const res = await fetch(`${FUNCTIONS_URL}/send-reminder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ projectId, appUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה בשליחת תזכורות');
}

export async function updateProjectSettings(
  projectId: string,
  settings: Partial<{ reminderIntervalDays: number; emailTemplate: string; smsTemplate: string }>
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (settings.reminderIntervalDays !== undefined) dbUpdates.reminder_interval_days = settings.reminderIntervalDays;
  if (settings.emailTemplate !== undefined) dbUpdates.email_template = settings.emailTemplate;
  if (settings.smsTemplate !== undefined) dbUpdates.sms_template = settings.smsTemplate;

  const { error } = await supabase.from('projects').update(dbUpdates).eq('id', projectId);
  if (error) throw error;
}

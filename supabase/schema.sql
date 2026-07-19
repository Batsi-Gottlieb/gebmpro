-- ============================================================
-- גוטליב את ביטון - מערכת מעקב מסמכים
-- סכימת מסד נתונים מלאה + אבטחה (Row Level Security)
-- ============================================================
-- הוראות הפעלה: העתיקו את כל הקובץ הזה, הדביקו ב-Supabase Dashboard
-- תחת "SQL Editor" -> "New query" -> הריצו (Run)
-- ============================================================

-- הרחבה ליצירת UUID
create extension if not exists "pgcrypto";

-- ============================================================
-- טבלת צוות המשרד (רו"ח / אדמין) - מי שרשום כאן = בעל גישת ניהול מלאה
-- ============================================================
create table staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- פונקציית עזר: האם המשתמש המחובר הוא איש צוות?
create or replace function is_staff()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from staff where id = auth.uid());
$$;

-- ============================================================
-- פרויקטים / מחלקות
-- ============================================================
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  reminder_interval_days int not null default 3,
  email_template text not null default '',
  sms_template text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- מסמכים נדרשים לכל פרויקט
create table required_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  description text,
  is_required boolean not null default true,
  -- סוגי קבצים מותרים להעלאה למסמך זה: 'image' / 'word' / 'pdf' (אפשר כמה יחד)
  allowed_file_types text[] not null default array['image', 'word', 'pdf', 'excel'],
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- לקוחות (כל לקוח שייך לפרויקט אחד; אותו גורם אמיתי יכול
-- להופיע כלקוח נפרד בכל פרויקט, עם קוד גישה נפרד)
-- ============================================================
create table clients (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  role text not null check (role in ('manager', 'regular')) default 'regular',
  send_notifications_to_manager boolean not null default false,
  access_code text not null unique,
  notes text,
  -- מקושר למשתמש הפנימי ב-Supabase Auth (נוצר אוטומטית ע"י Edge Function)
  auth_user_id uuid unique references auth.users (id) on delete set null,
  -- האם הלקוח הראשי (השורה הזו) מקבל מיילים/SMS שוטפים (תזכורות).
  -- הודעת הכניסה הראשונית עם קוד הגישה נשלחת בכל מקרה, ללא תלות בדגל הזה.
  receives_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_project_id_idx on clients (project_id);
create index clients_access_code_idx on clients (access_code);

-- ============================================================
-- אנשי קשר נוספים לכל לקוח (למשל כמה עובדים באותה חברה) -
-- כולם נכנסים לפורטל עם אותו קוד גישה של הלקוח הראשי, וכל אחד
-- עם הגדרה נפרדת האם מקבל התראות שוטפות (תזכורות) או לא.
-- הודעת הכניסה הראשונית עם קוד הגישה נשלחת לכולם, ללא תלות בדגל.
-- ============================================================
create table client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  receives_notifications boolean not null default true,
  created_at timestamptz not null default now()
);

create index client_contacts_client_id_idx on client_contacts (client_id);

-- ============================================================
-- גרסאות קבצים שהועלו
-- ============================================================
create table file_versions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  document_id uuid not null references required_documents (id) on delete cascade,
  version int not null default 1,
  file_name text not null,
  file_size bigint,
  storage_path text not null, -- הנתיב בפועל ב-Supabase Storage
  status text not null check (status in ('draft', 'pending', 'approved', 'rejected')) default 'draft',
  review_comment text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id),
  uploaded_at timestamptz not null default now()
);

create index file_versions_client_project_idx on file_versions (client_id, project_id);
create index file_versions_document_idx on file_versions (document_id);

-- ============================================================
-- הגשות ללקוח (כשלקוח לוחץ "שליחה לרואה חשבון" + הערותיו)
-- ============================================================
create table client_submissions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  comments text,
  submitted_at timestamptz not null default now()
);

-- ============================================================
-- יומן התראות שנשלחו (מייל / SMS)
-- ============================================================
create table notification_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients (id) on delete set null,
  client_name text not null,
  project_id uuid references projects (id) on delete set null,
  type text not null check (type in ('email', 'sms', 'whatsapp')),
  recipient text not null,
  subject text,
  content text not null,
  status text not null check (status in ('sent', 'failed')) default 'sent',
  error_message text,
  sent_at timestamptz not null default now()
);

create index notification_logs_project_idx on notification_logs (project_id);
create index notification_logs_client_idx on notification_logs (client_id);

-- ============================================================
-- טריגר עדכון updated_at אוטומטי
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at before update on projects
  for each row execute function set_updated_at();
create trigger clients_set_updated_at before update on clients
  for each row execute function set_updated_at();

-- ============================================================
-- הפעלת Row Level Security על כל הטבלאות
-- ============================================================
alter table staff enable row level security;
alter table projects enable row level security;
alter table required_documents enable row level security;
alter table clients enable row level security;
alter table file_versions enable row level security;
alter table client_submissions enable row level security;
alter table notification_logs enable row level security;
alter table client_contacts enable row level security;

-- ---- staff: איש צוות מנהל ורואה את כלל אנשי הצוות (הוספה חדשה
--      של staff row עדיין דורשת Edge Function - יצירת auth user קודם) ----
create policy "staff_full_access_team" on staff
  for all using (is_staff()) with check (is_staff());

-- ---- projects ----
create policy "staff_full_access_projects" on projects
  for all using (is_staff()) with check (is_staff());

create policy "clients_read_own_project" on projects
  for select using (
    exists (
      select 1 from clients
      where clients.project_id = projects.id
      and clients.auth_user_id = auth.uid()
    )
  );

-- ---- required_documents ----
create policy "staff_full_access_required_documents" on required_documents
  for all using (is_staff()) with check (is_staff());

create policy "clients_read_own_required_documents" on required_documents
  for select using (
    exists (
      select 1 from clients
      where clients.project_id = required_documents.project_id
      and clients.auth_user_id = auth.uid()
    )
  );

-- ---- clients ----
create policy "staff_full_access_clients" on clients
  for all using (is_staff()) with check (is_staff());

create policy "clients_read_own_row" on clients
  for select using (auth_user_id = auth.uid());

-- לקוח לא יכול לשנות role / access_code / auth_user_id של עצמו -
-- לכן אין לו הרשאת update כלל; עדכון פרטים אישיים ייעשה דרך בקשה לאדמין.

-- ---- file_versions ----
create policy "staff_full_access_file_versions" on file_versions
  for all using (is_staff()) with check (is_staff());

create policy "clients_read_own_files" on file_versions
  for select using (
    exists (
      select 1 from clients
      where clients.id = file_versions.client_id
      and clients.auth_user_id = auth.uid()
    )
  );

-- לקוח יכול להעלות גרסה חדשה (סטטוס draft בלבד) לקבצים ששייכים לו
create policy "clients_insert_own_draft_files" on file_versions
  for insert with check (
    status = 'draft'
    and exists (
      select 1 from clients
      where clients.id = file_versions.client_id
      and clients.auth_user_id = auth.uid()
    )
  );

-- ---- client_submissions ----
create policy "staff_full_access_submissions" on client_submissions
  for all using (is_staff()) with check (is_staff());

create policy "clients_insert_own_submission" on client_submissions
  for insert with check (
    exists (
      select 1 from clients
      where clients.id = client_submissions.client_id
      and clients.auth_user_id = auth.uid()
    )
  );

create policy "clients_read_own_submissions" on client_submissions
  for select using (
    exists (
      select 1 from clients
      where clients.id = client_submissions.client_id
      and clients.auth_user_id = auth.uid()
    )
  );

-- ---- notification_logs: רק צוות המשרד רואה את היומן ----
create policy "staff_full_access_notification_logs" on notification_logs
  for all using (is_staff()) with check (is_staff());

-- ---- client_contacts: ניהול מלא לצוות בלבד ----
create policy "staff_full_access_client_contacts" on client_contacts
  for all using (is_staff()) with check (is_staff());

-- ============================================================
-- פונקציה: כשלקוח משנה סטטוס קובץ ל-pending, לוודא שהעלאה חדשה
-- (draft) הופכת אוטומטית לגרסה הבאה במספור (version)
-- ============================================================
create or replace function next_file_version(p_client_id uuid, p_document_id uuid)
returns int
language sql
stable
as $$
  select coalesce(max(version), 0) + 1
  from file_versions
  where client_id = p_client_id and document_id = p_document_id;
$$;

-- ============================================================
-- Storage bucket לקבצים שהלקוחות מעלים (יש להריץ בנפרד אם נכשל -
-- לעיתים יש ליצור את ה-bucket דרך הממשק הגרפי: Storage -> New bucket)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- מדיניות Storage: לקוח יכול להעלות/לקרוא רק בתיקייה שלו
-- מבנה נתיב: {project_id}/{client_id}/{document_id}/{filename}
create policy "clients_upload_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and exists (
      select 1 from clients
      where clients.auth_user_id = auth.uid()
      -- מפורש objects.name ולא name בלבד, כי בתוך תת-השאילתה על clients
      -- שם העמודה הלא-מפורש היה מוצל ע"י clients.name (שם הלקוח בפועל),
      -- מה שגרם לכשל שקט של המדיניות (RLS) בהעלאת קבצים.
      and (storage.foldername(objects.name))[2] = clients.id::text
    )
  );

create policy "clients_read_own_folder"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from clients
      where clients.auth_user_id = auth.uid()
      and (storage.foldername(objects.name))[2] = clients.id::text
    )
  );

create policy "staff_full_access_storage"
  on storage.objects for all
  using (bucket_id = 'documents' and is_staff())
  with check (bucket_id = 'documents' and is_staff());

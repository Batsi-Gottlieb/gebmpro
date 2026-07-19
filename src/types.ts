export type ClientRole = 'manager' | 'regular';

export interface Client {
  id: string;
  projectId: string;
  name: string;
  email: string;
  phone: string;
  role: ClientRole;
  sendNotificationsToManager: boolean; // Relevant only for managers, whether to copy/alert them
  accessCode: string;
  notes?: string;
  receivesNotifications: boolean; // Whether the primary contact gets ongoing reminders (welcome message always sent regardless)
}

// איש קשר נוסף של לקוח - נכנס לפורטל עם אותו קוד גישה של הלקוח הראשי
export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  email?: string;
  phone?: string;
  receivesNotifications: boolean;
}

// איש צוות המשרד (אדמין) שיכול להתחבר לפאנל הניהול
export interface StaffMember {
  id: string;
  fullName: string;
  email: string;
}

// סוגי קבצים מותרים להעלאה למסמך נדרש - נבחר ע"י צ'קבוקסים בהגדרות המחלקה
export type DocumentFileType = 'image' | 'word' | 'pdf' | 'excel';

export interface RequiredDocument {
  id: string;
  name: string;
  isRequired: boolean;
  description?: string;
  allowedFileTypes: DocumentFileType[];
}

export interface TrackingSettings {
  reminderIntervalDays: number;
  emailTemplate: string;
  smsTemplate: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  requiredDocuments: RequiredDocument[];
  trackingSettings: TrackingSettings;
}

export interface FileVersion {
  id: string;
  fileName: string;
  fileSize?: string;
  storagePath?: string;
  uploadedAt: string;
  version: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  reviewComment?: string;
  reviewedAt?: string;
}

export interface ClientProjectState {
  clientId: string;
  projectId: string;
  // Map document id -> array of versions (latest is index 0 or highest version number)
  documents: Record<string, FileVersion[]>;
  comments?: string;
}

export interface NotificationLog {
  id: string;
  clientId: string;
  clientName: string;
  projectId: string;
  type: 'email' | 'sms' | 'whatsapp';
  recipient: string;
  subject?: string;
  content: string;
  sentAt: string;
  status: 'sent' | 'failed';
}

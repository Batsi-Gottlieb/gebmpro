import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Folder, 
  FileSpreadsheet, 
  Settings, 
  Mail, 
  MessageSquare, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Send, 
  Bell, 
  Download, 
  Upload as UploadIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  FileDown,
  RefreshCw,
  Sliders,
  Copy,
  UserPlus,
  UserCog,
  BellOff,
  BellRing
} from 'lucide-react';
import { Client, Project, ClientProjectState, FileVersion, NotificationLog, ClientContact, StaffMember } from '../types';

interface AdminPanelProps {
  projects: Project[];
  clients: Client[];
  clientStates: ClientProjectState[];
  notificationLogs: NotificationLog[];
  clientContacts: ClientContact[];
  staff: StaffMember[];
  onAddClient: (
    client: Omit<Client, 'id' | 'accessCode' | 'projectId'>,
    projectId: string,
    additionalContacts?: { name: string; email?: string; phone?: string; receivesNotifications: boolean }[]
  ) => void;
  onUpdateClient: (clientId: string, updated: Partial<Client>) => void;
  onDeleteClient: (clientId: string) => void;
  onImportClients: (importedClients: Omit<Client, 'id' | 'accessCode' | 'projectId'>[], projectId: string) => void;
  onReviewFile: (clientId: string, projectId: string, documentId: string, fileId: string, status: 'approved' | 'rejected', comment?: string) => void;
  onDownloadFile: (storagePath: string, fileName: string) => void;
  onSendManualReminder: (clientId: string, projectId: string) => void;
  onSendBulkReminders: (projectId: string) => void;
  onUpdateProjectSettings: (projectId: string, settings: Partial<Project['trackingSettings']>) => void;
  onAddProject: (project: {
    name: string;
    description?: string;
    reminderIntervalDays: number;
    emailTemplate: string;
    smsTemplate: string;
    requiredDocuments: { name: string; description?: string; isRequired: boolean }[];
  }) => void;
  onExportData: () => void;
  onImportData: (jsonStr: string) => boolean;
  onImpersonate: (accessCode: string) => void;
  onAddClientContact: (clientId: string, contact: { name: string; email?: string; phone?: string; receivesNotifications: boolean }) => void;
  onUpdateClientContact: (contactId: string, updates: Partial<Pick<ClientContact, 'name' | 'email' | 'phone' | 'receivesNotifications'>>) => void;
  onDeleteClientContact: (contactId: string) => void;
  onAddStaff: (fullName: string, email: string) => void;
  onRemoveStaff: (staffId: string) => void;
  onResendAccessCodes: (clientIds: string[]) => void;
}

export default function AdminPanel({
  projects,
  clients,
  clientStates,
  notificationLogs,
  clientContacts,
  staff,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onImportClients,
  onReviewFile,
  onDownloadFile,
  onSendManualReminder,
  onSendBulkReminders,
  onUpdateProjectSettings,
  onAddProject,
  onExportData,
  onImportData,
  onImpersonate,
  onAddClientContact,
  onUpdateClientContact,
  onDeleteClientContact,
  onAddStaff,
  onRemoveStaff,
  onResendAccessCodes
}: AdminPanelProps) {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'clients' | 'import' | 'settings' | 'logs' | 'export-import' | 'users'>('clients');

  // New contact form (per selected client)
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactNotify, setNewContactNotify] = useState(true);

  // New staff form
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || 'nitzanim-2026');

  // יצירת מחלקה/פרויקט חדש
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectReminderDays, setNewProjectReminderDays] = useState(3);
  const [newProjectEmailTemplate, setNewProjectEmailTemplate] = useState(
    'שלום {clientName},\n\nבבדיקת המערכת נמצאו המסמכים החסרים הבאים לפרויקט {projectName}:\n{missingDocuments}\n\nקוד הגישה שלך: {accessCode}\nלכניסה לפורטל: {appUrl}'
  );
  const [newProjectSmsTemplate, setNewProjectSmsTemplate] = useState(
    'שלום {clientName}, נא להשלים מסמכים חסרים לפרויקט {projectName}. קוד גישה: {accessCode}'
  );
  const [newProjectDocuments, setNewProjectDocuments] = useState<{ name: string; description: string; isRequired: boolean }[]>([]);
  const [newProjectDocDraftName, setNewProjectDocDraftName] = useState('');
  const [newProjectDocDraftDescription, setNewProjectDocDraftDescription] = useState('');
  const [newProjectDocDraftRequired, setNewProjectDocDraftRequired] = useState(true);

  const resetNewProjectForm = () => {
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectReminderDays(3);
    setNewProjectEmailTemplate(
      'שלום {clientName},\n\nבבדיקת המערכת נמצאו המסמכים החסרים הבאים לפרויקט {projectName}:\n{missingDocuments}\n\nקוד הגישה שלך: {accessCode}\nלכניסה לפורטל: {appUrl}'
    );
    setNewProjectSmsTemplate('שלום {clientName}, נא להשלים מסמכים חסרים לפרויקט {projectName}. קוד גישה: {accessCode}');
    setNewProjectDocuments([]);
    setNewProjectDocDraftName('');
    setNewProjectDocDraftDescription('');
    setNewProjectDocDraftRequired(true);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) return;
    onAddProject({
      name: newProjectName,
      description: newProjectDescription || undefined,
      reminderIntervalDays: newProjectReminderDays,
      emailTemplate: newProjectEmailTemplate,
      smsTemplate: newProjectSmsTemplate,
      requiredDocuments: newProjectDocuments.map((d) => ({
        name: d.name,
        description: d.description || undefined,
        isRequired: d.isRequired,
      })),
    });
    resetNewProjectForm();
    setIsAddingProject(false);
  };
  
  // Client selection for CPA Review Workflow
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // ערוך פרטי לקוח קיים (שם/מייל/נייד/סוג/הערות)
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editClientEmail, setEditClientEmail] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editClientRole, setEditClientRole] = useState<'manager' | 'regular'>('regular');
  const [editClientSendNotifications, setEditClientSendNotifications] = useState(true);
  const [editClientNotes, setEditClientNotes] = useState('');

  const startEditingClient = (c: Client) => {
    setEditingClientId(c.id);
    setEditClientName(c.name);
    setEditClientEmail(c.email);
    setEditClientPhone(c.phone);
    setEditClientRole(c.role === 'manager' ? 'manager' : 'regular');
    setEditClientSendNotifications(!!c.sendNotificationsToManager);
    setEditClientNotes(c.notes || '');
  };

  const handleSaveClientEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClientId || !editClientName || !editClientEmail || !editClientPhone) return;
    onUpdateClient(editingClientId, {
      name: editClientName,
      email: editClientEmail,
      phone: editClientPhone,
      role: editClientRole,
      sendNotificationsToManager: editClientSendNotifications,
      notes: editClientNotes,
    });
    setEditingClientId(null);
  };

  // ערוך איש קשר נוסף קיים (שם/מייל/נייד)
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');

  const startEditingContact = (cc: ClientContact) => {
    setEditingContactId(cc.id);
    setEditContactName(cc.name);
    setEditContactEmail(cc.email || '');
    setEditContactPhone(cc.phone || '');
  };

  const handleSaveContactEdit = (contactId: string) => {
    if (!editContactName) return;
    onUpdateClientContact(contactId, {
      name: editContactName,
      email: editContactEmail || undefined,
      phone: editContactPhone || undefined,
    });
    setEditingContactId(null);
  };
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());

  const toggleClientSelection = (clientId: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  // Automatically scroll down to the CPA Review panel when a client is selected
  useEffect(() => {
    if (selectedClientId) {
      setTimeout(() => {
        const element = document.getElementById('review-workflow-panel');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [selectedClientId]);

  // New Client Form Modal / Section
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientRole, setNewClientRole] = useState<'manager' | 'regular'>('regular');
  const [newClientSendNotifications, setNewClientSendNotifications] = useState(true);
  const [newClientNotes, setNewClientNotes] = useState('');
  const [newClientExtraContacts, setNewClientExtraContacts] = useState<{ name: string; email: string; phone: string; receivesNotifications: boolean }[]>([]);
  const [newClientContactDraftName, setNewClientContactDraftName] = useState('');
  const [newClientContactDraftEmail, setNewClientContactDraftEmail] = useState('');
  const [newClientContactDraftPhone, setNewClientContactDraftPhone] = useState('');
  const [newClientContactDraftNotify, setNewClientContactDraftNotify] = useState(true);

  // States for manual client creation inside the import tab
  const [manualClientName, setManualClientName] = useState('');
  const [manualClientEmail, setManualClientEmail] = useState('');
  const [manualClientPhone, setManualClientPhone] = useState('');
  const [manualClientRole, setManualClientRole] = useState<'manager' | 'regular'>('regular');
  const [manualClientSendNotifications, setManualClientSendNotifications] = useState(true);
  const [manualClientNotes, setManualClientNotes] = useState('');
  const [manualClientFeedback, setManualClientFeedback] = useState<string | null>(null);
  const [manualClientExtraContacts, setManualClientExtraContacts] = useState<{ name: string; email: string; phone: string; receivesNotifications: boolean }[]>([]);
  const [manualContactDraftName, setManualContactDraftName] = useState('');
  const [manualContactDraftEmail, setManualContactDraftEmail] = useState('');
  const [manualContactDraftPhone, setManualContactDraftPhone] = useState('');
  const [manualContactDraftNotify, setManualContactDraftNotify] = useState(true);

  // Bulk / Excel spreadsheet paste text area
  const [excelPasteText, setExcelPasteText] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  // Review status states
  const [reviewComment, setReviewComment] = useState<Record<string, string>>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'missing' | 'pending-review'>('all');

  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientEmail || !newClientPhone) return;

    onAddClient({
      name: newClientName,
      email: newClientEmail,
      phone: newClientPhone,
      role: newClientRole,
      sendNotificationsToManager: newClientSendNotifications,
      notes: newClientNotes,
    }, selectedProject.id, newClientExtraContacts.map(ec => ({
      name: ec.name,
      email: ec.email || undefined,
      phone: ec.phone || undefined,
      receivesNotifications: ec.receivesNotifications,
    })));

    // Reset Form
    setNewClientName('');
    setNewClientEmail('');
    setNewClientPhone('');
    setNewClientRole('regular');
    setNewClientSendNotifications(true);
    setNewClientNotes('');
    setNewClientExtraContacts([]);
    setNewClientContactDraftName('');
    setNewClientContactDraftEmail('');
    setNewClientContactDraftPhone('');
    setNewClientContactDraftNotify(true);
    setIsAddingClient(false);
  };

  const handleCreateManualClientInImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualClientName || !manualClientEmail || !manualClientPhone) {
      setManualClientFeedback('שגיאה: נא למלא את כל שדות החובה.');
      return;
    }

    onAddClient({
      name: manualClientName,
      email: manualClientEmail,
      phone: manualClientPhone,
      role: manualClientRole,
      sendNotificationsToManager: manualClientRole === 'manager' ? manualClientSendNotifications : false,
      notes: manualClientNotes,
    }, selectedProject.id, manualClientExtraContacts.map(ec => ({
      name: ec.name,
      email: ec.email || undefined,
      phone: ec.phone || undefined,
      receivesNotifications: ec.receivesNotifications,
    })));

    setManualClientFeedback(`הלקוח "${manualClientName}" נוסף בהצלחה למערכת!`);
    
    // Reset Form
    setManualClientName('');
    setManualClientEmail('');
    setManualClientPhone('');
    setManualClientRole('regular');
    setManualClientSendNotifications(true);
    setManualClientNotes('');
    setManualClientExtraContacts([]);
    setManualContactDraftName('');
    setManualContactDraftEmail('');
    setManualContactDraftPhone('');
    setManualContactDraftNotify(true);

    // Clear feedback after 4 seconds
    setTimeout(() => {
      setManualClientFeedback(null);
    }, 4000);
  };

  // Helper to parse Excel/CSV pasted text
  const handleExcelImport = () => {
    if (!excelPasteText.trim()) return;

    const rows = excelPasteText.split('\n').map(row => row.split('\t'));
    if (rows.length === 0) return;

    const parsedClients: Omit<Client, 'id' | 'accessCode'>[] = [];
    
    // Auto-detect columns or expect a simple layout: Name, Email, Phone, Role (Manager/Regular), Notes
    rows.forEach(row => {
      if (row.length < 3) return; // Skip invalid lines
      const name = row[0]?.trim();
      const email = row[1]?.trim();
      const phone = row[2]?.trim();
      if (!name || !email || !phone) return;

      const rawRole = row[3]?.trim().toLowerCase();
      const role: 'manager' | 'regular' = rawRole === 'מנהל' || rawRole === 'manager' ? 'manager' : 'regular';
      
      const rawNotify = row[4]?.trim().toLowerCase();
      const sendNotificationsToManager = !(rawNotify === 'לא' || rawNotify === 'no' || rawNotify === 'false');

      const notes = row[5]?.trim() || '';

      parsedClients.push({
        name,
        email,
        phone,
        role,
        sendNotificationsToManager,
        notes
      });
    });

    if (parsedClients.length > 0) {
      onImportClients(parsedClients, selectedProject.id);
      setImportFeedback(`נקלטו בהצלחה ${parsedClients.length} לקוחות מתוך קובץ האקסל!`);
      setExcelPasteText('');
      setActiveTab('clients');
    } else {
      setImportFeedback('שגיאה: לא זוהו נתונים תקינים. ודא שהעתקת טבלה מאקסל עם עמודות לפי הסדר: שם, מייל, טלפון');
    }
  };

  // Import JSON full state
  const [jsonImportStr, setJsonImportStr] = useState('');
  const [jsonImportFeedback, setJsonImportFeedback] = useState<{success: boolean; message: string} | null>(null);

  const handleJsonImport = () => {
    const ok = onImportData(jsonImportStr);
    if (ok) {
      setJsonImportFeedback({ success: true, message: 'כלל הנתונים יובאו ושוחזרו בהצלחה מהקובץ!' });
      setJsonImportStr('');
    } else {
      setJsonImportFeedback({ success: false, message: 'שגיאה: קובץ ה-JSON אינו תקין או שאינו במבנה המבוקש.' });
    }
  };

  // Copy to clipboard helper
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col" dir="rtl">
      {/* Top Admin Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-lg">
            גב
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">מערכת ניהול - גוטליב את ביטון</h1>
            <p className="text-xs text-slate-500">מעקב, הגשות וסנכרון חומרי לקוחות עבור רואה חשבון</p>
          </div>
        </div>

        {/* Project Selector Tab */}
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-600 ml-1">מחלקה/פרויקט:</span>
          <select 
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setSelectedClientId(null);
            }}
            className="bg-slate-50 text-sm font-bold text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            id="select-project-admin"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsAddingProject(!isAddingProject)}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold p-1.5 rounded-lg border border-indigo-200 cursor-pointer"
            title="הוספת מחלקה/פרויקט חדש"
            id="btn-add-project"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Add Department/Project Panel */}
      <AnimatePresence>
        {isAddingProject && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-b border-slate-200 px-6 py-6 overflow-hidden"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Folder className="w-5 h-5 text-indigo-600" />
              יצירת מחלקה/פרויקט חדש
            </h3>
            <form onSubmit={handleCreateProject} className="space-y-4 max-w-4xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">שם המחלקה/פרויקט *</label>
                  <input
                    type="text"
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="לדוגמה: תב״רים 2027"
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">תדירות תזכורות (ימים)</label>
                  <input
                    type="number"
                    min={1}
                    value={newProjectReminderDays}
                    onChange={(e) => setNewProjectReminderDays(Number(e.target.value) || 1)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">תיאור (אופציונלי)</label>
                  <input
                    type="text"
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">תבנית מייל לתזכורת</label>
                  <textarea
                    rows={4}
                    value={newProjectEmailTemplate}
                    onChange={(e) => setNewProjectEmailTemplate(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">משתנים: {'{clientName} {projectName} {accessCode} {missingDocuments} {appUrl}'}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">תבנית SMS לתזכורת</label>
                  <textarea
                    rows={4}
                    value={newProjectSmsTemplate}
                    onChange={(e) => setNewProjectSmsTemplate(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">משתנים: {'{clientName} {projectName} {accessCode} {missingDocuments} {appUrl}'}</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-1">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  מסמכים נדרשים ({newProjectDocuments.length})
                </h4>
                <p className="text-[11px] text-slate-500 mb-3">רשימת המסמכים שכל לקוח בפרויקט הזה יצטרך להעלות. אפשר להוסיף/למחוק מסמכים גם אחר כך.</p>

                {newProjectDocuments.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {newProjectDocuments.map((doc, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 text-xs">
                        <div>
                          <span className="font-bold text-slate-800">{doc.name}</span>
                          {doc.description && <span className="text-slate-500 mr-2"> • {doc.description}</span>}
                          <span className={`mr-2 font-bold ${doc.isRequired ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {doc.isRequired ? 'חובה' : 'לא חובה'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewProjectDocuments(prev => prev.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                          title="הסר"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-white p-3 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    placeholder="שם המסמך *"
                    value={newProjectDocDraftName}
                    onChange={(e) => setNewProjectDocDraftName(e.target.value)}
                    className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="תיאור (לא חובה)"
                    value={newProjectDocDraftDescription}
                    onChange={(e) => setNewProjectDocDraftDescription(e.target.value)}
                    className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newProjectDocDraftRequired}
                      onChange={(e) => setNewProjectDocDraftRequired(e.target.checked)}
                      className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                    />
                    מסמך חובה
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newProjectDocDraftName) return;
                      setNewProjectDocuments(prev => [...prev, {
                        name: newProjectDocDraftName,
                        description: newProjectDocDraftDescription,
                        isRequired: newProjectDocDraftRequired,
                      }]);
                      setNewProjectDocDraftName('');
                      setNewProjectDocDraftDescription('');
                      setNewProjectDocDraftRequired(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    + הוספה לרשימה
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetNewProjectForm();
                    setIsAddingProject(false);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  שמור מחלקה/פרויקט
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Admin layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 bg-slate-100 border-b lg:border-b-0 lg:border-l border-slate-200 p-4 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
          <button
            onClick={() => setActiveTab('clients')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all w-full text-right cursor-pointer ${
              activeTab === 'clients' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
            id="nav-tab-clients"
          >
            <Users className="w-4 h-4" />
            <span>רשימת לקוחות ומעקב</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all w-full text-right cursor-pointer ${
              activeTab === 'import' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
            id="nav-tab-import"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>טעינת אקסל לקוחות</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all w-full text-right cursor-pointer ${
              activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
            id="nav-tab-settings"
          >
            <Settings className="w-4 h-4" />
            <span>הגדרות התראות</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all w-full text-right cursor-pointer ${
              activeTab === 'logs' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
            id="nav-tab-logs"
          >
            <Mail className="w-4 h-4" />
            <span>לוג שליחת הודעות</span>
          </button>

          <button
            onClick={() => setActiveTab('export-import')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all w-full text-right cursor-pointer ${
              activeTab === 'export-import' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
            id="nav-tab-export-import"
          >
            <Sliders className="w-4 h-4" />
            <span>ייצוא וייבוא לקלוד</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all w-full text-right cursor-pointer ${
              activeTab === 'users' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
            id="nav-tab-users"
          >
            <UserCog className="w-4 h-4" />
            <span>ניהול משתמשי מנהל</span>
          </button>
        </aside>

        {/* Central Content Panel */}
        <main className="flex-1 p-6 overflow-y-auto bg-slate-50">
          
          {/* TAB 1: CLIENTS TABLE & WORKFLOW */}
          {activeTab === 'clients' && (
            <div className="space-y-6">
              
              {/* Table Action Controls */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="חפש לקוח לפי שם, מייל..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-slate-50 text-sm text-slate-900 rounded-lg pr-9 pl-4 py-2 border border-slate-200 w-64 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 text-sm text-slate-800 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">כל המצבים</option>
                    <option value="completed">השלים את כל ההגשות</option>
                    <option value="missing">ישנם חוסרים</option>
                    <option value="pending-review">ממתין לבדיקת רו"ח</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <button 
                    onClick={() => onSendBulkReminders(selectedProject.id)}
                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-indigo-700 font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Bell className="w-4 h-4" />
                    שליחת תזכורת גורפת לחסרים
                  </button>

                  <button 
                    onClick={() => {
                      if (selectedClientIds.size === 0) return;
                      onResendAccessCodes(Array.from(selectedClientIds));
                    }}
                    disabled={selectedClientIds.size === 0}
                    className={`font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
                      selectedClientIds.size === 0
                        ? 'bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-indigo-700 cursor-pointer'
                    }`}
                    title="שליחת קוד הגישה מחדש ללקוחות שנבחרו"
                  >
                    <RefreshCw className="w-4 h-4" />
                    שליחה חוזרת של סיסמה{selectedClientIds.size > 0 ? ` (${selectedClientIds.size})` : ''}
                  </button>

                  <button 
                    onClick={() => setIsAddingClient(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 font-bold" />
                    הוספת לקוח חדש
                  </button>
                </div>
              </div>

              {/* Add Client Inline Modal */}
              <AnimatePresence>
                {isAddingClient && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"
                  >
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-indigo-600" />
                      יצירת לקוח חדש לפרויקט {selectedProject.name}
                    </h3>
                    <form onSubmit={handleCreateClient} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">שם הלקוח (חברה/רשות/עמותה) *</label>
                        <input 
                          type="text" 
                          required
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">כתובת אימייל *</label>
                        <input 
                          type="email" 
                          required
                          value={newClientEmail}
                          onChange={(e) => setNewClientEmail(e.target.value)}
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">מספר טלפון *</label>
                        <input 
                          type="text" 
                          required
                          value={newClientPhone}
                          onChange={(e) => setNewClientPhone(e.target.value)}
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">סוג לקוח</label>
                        <select
                          value={newClientRole}
                          onChange={(e: any) => setNewClientRole(e.target.value)}
                          className="w-full bg-slate-50 text-slate-850 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="regular">לקוח רגיל (מקבל התראות)</option>
                          <option value="manager">לקוח-מנהל</option>
                        </select>
                      </div>

                      {newClientRole === 'manager' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">האם לשלוח התראות למנהל זה?</label>
                          <div className="flex items-center gap-2 mt-2">
                            <input 
                              type="checkbox"
                              checked={newClientSendNotifications}
                              onChange={(e) => setNewClientSendNotifications(e.target.checked)}
                              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                              id="check-new-client-notify"
                            />
                            <span className="text-sm font-medium text-slate-700">כן, שלח התראות למייל זה</span>
                          </div>
                        </div>
                      )}

                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-slate-500 mb-1">הערות / דגשים מיוחדים לשליחה</label>
                        <textarea 
                          rows={2}
                          value={newClientNotes}
                          onChange={(e) => setNewClientNotes(e.target.value)}
                          placeholder="לדוגמה: נא לא לשלוח התראות בימי שלישי..."
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="md:col-span-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-1">
                          <UserPlus className="w-4 h-4 text-indigo-600" />
                          משתמשים נוספים ללקוח זה ({newClientExtraContacts.length})
                        </h4>
                        <p className="text-[11px] text-slate-500 mb-3">
                          כל המשתמשים הנוספים יקבלו את קוד הגישה במייל/SMS בעת יצירת הלקוח, ללא קשר להגדרת קבלת ההתראות שלהם.
                        </p>

                        {newClientExtraContacts.length > 0 && (
                          <div className="space-y-1.5 mb-3">
                            {newClientExtraContacts.map((contact, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 text-xs">
                                <div>
                                  <span className="font-bold text-slate-800">{contact.name}</span>
                                  {contact.email && <span className="text-slate-500 mr-2"> • {contact.email}</span>}
                                  {contact.phone && <span className="text-slate-500 mr-2 font-mono"> • {contact.phone}</span>}
                                  <span className={`mr-2 font-bold ${contact.receivesNotifications ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {contact.receivesNotifications ? 'מקבל התראות' : 'לא מקבל התראות'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setNewClientExtraContacts(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-rose-500 hover:text-rose-700 cursor-pointer"
                                  title="הסר"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-white p-3 rounded-lg border border-slate-200">
                          <input
                            type="text"
                            placeholder="שם *"
                            value={newClientContactDraftName}
                            onChange={(e) => setNewClientContactDraftName(e.target.value)}
                            className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                          <input
                            type="email"
                            placeholder="אימייל"
                            value={newClientContactDraftEmail}
                            onChange={(e) => setNewClientContactDraftEmail(e.target.value)}
                            className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                          <input
                            type="text"
                            placeholder="נייד (לא חובה)"
                            value={newClientContactDraftPhone}
                            onChange={(e) => setNewClientContactDraftPhone(e.target.value)}
                            className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer select-none whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={newClientContactDraftNotify}
                                onChange={(e) => setNewClientContactDraftNotify(e.target.checked)}
                                className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                              />
                              מקבל התראות
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                if (!newClientContactDraftName) return;
                                setNewClientExtraContacts(prev => [...prev, {
                                  name: newClientContactDraftName,
                                  email: newClientContactDraftEmail,
                                  phone: newClientContactDraftPhone,
                                  receivesNotifications: newClientContactDraftNotify,
                                }]);
                                setNewClientContactDraftName('');
                                setNewClientContactDraftEmail('');
                                setNewClientContactDraftPhone('');
                                setNewClientContactDraftNotify(true);
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap"
                            >
                              + הוספה לרשימה
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-3 flex justify-end gap-2 mt-2">
                        <button 
                          type="button"
                          onClick={() => setIsAddingClient(false)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                        >
                          ביטול
                        </button>
                        <button 
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                        >
                          שמור לקוח
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Clients Table Panel */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-base">לקוחות פעילים ({clients.filter(c => c.projectId === selectedProject.id).length})</h3>
                  <p className="text-xs text-slate-500">ניתן להוסיף ללא הגבלה לקוח-מנהל ולקוחות רגילים</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-bold uppercase">
                        <th className="p-4 w-8">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                            checked={(() => {
                              const idsInProject = clients.filter(c => c.projectId === selectedProject.id).map(c => c.id);
                              return idsInProject.length > 0 && idsInProject.every(id => selectedClientIds.has(id));
                            })()}
                            onChange={(e) => {
                              const idsInProject = clients.filter(c => c.projectId === selectedProject.id).map(c => c.id);
                              setSelectedClientIds(prev => {
                                const next = new Set(prev);
                                if (e.target.checked) idsInProject.forEach(id => next.add(id));
                                else idsInProject.forEach(id => next.delete(id));
                                return next;
                              });
                            }}
                            title="בחירת כל הלקוחות"
                          />
                        </th>
                        <th className="p-4">פרטי הלקוח</th>
                        <th className="p-4">סוג / מנהל</th>
                        <th className="p-4">קוד גישה (סיסמה לאדמין)</th>
                        <th className="p-4">מצב מסמכים ({selectedProject.requiredDocuments.length})</th>
                        <th className="p-4">סטטוס הגשה</th>
                        <th className="p-4 text-center">פעולות</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {clients
                        .filter(c => c.projectId === selectedProject.id)
                        .filter(c => {
                          const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                c.email.toLowerCase().includes(searchQuery.toLowerCase());
                          
                          // Calculate client state details
                          const state = clientStates.find(s => s.clientId === c.id && s.projectId === selectedProject.id);
                          const docs = selectedProject.requiredDocuments;
                          
                          let approvedCount = 0;
                          let pendingCount = 0;
                          let missingCount = 0;

                          docs.forEach(d => {
                            const ver = state?.documents[d.id] || [];
                            const latest = ver[0];
                            if (!latest) missingCount++;
                            else if (latest.status === 'approved') approvedCount++;
                            else if (latest.status === 'pending') pendingCount++;
                          });

                          const completed = approvedCount === docs.length;

                          if (statusFilter === 'all') return matchesSearch;
                          if (statusFilter === 'completed') return matchesSearch && completed;
                          if (statusFilter === 'missing') return matchesSearch && approvedCount < docs.length;
                          if (statusFilter === 'pending-review') return matchesSearch && pendingCount > 0;
                          return matchesSearch;
                        })
                        .map(c => {
                          const state = clientStates.find(s => s.clientId === c.id && s.projectId === selectedProject.id);
                          
                          // Calculate progress
                          let approvedCount = 0;
                          let pendingCount = 0;
                          let rejectedCount = 0;
                          let missingCount = 0;

                          selectedProject.requiredDocuments.forEach(doc => {
                            const ver = state?.documents[doc.id] || [];
                            const latest = ver[0];
                            if (!latest) missingCount++;
                            else if (latest.status === 'approved') approvedCount++;
                            else if (latest.status === 'pending') pendingCount++;
                            else if (latest.status === 'rejected') rejectedCount++;
                          });

                          const totalReq = selectedProject.requiredDocuments.length;

                          return (
                            <tr 
                              key={c.id} 
                              className={`hover:bg-slate-50/50 transition-colors ${selectedClientId === c.id ? 'bg-indigo-50/30 border-r-4 border-indigo-600' : ''}`}
                            >
                              <td className="p-4">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                                  checked={selectedClientIds.has(c.id)}
                                  onChange={() => toggleClientSelection(c.id)}
                                />
                              </td>
                              <td className="p-4">
                                <div className="font-bold text-slate-900">{c.name}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{c.email} • {c.phone}</div>
                                {c.notes && (
                                  <div className="text-[11px] text-indigo-750 font-medium mt-1 max-w-[240px] truncate bg-indigo-50 px-1.5 py-0.5 rounded-sm inline-block" title={c.notes}>
                                    📌 {c.notes}
                                  </div>
                                )}
                              </td>
                              <td className="p-4">
                                <span className={`inline-block text-xs px-2.5 py-1 rounded font-semibold ${
                                  c.role === 'manager' 
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {c.role === 'manager' ? 'לקוח-מנהל' : 'לקוח רגיל'}
                                </span>
                                {c.role === 'manager' && (
                                  <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                    <span>שליחת התראות:</span>
                                    <span className={c.sendNotificationsToManager ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                      {c.sendNotificationsToManager ? 'פעיל' : 'לא פעיל'}
                                    </span>
                                    <button 
                                      type="button"
                                      onClick={() => onUpdateClient(c.id, { sendNotificationsToManager: !c.sendNotificationsToManager })}
                                      className="text-[10px] text-indigo-600 hover:underline mr-1 cursor-pointer bg-transparent border-none p-0"
                                    >
                                      (שנה)
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono bg-slate-50 text-indigo-600 px-2 py-1 rounded border border-slate-200 font-bold text-xs select-all">
                                    {c.accessCode}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyCode(c.accessCode)}
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                                    title="העתק קוד גישה"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  {copiedCode === c.accessCode && (
                                    <span className="text-[10px] text-emerald-600 font-bold">הועתק!</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-sm font-bold" title="מאושרים">
                                    {approvedCount} מאושר
                                  </span>
                                  {pendingCount > 0 && (
                                    <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-sm font-bold animate-pulse" title="בבדיקה">
                                      {pendingCount} בבדיקה
                                    </span>
                                  )}
                                  {rejectedCount > 0 && (
                                    <span className="text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-sm font-bold" title="דורש תיקון">
                                      {rejectedCount} תיקון
                                    </span>
                                  )}
                                  {missingCount > 0 && (
                                    <span className="text-xs bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-sm" title="חסרים">
                                      {missingCount} חסר
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                {approvedCount === totalReq ? (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 w-fit">
                                    <Check className="w-3.5 h-3.5" />
                                    הסתיים במלואו
                                  </span>
                                ) : (
                                  <div className="w-24">
                                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                      <span>התקדמות</span>
                                      <span>{Math.round((approvedCount / totalReq) * 100)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                      <div 
                                        className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                        style={{ width: `${(approvedCount / totalReq) * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex justify-center gap-1.5">
                                  {/* CPA review button */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedClientId(selectedClientId === c.id ? null : c.id)}
                                    className={`font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                                      selectedClientId === c.id 
                                        ? 'bg-indigo-600 text-white shadow-xs' 
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                    id={`btn-review-client-${c.id}`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    בדיקת רו"ח {pendingCount > 0 && <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block animate-ping" />}
                                  </button>

                                  {/* Impersonate client view directly */}
                                  <button
                                    type="button"
                                    onClick={() => onImpersonate(c.accessCode)}
                                    className="bg-slate-100 hover:bg-slate-200 text-indigo-700 font-bold text-xs px-2 py-1.5 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                                    title="כניסה בתור לקוח"
                                  >
                                    כניסה כלקוח
                                  </button>

                                  {/* Manual Reminder Send */}
                                  <button
                                    type="button"
                                    onClick={() => onSendManualReminder(c.id, selectedProject.id)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-850 p-1.5 rounded-lg border border-slate-200 cursor-pointer"
                                    title="שלח התראה כעת"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => startEditingClient(c)}
                                    className="bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 p-1.5 rounded-lg border border-slate-200 cursor-pointer"
                                    title="ערוך פרטי לקוח"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onDeleteClient(c.id)}
                                    className="bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 p-1.5 rounded-lg border border-slate-200 cursor-pointer"
                                    title="מחק לקוח"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Edit Client Inline Modal */}
              <AnimatePresence>
                {editingClientId && (() => {
                  const editingClient = clients.find(c => c.id === editingClientId);
                  if (!editingClient) return null;
                  return (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-white p-6 rounded-xl border border-indigo-200 shadow-sm"
                    >
                      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Edit className="w-5 h-5 text-indigo-600" />
                        עריכת פרטי לקוח: {editingClient.name}
                      </h3>
                      <form onSubmit={handleSaveClientEdit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">שם הלקוח (חברה/רשות/עמותה) *</label>
                          <input
                            type="text"
                            required
                            value={editClientName}
                            onChange={(e) => setEditClientName(e.target.value)}
                            className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">כתובת אימייל *</label>
                          <input
                            type="email"
                            required
                            value={editClientEmail}
                            onChange={(e) => setEditClientEmail(e.target.value)}
                            className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">מספר טלפון *</label>
                          <input
                            type="text"
                            required
                            value={editClientPhone}
                            onChange={(e) => setEditClientPhone(e.target.value)}
                            className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">סוג לקוח</label>
                          <select
                            value={editClientRole}
                            onChange={(e: any) => setEditClientRole(e.target.value)}
                            className="w-full bg-slate-50 text-slate-850 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="regular">לקוח רגיל (מקבל התראות)</option>
                            <option value="manager">לקוח-מנהל</option>
                          </select>
                        </div>

                        {editClientRole === 'manager' && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">האם לשלוח התראות למנהל זה?</label>
                            <div className="flex items-center gap-2 mt-2">
                              <input
                                type="checkbox"
                                checked={editClientSendNotifications}
                                onChange={(e) => setEditClientSendNotifications(e.target.checked)}
                                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                                id="check-edit-client-notify"
                              />
                              <span className="text-sm font-medium text-slate-700">כן, שלח התראות למייל זה</span>
                            </div>
                          </div>
                        )}

                        <div className="md:col-span-3">
                          <label className="block text-xs font-bold text-slate-500 mb-1">הערות / דגשים מיוחדים לשליחה</label>
                          <textarea
                            rows={2}
                            value={editClientNotes}
                            onChange={(e) => setEditClientNotes(e.target.value)}
                            placeholder="לדוגמה: נא לא לשלוח התראות בימי שלישי..."
                            className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="md:col-span-3 flex justify-end gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => setEditingClientId(null)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                          >
                            ביטול
                          </button>
                          <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                          >
                            שמור שינויים
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>

              {/* SECTION: CPA REVIEW WORKFLOW PANEL FOR SELECTED CLIENT */}
              <AnimatePresence>
                {selectedClientId && (
                  (() => {
                    const client = clients.find(c => c.id === selectedClientId);
                    const state = clientStates.find(s => s.clientId === selectedClientId && s.projectId === selectedProject.id);
                    if (!client) return null;

                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 30 }}
                        className="bg-white rounded-xl border border-indigo-200 p-6 shadow-md relative"
                        id="review-workflow-panel"
                      >
                        <button
                          onClick={() => setSelectedClientId(null)}
                          className="absolute left-6 top-6 text-slate-400 hover:text-slate-700 p-1 rounded-full bg-slate-50 border border-slate-200 cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                            ✓
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">פאנל בדיקה ואישור רו"ח: {client.name}</h3>
                            <p className="text-xs text-slate-500">עבור פרויקט: {selectedProject.name}</p>
                          </div>
                        </div>

                        {/* SECTION: אנשי קשר נוספים ללקוח - כולם נכנסים עם אותו קוד גישה */}
                        <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                              <UserPlus className="w-4 h-4 text-indigo-600" />
                              אנשי קשר נוספים ({clientContacts.filter(cc => cc.clientId === client.id).length})
                            </h4>
                            <button
                              onClick={() => setIsAddingContact(!isAddingContact)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors border border-indigo-200 cursor-pointer"
                            >
                              {isAddingContact ? 'ביטול' : '+ הוספת איש קשר'}
                            </button>
                          </div>

                          <AnimatePresence>
                            {isAddingContact && (
                              <motion.form
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (!newContactName) return;
                                  onAddClientContact(client.id, {
                                    name: newContactName,
                                    email: newContactEmail || undefined,
                                    phone: newContactPhone || undefined,
                                    receivesNotifications: newContactNotify,
                                  });
                                  setNewContactName('');
                                  setNewContactEmail('');
                                  setNewContactPhone('');
                                  setNewContactNotify(true);
                                  setIsAddingContact(false);
                                }}
                                className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3 overflow-hidden bg-white p-3 rounded-lg border border-slate-200"
                              >
                                <input
                                  type="text"
                                  required
                                  placeholder="שם *"
                                  value={newContactName}
                                  onChange={(e) => setNewContactName(e.target.value)}
                                  className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                                <input
                                  type="email"
                                  placeholder="אימייל"
                                  value={newContactEmail}
                                  onChange={(e) => setNewContactEmail(e.target.value)}
                                  className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                                <input
                                  type="text"
                                  placeholder="נייד"
                                  value={newContactPhone}
                                  onChange={(e) => setNewContactPhone(e.target.value)}
                                  className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                                <div className="flex items-center gap-3">
                                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={newContactNotify}
                                      onChange={(e) => setNewContactNotify(e.target.checked)}
                                      className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                                    />
                                    מקבל התראות
                                  </label>
                                  <button
                                    type="submit"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                                  >
                                    שמור
                                  </button>
                                </div>
                              </motion.form>
                            )}
                          </AnimatePresence>

                          <div className="flex justify-between items-center bg-indigo-50/40 p-2 rounded-lg border border-indigo-100 text-xs mb-2">
                            <div>
                              <span className="font-bold text-slate-800">{client.name}</span>
                              <span className="text-[10px] text-indigo-600 font-bold mr-2">(איש קשר ראשי)</span>
                              <span className="text-slate-500 mr-2"> • {client.email}</span>
                            </div>
                            <button
                              onClick={() => onUpdateClient(client.id, { receivesNotifications: !client.receivesNotifications })}
                              className={`flex items-center gap-1 font-bold px-2 py-1 rounded-lg border cursor-pointer ${
                                client.receivesNotifications
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                              title="הפעל/כבה קבלת התראות שוטפות"
                            >
                              {client.receivesNotifications ? <BellRing className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                              {client.receivesNotifications ? 'מקבל התראות' : 'לא מקבל'}
                            </button>
                          </div>

                          {clientContacts.filter(cc => cc.clientId === client.id).length === 0 ? (
                            <p className="text-xs text-slate-400 italic">אין עדיין אנשי קשר נוספים - רק הלקוח הראשי.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {clientContacts.filter(cc => cc.clientId === client.id).map(cc => (
                                editingContactId === cc.id ? (
                                  <div key={cc.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-white p-2 rounded-lg border border-indigo-200 text-xs">
                                    <input
                                      type="text"
                                      placeholder="שם *"
                                      value={editContactName}
                                      onChange={(e) => setEditContactName(e.target.value)}
                                      className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <input
                                      type="email"
                                      placeholder="אימייל"
                                      value={editContactEmail}
                                      onChange={(e) => setEditContactEmail(e.target.value)}
                                      className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <input
                                      type="text"
                                      placeholder="נייד"
                                      value={editContactPhone}
                                      onChange={(e) => setEditContactPhone(e.target.value)}
                                      className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleSaveContactEdit(cc.id)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                                      >
                                        שמור
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingContactId(null)}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                                      >
                                        ביטול
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                <div key={cc.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 text-xs">
                                  <div>
                                    <span className="font-bold text-slate-800">{cc.name}</span>
                                    {cc.email && <span className="text-slate-500 mr-2"> • {cc.email}</span>}
                                    {cc.phone && <span className="text-slate-500 mr-2"> • {cc.phone}</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => onUpdateClientContact(cc.id, { receivesNotifications: !cc.receivesNotifications })}
                                      className={`flex items-center gap-1 font-bold px-2 py-1 rounded-lg border cursor-pointer ${
                                        cc.receivesNotifications
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-slate-100 text-slate-500 border-slate-200'
                                      }`}
                                      title="הפעל/כבה קבלת התראות שוטפות"
                                    >
                                      {cc.receivesNotifications ? <BellRing className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                                      {cc.receivesNotifications ? 'מקבל התראות' : 'לא מקבל'}
                                    </button>
                                    <button
                                      onClick={() => startEditingContact(cc)}
                                      className="bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 p-1 rounded-lg border border-slate-200 cursor-pointer"
                                      title="ערוך איש קשר"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => onDeleteClientContact(cc.id)}
                                      className="bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 p-1 rounded-lg border border-slate-200 cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                )
                              ))}
                            </div>
                          )}
                        </div>

                        {state?.comments && (
                          <div className="mb-6 bg-amber-50 border-r-4 border-amber-500 p-4 rounded-l-lg text-amber-950 text-sm">
                            <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-900">
                              ✍️ הערות והבהרות מצד הלקוח (אינבוקס):
                            </p>
                            <p className="whitespace-pre-line leading-relaxed text-slate-800">{state.comments}</p>
                          </div>
                        )}

                        {/* List of 10 documents to review */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {selectedProject.requiredDocuments.map((doc, idx) => {
                            const versions = state?.documents[doc.id] || [];
                            const latest = versions[0];

                            return (
                              <div 
                                key={doc.id}
                                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                                  latest 
                                    ? latest.status === 'pending'
                                      ? 'bg-indigo-50/20 border-indigo-200'
                                      : latest.status === 'approved'
                                      ? 'bg-emerald-50/15 border-emerald-200'
                                      : 'bg-rose-50/15 border-rose-200'
                                    : 'bg-slate-50/50 border-slate-200'
                                }`}
                              >
                                <div>
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                                        סעיף {idx + 1}
                                      </span>
                                      <h4 className="font-bold text-sm text-slate-900">{doc.name}</h4>
                                      {doc.isRequired && <span className="text-rose-500 text-[10px] font-bold">* חובה</span>}
                                    </div>

                                    {/* Small status badge */}
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                                      latest 
                                        ? latest.status === 'approved'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : latest.status === 'rejected'
                                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}>
                                      {latest ? latest.status === 'approved' ? 'מאושר' : latest.status === 'rejected' ? 'לא תקין' : 'בבדיקה' : 'טרם הועלה'}
                                    </span>
                                  </div>

                                  {latest ? (
                                    <div className="mt-2.5 bg-slate-50 p-2.5 rounded border border-slate-200">
                                      <div className="flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-1.5 text-slate-700">
                                          <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />
                                          <span className="font-bold truncate max-w-[220px]" title={latest.fileName}>
                                            {latest.fileName}
                                          </span>
                                        </div>
                                        <a 
                                          href="#" 
                                          onClick={(e) => { e.preventDefault(); if (latest.storagePath) onDownloadFile(latest.storagePath, latest.fileName); }}
                                          className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded cursor-pointer"
                                        >
                                          <FileDown className="w-3 h-3" />
                                          הורדה
                                        </a>
                                      </div>
                                      <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                                        <span>גרסה: {latest.version}</span>
                                        <span>הועלה ב: {latest.uploadedAt}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 mt-3 italic">הלקוח לא העלה קובץ זה עדיין.</p>
                                  )}
                                </div>

                                {/* Review Actions for file */}
                                {latest && (
                                  <div className="mt-2 space-y-2 pt-2 border-t border-slate-200">
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="text"
                                        placeholder="הערה/סיבת אי-תקינות (פירוט יישלח אוטומטית בהודעה)"
                                        value={reviewComment[doc.id] || ''}
                                        onChange={(e) => setReviewComment({ ...reviewComment, [doc.id]: e.target.value })}
                                        className="bg-white text-xs text-slate-900 rounded-lg p-2 border border-slate-200 flex-1 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        id={`comment-${doc.id}`}
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <button
                                        onClick={() => {
                                          onReviewFile(client.id, selectedProject.id, doc.id, latest.id, 'rejected', reviewComment[doc.id]);
                                          // Clear review comment
                                          setReviewComment({ ...reviewComment, [doc.id]: '' });
                                        }}
                                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-rose-200 cursor-pointer"
                                        id={`btn-reject-${doc.id}`}
                                      >
                                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                        סמן כלא תקין
                                      </button>
                                      
                                      <button
                                        onClick={() => {
                                          onReviewFile(client.id, selectedProject.id, doc.id, latest.id, 'approved', reviewComment[doc.id]);
                                          setReviewComment({ ...reviewComment, [doc.id]: '' });
                                        }}
                                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-emerald-200 cursor-pointer"
                                        id={`btn-approve-${doc.id}`}
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        אשר קובץ (תקין)
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  })()
                )}
              </AnimatePresence>
            </div>
          )}

          {/* TAB 2: EXCEL BULK IMPORT & MANUAL ADDITION */}
          {activeTab === 'import' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Box 1: Excel Bulk Import */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                    ייבוא רשימת לקוחות ונתונים מקובץ אקסל
                  </h3>
                  <p className="text-xs text-slate-500 mb-6 font-medium">
                    העתק את שורות הנתונים מקובץ ה-Excel שלך והדבק אותן ישירות בתיבה למטה. אנו נבצע ניתוח ונקלוט את הלקוחות מיד.
                  </p>

                  {importFeedback && (
                    <div className={`p-4 rounded-lg mb-6 text-sm ${importFeedback.includes('שגיאה') ? 'bg-rose-50 text-rose-700 border border-rose-200 font-medium' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium'}`}>
                      {importFeedback}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2">
                        הדבק נתונים מאקסל (עמודות: שם | מייל | טלפון | סוג [מנהל/רגיל] | שליחת התראות למנהל [כן/לא] | הערות):
                      </label>
                      <textarea
                        rows={8}
                        value={excelPasteText}
                        onChange={(e) => setExcelPasteText(e.target.value)}
                        placeholder={`עיריית שדרות - חינוך\tsderot-edu@example.com\t052-9988776\tמנהל\tכן\tרכזת קייטנות
מועצה מקומית ירוחם\tyeruham@example.com\t054-1122334\tרגיל\t\tללא דגשים מיוחדים`}
                        className="w-full bg-slate-50 text-slate-900 font-mono text-xs rounded-lg p-3 border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 whitespace-pre"
                      />
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs text-slate-500 space-y-1">
                      <p className="font-bold text-slate-700">💡 טיפ להעתקה קלה:</p>
                      <p>1. באקסל שלך, סדר את העמודות לפי הסדר הבא: שם, דואר אלקטרוני, טלפון, סוג (מנהל/רגיל).</p>
                      <p>2. סמן את השורות שברצונך לייבא, העתק אותן (Ctrl+C).</p>
                      <p>3. הדבק אותן בתיבה למטה (Ctrl+V) ולחץ על כפתור הקליטה.</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setExcelPasteText('')}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                  >
                    נקה
                  </button>
                  <button
                    onClick={handleExcelImport}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                  >
                    קלוט לקוחות מאקסל
                  </button>
                </div>
              </div>

              {/* Box 2: Manual Client Addition */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    הוספת לקוח בודד פיזית (ידנית)
                  </h3>
                  <p className="text-xs text-slate-500 mb-6 font-medium">
                    מלא את פרטי הלקוח הבודד בשדות מטה כדי ליצור אותו ישירות במערכת עבור הפרויקט הנוכחי.
                  </p>

                  {manualClientFeedback && (
                    <div className={`p-4 rounded-lg mb-6 text-sm ${manualClientFeedback.includes('שגיאה') ? 'bg-rose-50 text-rose-700 border border-rose-200 font-medium' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium'}`}>
                      {manualClientFeedback}
                    </div>
                  )}

                  <form onSubmit={handleCreateManualClientInImport} id="manual-import-form" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">שם הלקוח (חברה/רשות/עמותה) *</label>
                        <input
                          type="text"
                          required
                          value={manualClientName}
                          onChange={(e) => setManualClientName(e.target.value)}
                          placeholder="לדוגמה: עיריית שדרות"
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">כתובת אימייל *</label>
                        <input
                          type="email"
                          required
                          value={manualClientEmail}
                          onChange={(e) => setManualClientEmail(e.target.value)}
                          placeholder="client@example.com"
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">מספר טלפון *</label>
                        <input
                          type="text"
                          required
                          value={manualClientPhone}
                          onChange={(e) => setManualClientPhone(e.target.value)}
                          placeholder="05X-XXXXXXX"
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">סיווג לקוח (סוג הלקוח) *</label>
                        <select
                          value={manualClientRole}
                          onChange={(e) => setManualClientRole(e.target.value as 'manager' | 'regular')}
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="regular">לקוח רגיל</option>
                          <option value="manager">לקוח מנהל (צופה-על)</option>
                        </select>
                      </div>
                    </div>

                    {/* Checkbox for notifications if role is 'manager' */}
                    <AnimatePresence>
                      {manualClientRole === 'manager' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/50 overflow-hidden"
                        >
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={manualClientSendNotifications}
                              onChange={(e) => setManualClientSendNotifications(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-indigo-950">שליחת התראות / עדכונים למנהל זה (כן/לא)</span>
                          </label>
                          <p className="text-[10px] text-indigo-600 mt-1 mr-6">
                            כאשר מסומן, מנהל זה יקבל עדכוני מייל אוטומטיים על פעולות של הלקוחות הרגילים בפרויקט.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">הערות מיוחדות (אופציונלי)</label>
                      <input
                        type="text"
                        value={manualClientNotes}
                        onChange={(e) => setManualClientNotes(e.target.value)}
                        placeholder="למשל: דגשים מיוחדים, הערות ניהוליות"
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-1">
                        <UserPlus className="w-4 h-4 text-indigo-600" />
                        משתמשים נוספים ללקוח זה ({manualClientExtraContacts.length})
                      </h4>
                      <p className="text-[11px] text-slate-500 mb-3">
                        כל המשתמשים הנוספים יקבלו את קוד הגישה במייל/SMS בעת יצירת הלקוח, ללא קשר להגדרת קבלת ההתראות שלהם.
                      </p>

                      {manualClientExtraContacts.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {manualClientExtraContacts.map((contact, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 text-xs">
                              <div>
                                <span className="font-bold text-slate-800">{contact.name}</span>
                                {contact.email && <span className="text-slate-500 mr-2"> • {contact.email}</span>}
                                {contact.phone && <span className="text-slate-500 mr-2 font-mono"> • {contact.phone}</span>}
                                <span className={`mr-2 font-bold ${contact.receivesNotifications ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {contact.receivesNotifications ? 'מקבל התראות' : 'לא מקבל התראות'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setManualClientExtraContacts(prev => prev.filter((_, i) => i !== idx))}
                                className="text-rose-500 hover:text-rose-700 cursor-pointer"
                                title="הסר"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-white p-3 rounded-lg border border-slate-200">
                        <input
                          type="text"
                          placeholder="שם *"
                          value={manualContactDraftName}
                          onChange={(e) => setManualContactDraftName(e.target.value)}
                          className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="email"
                          placeholder="אימייל"
                          value={manualContactDraftEmail}
                          onChange={(e) => setManualContactDraftEmail(e.target.value)}
                          className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="נייד (לא חובה)"
                          value={manualContactDraftPhone}
                          onChange={(e) => setManualContactDraftPhone(e.target.value)}
                          className="bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer select-none whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={manualContactDraftNotify}
                              onChange={(e) => setManualContactDraftNotify(e.target.checked)}
                              className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                            />
                            מקבל התראות
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (!manualContactDraftName) return;
                              setManualClientExtraContacts(prev => [...prev, {
                                name: manualContactDraftName,
                                email: manualContactDraftEmail,
                                phone: manualContactDraftPhone,
                                receivesNotifications: manualContactDraftNotify,
                              }]);
                              setManualContactDraftName('');
                              setManualContactDraftEmail('');
                              setManualContactDraftPhone('');
                              setManualContactDraftNotify(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap"
                          >
                            + הוספה לרשימה
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setManualClientName('');
                      setManualClientEmail('');
                      setManualClientPhone('');
                      setManualClientRole('regular');
                      setManualClientSendNotifications(true);
                      setManualClientNotes('');
                      setManualClientFeedback(null);
                      setManualClientExtraContacts([]);
                      setManualContactDraftName('');
                      setManualContactDraftEmail('');
                      setManualContactDraftPhone('');
                      setManualContactDraftNotify(true);
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                  >
                    אפס טופס
                  </button>
                  <button
                    type="submit"
                    form="manual-import-form"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                  >
                    שמור לקוח חדש
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ALERTS & NOTIFICATION SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-600" />
                  הגדרות מעקב וניהול התראות מותאמות אישית
                </h3>
                <p className="text-xs text-slate-500 mb-6">
                  הגדר עבור מחלקה/פרויקט הנוכחי את נוסח הודעות המייל וה-SMS החכמות שישלחו אוטומטית כמזכיר על חוסרים.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Settings Panel */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">תדירות שליחת תזכורות אוטומטיות (ימים)</label>
                      <input
                        type="number"
                        min={1}
                        value={selectedProject.trackingSettings.reminderIntervalDays}
                        onChange={(e) => onUpdateProjectSettings(selectedProject.id, { reminderIntervalDays: parseInt(e.target.value) || 3 })}
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">כל כמה ימים ישלח לכל הלקוחות שעדיין לא שלחו את כלל החומרים תזכורת אוטומטית.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">מזהה תזכורת ה-SMS המותאם אישית</label>
                      <textarea
                        rows={3}
                        value={selectedProject.trackingSettings.smsTemplate}
                        onChange={(e) => onUpdateProjectSettings(selectedProject.id, { smsTemplate: e.target.value })}
                        className="w-full bg-slate-50 text-slate-900 font-mono text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Right: Email Template Panel */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">נוסח ברירת מחדל של מייל בקשת חומרים / תזכורת</label>
                      <textarea
                        rows={10}
                        value={selectedProject.trackingSettings.emailTemplate}
                        onChange={(e) => onUpdateProjectSettings(selectedProject.id, { emailTemplate: e.target.value })}
                        className="w-full bg-slate-50 text-slate-900 font-mono text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs text-slate-500 space-y-1">
                  <p className="font-bold text-slate-700">תגיות דינמיות נתמכות במערכת:</p>
                  <p><code className="text-indigo-600 font-bold">{'{clientName}'}</code> - שם הלקוח</p>
                  <p><code className="text-indigo-600 font-bold">{'{projectName}'}</code> - שם המחלקה / הפרויקט</p>
                  <p><code className="text-indigo-600 font-bold">{'{accessCode}'}</code> - קוד הגישה האישי של הלקוח</p>
                  <p><code className="text-indigo-600 font-bold">{'{missingDocuments}'}</code> - רשימת הקבצים החסרים או הפסולים בבולטים</p>
                  <p><code className="text-indigo-600 font-bold">{'{appUrl}'}</code> - קישור ישיר למערכת</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NOTIFICATION LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-600" />
                  לוג שליחת התראות, מיילים ו-SMS
                </h3>
                <p className="text-xs text-slate-500 mb-6">
                  תיעוד מלא ומעקב אחר כלל ההודעות והתזכורות שנשלחו למנהלים ולקוחות רגילים במחלקה.
                </p>

                <div className="space-y-4">
                  {notificationLogs.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-lg">
                      לא נשלחו הודעות עדיין במערכת.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 max-h-[500px] overflow-y-auto pr-2 text-slate-850">
                      {notificationLogs
                        .filter(l => l.projectId === selectedProject.id)
                        .map(log => (
                          <div key={log.id} className="py-3 flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">{log.clientName}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  log.type === 'email' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                  {log.type === 'email' ? 'אימייל' : 'SMS'}
                                </span>
                                <span className="text-slate-400 text-xs">{log.sentAt}</span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">נמען: <span className="font-mono">{log.recipient}</span></p>
                              <div className="bg-slate-50 p-2.5 rounded text-xs text-slate-800 mt-2 whitespace-pre-wrap font-mono leading-relaxed border border-slate-200">
                                {log.subject && <p className="font-bold text-indigo-600 mb-1">נושא: {log.subject}</p>}
                                {log.content}
                              </div>
                            </div>
                            <span className="text-emerald-700 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              נשלח בהצלחה
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CLAUDE READINESS EXPORT & IMPORT */}
          {activeTab === 'export-import' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Download className="w-5 h-5 text-indigo-600" />
                  העברה ושמירת נתונים להמשך פיתוח ב-CLAUDE
                </h3>
                <p className="text-xs text-slate-500 mb-6">
                  כדי שתוכל להעלות את המערכת ל-CLAUDE ולהמשיך בדיוק מהנקודה שבה הפסקת, באפשרותך לייצא את כל בסיס הנתונים (הלקוחות, קבצי ההגשה שלהם, היסטוריית הגרסאות וסטטוס הבדיקה) כקובץ JSON.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Export Box */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between shadow-xs">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-2">ייצוא נתונים (Export)</h4>
                      <p className="text-xs text-slate-500 mb-4">
                        לחץ על כפתור הייצוא להורדת קובץ הנתונים המלא של המערכת למחשב שלך. שמור אותו והעלה אותו לקלוד יחד עם הקוד במידת הצורך.
                      </p>
                    </div>
                    <button
                      onClick={onExportData}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      ייצא את כל נתוני המערכת (JSON)
                    </button>
                  </div>

                  {/* Import Box */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between shadow-xs">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-2">ייבוא נתונים (Import)</h4>
                      <p className="text-xs text-slate-500 mb-3">
                        הדבק תוכן קובץ נתונים שנשמר בעבר כדי לשחזר את כל הלקוחות, קוד הגישה, הקבצים וההיסטוריה.
                      </p>
                      
                      {jsonImportFeedback && (
                        <p className={`text-xs p-2 rounded mb-3 ${jsonImportFeedback.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium' : 'bg-rose-50 text-rose-700 border border-rose-200 font-medium'}`}>
                          {jsonImportFeedback.message}
                        </p>
                      )}

                      <textarea
                        rows={3}
                        value={jsonImportStr}
                        onChange={(e) => setJsonImportStr(e.target.value)}
                        placeholder="הדבק את תוכן ה-JSON כאן..."
                        className="w-full bg-white text-slate-900 font-mono text-[10px] border border-slate-200 rounded p-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      onClick={handleJsonImport}
                      disabled={!jsonImportStr.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 font-bold py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors mt-3 cursor-pointer"
                    >
                      <UploadIcon className="w-4 h-4" />
                      ייבא נתונים ושחזר מצב
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: STAFF / ADMIN USERS MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <UserCog className="w-5 h-5 text-indigo-600" />
                      ניהול משתמשי מנהל (צוות המשרד)
                    </h3>
                    <p className="text-xs text-slate-500">
                      אנשי צוות שמופיעים ברשימה יכולים להתחבר לפאנל הניהול הזה עם אימייל וסיסמה משלהם.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddingStaff(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    הוספת איש צוות
                  </button>
                </div>

                <AnimatePresence>
                  {isAddingStaff && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 overflow-hidden"
                    >
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!newStaffName || !newStaffEmail) return;
                          onAddStaff(newStaffName, newStaffEmail);
                          setNewStaffName('');
                          setNewStaffEmail('');
                          setIsAddingStaff(false);
                        }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-3"
                      >
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">שם מלא *</label>
                          <input
                            type="text"
                            required
                            value={newStaffName}
                            onChange={(e) => setNewStaffName(e.target.value)}
                            className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">אימייל *</label>
                          <input
                            type="email"
                            required
                            value={newStaffEmail}
                            onChange={(e) => setNewStaffEmail(e.target.value)}
                            className="w-full bg-white text-slate-900 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingStaff(false)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                          >
                            ביטול
                          </button>
                          <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
                          >
                            שמור
                          </button>
                        </div>
                      </form>
                      <p className="text-[10px] text-slate-500 mt-2">
                        ישלח לאיש הצוות מייל עם קישור להגדרת סיסמה וכניסה ראשונה.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="divide-y divide-slate-200">
                  {staff.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-lg">
                      אין עדיין אנשי צוות רשומים.
                    </div>
                  ) : (
                    staff.map((s) => (
                      <div key={s.id} className="py-3 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{s.fullName}</div>
                          <div className="text-xs text-slate-500">{s.email}</div>
                        </div>
                        <button
                          onClick={() => onRemoveStaff(s.id)}
                          className="bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 p-1.5 rounded-lg border border-slate-200 cursor-pointer"
                          title="הסר איש צוות"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  ChevronRight,
  ShieldAlert,
  LogOut,
  Loader2,
  UserCog,
} from 'lucide-react';
import { Client, Project, ClientProjectState, NotificationLog, ClientContact, StaffMember } from './types';
import AdminPanel from './components/AdminPanel';
import ClientPortal from './components/ClientPortal';
import * as api from './lib/api';
import { supabase } from './lib/supabaseClient';

type Role = 'loading' | 'login' | 'client' | 'admin' | 'recovery';

export default function App() {
  const [currentRole, setCurrentRole] = useState<Role>('loading');

  // Client login form
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggedClient, setLoggedClient] = useState<Client | null>(null);

  // Staff login form
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffLoginError, setStaffLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot / reset password
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Core data
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientStates, setClientStates] = useState<ClientProjectState[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [clientContacts, setClientContacts] = useState<ClientContact[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);

  const [alertBanner, setAlertBanner] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showAlert = (message: string, type: 'success' | 'error' = 'success') => {
    setAlertBanner({ message, type });
    setTimeout(() => setAlertBanner(null), 4500);
  };

  // ---------- טעינת נתונים ----------
  const loadAdminData = useCallback(async () => {
    const [p, c, s, l, cc, st] = await Promise.all([
      api.fetchProjects(),
      api.fetchClients(),
      api.fetchClientStates(),
      api.fetchNotificationLogs(),
      api.fetchClientContacts(),
      api.fetchStaff(),
    ]);
    setProjects(p);
    setClients(c as Client[]);
    setClientStates(s);
    setNotificationLogs(l);
    setClientContacts(cc);
    setStaff(st);
  }, []);

  const loadClientData = useCallback(async () => {
    const [p, s] = await Promise.all([api.fetchProjects(), api.fetchClientStates()]);
    setProjects(p);
    setClientStates(s);
  }, []);

  // ---------- בדיקת session קיים בטעינה ----------
  useEffect(() => {
    (async () => {
      try {
        const info = await api.getCurrentSessionInfo();
        if (info.kind === 'staff') {
          await loadAdminData();
          setCurrentRole('admin');
        } else if (info.kind === 'client') {
          setLoggedClient(info.client);
          await loadClientData();
          setCurrentRole('client');
        } else {
          setCurrentRole('login');
        }
      } catch (e) {
        console.error(e);
        setCurrentRole('login');
      }
    })();
  }, [loadAdminData, loadClientData]);

  // ---------- קישור איפוס סיסמה (מגיע מהמייל) ----------
  // Supabase שולח את המשתמש חזרה לאתר עם session זמני ומאתת PASSWORD_RECOVERY.
  // בלי המאזין הזה, לחיצה על קישור האיפוס לא הייתה עושה כלום - וזו הייתה הסיבה
  // שהסיסמה בפועל אף פעם לא התעדכנה.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryError(null);
        setCurrentRole('recovery');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // ---------- כניסה / יציאה ----------
  const handleClientLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!accessCodeInput.trim()) return;
    setIsSubmitting(true);
    setLoginError(null);
    try {
      await api.loginWithAccessCode(accessCodeInput.trim());
      const info = await api.getCurrentSessionInfo();
      if (info.kind === 'client') {
        setLoggedClient(info.client);
        await loadClientData();
        setCurrentRole('client');
        setAccessCodeInput('');
        showAlert('ברוכים הבאים, כניסתך אושרה בהצלחה.');
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'קוד גישה אינו תקין. נא לבדוק ולנסות שנית.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStaffLoginError(null);
    try {
      await api.loginStaff(staffEmail.trim(), staffPassword);
      await loadAdminData();
      setCurrentRole('admin');
      setStaffPassword('');
    } catch (err) {
      setStaffLoginError(err instanceof Error ? err.message : 'התחברות נכשלה. בדקו אימייל/סיסמה.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setIsSubmitting(true);
    setForgotStatus(null);
    try {
      await api.sendStaffPasswordReset(forgotEmail.trim(), window.location.origin);
      setForgotStatus({
        message: 'אם קיים חשבון עם המייל הזה, נשלח אליו קישור לאיפוס סיסמה. בדקו את תיבת הדואר (וגם ספאם).',
        type: 'success',
      });
    } catch (err) {
      setForgotStatus({ message: err instanceof Error ? err.message : 'שליחת מייל האיפוס נכשלה.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    if (newPassword.length < 6) {
      setRecoveryError('הסיסמה חייבת להכיל לפחות 6 תווים.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setRecoveryError('הסיסמאות אינן תואמות.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.updateStaffPassword(newPassword);
      await api.logout();
      setNewPassword('');
      setNewPasswordConfirm('');
      setShowStaffLogin(true);
      setCurrentRole('login');
      showAlert('הסיסמה עודכנה בהצלחה! נא להתחבר עם הסיסמה החדשה.');
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : 'עדכון הסיסמה נכשל.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setLoggedClient(null);
    setProjects([]);
    setClients([]);
    setClientStates([]);
    setNotificationLogs([]);
    setCurrentRole('login');
  };

  // צפייה כלקוח (מזמין מנהל חשבון) - שימו לב: פעולה זו מחליפה את החיבור
  // הנוכחי בחיבור הלקוח, ולכן כדי לחזור לפאנל האדמין יש להתחבר מחדש
  const handleImpersonate = async (accessCode: string) => {
    if (!confirm('פעולה זו תעביר אתכם לצפייה בפועל כלקוח, ותנתק אתכם מפאנל הניהול. להתחבר בחזרה תצטרכו להזין שוב אימייל וסיסמה. להמשיך?')) {
      return;
    }
    try {
      await api.loginWithAccessCode(accessCode);
      const info = await api.getCurrentSessionInfo();
      if (info.kind === 'client') {
        setLoggedClient(info.client);
        await loadClientData();
        setCurrentRole('client');
        showAlert(`דימוי לקוח פעיל: ${info.client.name}`);
      }
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בדימוי לקוח', 'error');
    }
  };

  // ---------- פעולות לקוח ----------
  const handleUploadFile = async (documentId: string, file: File) => {
    if (!loggedClient) return;
    try {
      await api.uploadFile(loggedClient.id, loggedClient.projectId, documentId, file);
      await loadClientData();
      showAlert(`קובץ "${file.name}" נשמר כטיוטה בהצלחה! אל תשכחו ללחוץ על "שליחה לרואה חשבון" בסיום.`);
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בהעלאת הקובץ', 'error');
    }
  };

  const handleSendToCpa = async (clientId: string, projectId: string, comments: string) => {
    try {
      await api.sendToCpa(clientId, projectId, comments);
      await loadClientData();
      showAlert('כלל הקבצים נשלחו לרואה החשבון בהצלחה בצירוף הערותיך!');
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בשליחת הקבצים', 'error');
    }
  };

  // ---------- פעולות אדמין ----------
  const handleAddClient = async (
    newClient: Omit<Client, 'id' | 'accessCode' | 'projectId'>,
    projectId: string
  ) => {
    try {
      const created = await api.addClient(projectId, newClient);
      await loadAdminData();
      showAlert(`לקוח "${created.name}" התווסף בהצלחה עם קוד גישה: ${created.accessCode}`);
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בהוספת הלקוח', 'error');
    }
  };

  const handleUpdateClient = async (clientId: string, updated: Partial<Client>) => {
    try {
      await api.updateClient(clientId, updated);
      await loadAdminData();
      showAlert('פרטי הלקוח עודכנו בהצלחה');
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בעדכון הלקוח', 'error');
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק לקוח זה ואת כל מסמכיו? פעולה זו אינה הפיכה.')) return;
    try {
      await api.deleteClient(clientId);
      await loadAdminData();
      showAlert('הלקוח נמחק בהצלחה');
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה במחיקת הלקוח', 'error');
    }
  };

  const handleImportClients = async (
    imported: Omit<Client, 'id' | 'accessCode' | 'projectId'>[],
    projectId: string
  ) => {
    try {
      const result = await api.importClients(projectId, imported);
      await loadAdminData();
      showAlert(`יובאו בהצלחה ${result.created} לקוחות מתוך ${imported.length}${result.failed ? ` (${result.failed} נכשלו)` : ''}.`);
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בייבוא לקוחות', 'error');
    }
  };

  const handleReviewFile = async (
    clientId: string,
    projectId: string,
    documentId: string,
    fileId: string,
    status: 'approved' | 'rejected',
    comment?: string
  ) => {
    try {
      await api.reviewFile(fileId, status, comment);
      await loadAdminData();
      showAlert(`הקובץ עודכן לסטטוס "${status === 'approved' ? 'מאושר' : 'לא תקין'}" ונשלח עדכון אוטומטי ללקוח.`);
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בעדכון הקובץ', 'error');
    }
  };

  const handleDownloadFile = async (storagePath: string, fileName: string) => {
    try {
      const url = await api.getFileDownloadUrl(storagePath);
      window.open(url, '_blank');
    } catch (err) {
      showAlert(err instanceof Error ? err.message : `שגיאה בהורדת הקובץ "${fileName}"`, 'error');
    }
  };

  const handleSendManualReminder = async (clientId: string, projectId: string) => {
    try {
      await api.sendManualReminder(clientId, projectId, window.location.origin);
      await loadAdminData();
      showAlert('התראת מייל תזכורת נשלחה בהצלחה.');
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בשליחת התזכורת', 'error');
    }
  };

  const handleSendBulkReminders = async (projectId: string) => {
    try {
      await api.sendBulkReminders(projectId, window.location.origin);
      await loadAdminData();
      showAlert('נשלחו תזכורות גורפות לכלל הלקוחות שטרם השלימו הגשות!');
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בשליחת תזכורות', 'error');
    }
  };

  // ---------- אנשי קשר נוספים ללקוח ----------
  const handleAddClientContact = async (
    clientId: string,
    contact: { name: string; email?: string; phone?: string; receivesNotifications: boolean }
  ) => {
    try {
      const result = await api.addClientContact(clientId, contact);
      await loadAdminData();
      showAlert(
        `איש הקשר "${contact.name}" נוסף בהצלחה` +
          (result.emailSent || result.smsSent ? ' ונשלחה לו הודעת כניסה.' : '.')
      );
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בהוספת איש קשר', 'error');
    }
  };

  const handleUpdateClientContact = async (
    contactId: string,
    updates: Partial<Pick<ClientContact, 'name' | 'email' | 'phone' | 'receivesNotifications'>>
  ) => {
    try {
      await api.updateClientContact(contactId, updates);
      await loadAdminData();
      showAlert('פרטי איש הקשר עודכנו בהצלחה');
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בעדכון איש קשר', 'error');
    }
  };

  const handleDeleteClientContact = async (contactId: string) => {
    if (!confirm('להסיר את איש הקשר הזה?')) return;
    try {
      await api.deleteClientContact(contactId);
      await loadAdminData();
      showAlert('איש הקשר הוסר בהצלחה');
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בהסרת איש קשר', 'error');
    }
  };

  // ---------- ניהול אנשי צוות (אדמינים) ----------
  const handleAddStaff = async (fullName: string, email: string) => {
    try {
      const result = await api.addStaffMember(fullName, email);
      await loadAdminData();
      showAlert(
        `איש הצוות "${fullName}" נוצר בהצלחה` +
          (result.emailSent ? ' ונשלח לו מייל להגדרת סיסמה.' : ' (המייל לא נשלח - יש לבדוק הגדרות SMTP).')
      );
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה ביצירת איש צוות', 'error');
    }
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!confirm('להסיר את איש הצוות הזה? הוא לא יוכל יותר להתחבר לפאנל הניהול.')) return;
    try {
      await api.removeStaffMember(staffId);
      await loadAdminData();
      showAlert('איש הצוות הוסר בהצלחה');
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בהסרת איש צוות', 'error');
    }
  };

  // ---------- שליחה חוזרת של קוד גישה ללקוחות נבחרים ----------
  const handleResendAccessCodes = async (clientIds: string[]) => {
    if (clientIds.length === 0) {
      showAlert('בחרו לפחות לקוח אחד', 'error');
      return;
    }
    try {
      const { results } = await api.resendAccessCodes(clientIds);
      const totalEmails = results.reduce((sum, r) => sum + r.emailsSent, 0);
      const totalSms = results.reduce((sum, r) => sum + r.smsSent, 0);
      showAlert(
        `קוד הגישה נשלח מחדש ל-${clientIds.length} לקוחות (${totalEmails} מיילים${totalSms > 0 ? `, ${totalSms} הודעות SMS` : ''}).`
      );
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בשליחה חוזרת של קוד הגישה', 'error');
    }
  };

  const handleUpdateProjectSettings = async (
    projectId: string,
    settings: Partial<Project['trackingSettings']>
  ) => {
    try {
      await api.updateProjectSettings(projectId, settings);
      await loadAdminData();
      showAlert('הגדרות המעקב והתבניות עודכנו בהצלחה.');
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'שגיאה בעדכון ההגדרות', 'error');
    }
  };

  const handleExportData = () => {
    const fullState = {
      exportedAt: new Date().toISOString(),
      projects,
      clients,
      clientStates,
      notificationLogs,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fullState, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `gottlieb_biton_system_state_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    showAlert('קובץ נתוני המערכת יוצא בהצלחה!');
  };

  // שחזור מלא מקובץ JSON הושבת בכוונה: עכשיו יש מסד נתונים אמיתי ומשותף,
  // ושחזור גורף עלול לדרוס נתונים חיים של לקוחות אחרים. השתמשו בפעולות
  // הניהול הרגילות (הוספה/עריכה/מחיקה) במקום.
  const handleImportData = (_jsonStr: string): boolean => {
    showAlert('שחזור מקובץ גיבוי אינו נתמך יותר מול מסד הנתונים החי, כדי למנוע דריסת נתונים אמיתיים.', 'error');
    return false;
  };

  // ---------- מסכי טעינה ----------
  if (currentRole === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // ---------- מסך קביעת סיסמה חדשה (אחרי לחיצה על קישור איפוס מהמייל) ----------
  if (currentRole === 'recovery') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 md:p-8 w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">קביעת סיסמה חדשה</h2>
            <p className="text-xs text-slate-500">הזינו סיסמה חדשה לחשבון הצוות שלכם</p>
          </div>

          {recoveryError && (
            <div className="bg-rose-50 text-rose-800 border border-rose-200 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{recoveryError}</span>
            </div>
          )}

          <form onSubmit={handleSetNewPassword} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">סיסמה חדשה</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">אימות סיסמה</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'עדכון סיסמה'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500/20">
      <AnimatePresence>
        {alertBanner && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-4 left-4 right-4 md:left-auto md:right-4 z-50 p-4 rounded-xl shadow-lg border text-sm max-w-md ${
              alertBanner.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
            dir="rtl"
          >
            <div className="flex items-center gap-2 font-bold">
              <span>{alertBanner.type === 'error' ? '⚠️ שגיאה:' : '✓ פעולה בוצעה:'}</span>
              <p>{alertBanner.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {currentRole === 'admin' && (
        <div className="bg-white border-b border-slate-200 text-xs px-4 py-2.5 flex justify-between items-center z-40 sticky top-0 shadow-xs" dir="rtl">
          <span className="font-bold text-indigo-600 flex items-center gap-1.5">
            <UserCog className="w-3.5 h-3.5" />
            פאנל ניהול - גוטליב את ביטון
          </span>
          <button
            onClick={handleLogout}
            className="px-2.5 py-1 rounded bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-all font-bold text-[11px] border border-slate-200 flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" />
            יציאה
          </button>
        </div>
      )}

      <div className="flex-1">
        {currentRole === 'login' && (
          <div className="min-h-[85vh] flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 md:p-8 w-full max-w-md space-y-6 text-slate-900"
            >
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-white text-2xl mx-auto shadow-sm">
                  גב
                </div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">גוטליב את ביטון</h2>
                <p className="text-xs text-slate-500">משרד רואי חשבון • פורטל הגשת מסמכים חכם</p>
              </div>

              {!showStaffLogin ? (
                <>
                  {loginError && (
                    <div className="bg-rose-50 text-rose-800 border border-rose-200 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <form onSubmit={handleClientLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">הזן קוד גישה אישי לפרויקט</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                        <input
                          type="text"
                          required
                          placeholder="לדוגמה: GB-1234"
                          value={accessCodeInput}
                          onChange={(e) => setAccessCodeInput(e.target.value)}
                          className="w-full bg-slate-50 text-slate-900 rounded-xl pr-10 pl-4 py-3 border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center font-mono font-bold uppercase tracking-wider"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-98 cursor-pointer"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>
                          <span>כניסה למערכת המעקב</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <button
                    onClick={() => setShowStaffLogin(true)}
                    className="w-full text-center text-[11px] text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    כניסת צוות המשרד (רו"ח / אדמין)
                  </button>
                </>
              ) : showForgotPassword ? (
                <>
                  {forgotStatus && (
                    <div
                      className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
                        forgotStatus.type === 'error'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      <span>{forgotStatus.message}</span>
                    </div>
                  )}

                  <form onSubmit={handleForgotPassword} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">אימייל</label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שליחת קישור לאיפוס סיסמה'}
                    </button>
                  </form>

                  <button
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotStatus(null);
                    }}
                    className="w-full text-center text-[11px] text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    חזרה לכניסת צוות
                  </button>
                </>
              ) : (
                <>
                  {staffLoginError && (
                    <div className="bg-rose-50 text-rose-800 border border-rose-200 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      <span>{staffLoginError}</span>
                    </div>
                  )}

                  <form onSubmit={handleStaffLogin} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">אימייל</label>
                      <input
                        type="email"
                        required
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">סיסמה</label>
                      <input
                        type="password"
                        required
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        className="w-full bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'כניסת צוות'}
                    </button>
                  </form>

                  <button
                    onClick={() => {
                      setForgotEmail(staffEmail);
                      setForgotStatus(null);
                      setShowForgotPassword(true);
                    }}
                    className="w-full text-center text-[11px] text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    שכחתי סיסמה
                  </button>

                  <button
                    onClick={() => setShowStaffLogin(false)}
                    className="w-full text-center text-[11px] text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    חזרה לכניסת לקוח
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}

        {currentRole === 'client' && loggedClient && (
          <ClientPortal
            client={loggedClient}
            project={projects.find((p) => p.id === loggedClient.projectId) || projects[0]}
            clientState={
              clientStates.find((s) => s.clientId === loggedClient.id && s.projectId === loggedClient.projectId) || {
                clientId: loggedClient.id,
                projectId: loggedClient.projectId,
                documents: {},
              }
            }
            onUpload={handleUploadFile}
            onSendToCpa={handleSendToCpa}
            onLogout={handleLogout}
          />
        )}

        {currentRole === 'admin' && (
          <AdminPanel
            projects={projects}
            clients={clients}
            clientStates={clientStates}
            notificationLogs={notificationLogs}
            clientContacts={clientContacts}
            staff={staff}
            onAddClient={handleAddClient}
            onUpdateClient={handleUpdateClient}
            onDeleteClient={handleDeleteClient}
            onImportClients={handleImportClients}
            onReviewFile={handleReviewFile}
            onDownloadFile={handleDownloadFile}
            onSendManualReminder={handleSendManualReminder}
            onSendBulkReminders={handleSendBulkReminders}
            onUpdateProjectSettings={handleUpdateProjectSettings}
            onExportData={handleExportData}
            onImportData={handleImportData}
            onImpersonate={handleImpersonate}
            onAddClientContact={handleAddClientContact}
            onUpdateClientContact={handleUpdateClientContact}
            onDeleteClientContact={handleDeleteClientContact}
            onAddStaff={handleAddStaff}
            onRemoveStaff={handleRemoveStaff}
            onResendAccessCodes={handleResendAccessCodes}
          />
        )}
      </div>
    </div>
  );
}

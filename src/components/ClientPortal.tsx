import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Upload, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  HelpCircle, 
  History, 
  ChevronDown, 
  ChevronUp, 
  Paperclip, 
  Calendar, 
  User, 
  LogOut,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { Client, Project, ClientProjectState, FileVersion, RequiredDocument } from '../types';

interface ClientPortalProps {
  client: Client;
  project: Project;
  clientState: ClientProjectState;
  onUpload: (documentId: string, file: File) => void;
  onSendToCpa: (clientId: string, projectId: string, comments: string) => void;
  onLogout: () => void;
}

export default function ClientPortal({
  client,
  project,
  clientState,
  onUpload,
  onSendToCpa,
  onLogout
}: ClientPortalProps) {
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [clientComments, setClientComments] = useState(clientState.comments || '');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleDrag = (e: React.DragEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveId(docId);
    } else if (e.type === "dragleave") {
      setDragActiveId(null);
    }
  };

  // ממפה סוגי קבצים מותרים (image/word/pdf) למחרוזת accept של input[type=file]
  const fileTypeAcceptMap: Record<string, string> = {
    image: 'image/*',
    word: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: '.pdf,application/pdf',
    excel: '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  const fileTypeLabels: Record<string, string> = { image: 'תמונה', word: 'Word', pdf: 'PDF', excel: 'Excel' };

  const getAllowedTypesLabel = (doc: RequiredDocument): string => {
    const types = doc.allowedFileTypes && doc.allowedFileTypes.length ? doc.allowedFileTypes : ['image', 'word', 'pdf', 'excel'];
    return types.map((t) => fileTypeLabels[t]).join(', ');
  };

  const getAcceptForDoc = (doc: RequiredDocument): string => {
    const types = doc.allowedFileTypes && doc.allowedFileTypes.length ? doc.allowedFileTypes : ['image', 'word', 'pdf', 'excel'];
    return types.map((t) => fileTypeAcceptMap[t]).join(',');
  };

  // בדיקה בפועל אם קובץ שנבחר תואם לאחד מסוגי הקבצים המותרים למסמך הזה
  const isFileTypeAllowed = (doc: RequiredDocument, file: File): boolean => {
    const types = doc.allowedFileTypes && doc.allowedFileTypes.length ? doc.allowedFileTypes : ['image', 'word', 'pdf', 'excel'];
    const name = file.name.toLowerCase();
    const mime = file.type.toLowerCase();
    return types.some((t) => {
      if (t === 'image') return mime.startsWith('image/');
      if (t === 'pdf') return mime === 'application/pdf' || name.endsWith('.pdf');
      if (t === 'word') return (
        mime === 'application/msword' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        name.endsWith('.doc') ||
        name.endsWith('.docx')
      );
      if (t === 'excel') return (
        mime === 'application/vnd.ms-excel' ||
        mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        name.endsWith('.xls') ||
        name.endsWith('.xlsx')
      );
      return false;
    });
  };

  const handleDrop = (e: React.DragEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveId(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(docId, e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(docId, e.target.files[0]);
    }
  };

  const handleFileSelected = (docId: string, file: File) => {
    const doc = project.requiredDocuments.find((d) => d.id === docId);
    if (doc && !isFileTypeAllowed(doc, file)) {
      const types = doc.allowedFileTypes && doc.allowedFileTypes.length ? doc.allowedFileTypes : ['image', 'word', 'pdf', 'excel'];
      alert(`סוג הקובץ אינו נתמך למסמך "${doc.name}". סוגים מותרים: ${types.map((t) => fileTypeLabels[t]).join(', ')}.`);
      return;
    }
    setUploadingDocId(docId);
    // Simulate a brief upload progress
    setTimeout(() => {
      onUpload(docId, file);
      setUploadingDocId(null);
    }, 1200);
  };

  const triggerFileInput = (docId: string) => {
    fileInputRefs.current[docId]?.click();
  };

  // Calculate missing vs uploaded counts
  const totalDocs = project.requiredDocuments.length;
  const statusCounts = project.requiredDocuments.reduce((acc, doc) => {
    const versions = clientState.documents[doc.id] || [];
    const latest = versions[0];
    const status = latest ? latest.status : 'missing';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { approved: 0, pending: 0, rejected: 0, draft: 0, missing: 0 } as Record<string, number>);

  const isCompleted = statusCounts.approved === totalDocs;

  // Calculate missing required docs (required by project and either completely missing or currently in rejected status with no draft correction)
  const missingRequiredDocs = project.requiredDocuments.filter(doc => {
    if (!doc.isRequired) return false;
    const versions = clientState.documents[doc.id] || [];
    if (versions.length === 0) return true;
    const latest = versions[0];
    return latest.status === 'rejected';
  });

  const draftCount = Object.values(clientState.documents).reduce((count, versions) => {
    const latest = versions[0];
    return count + (latest && latest.status === 'draft' ? 1 : 0);
  }, 0);

  const handleSubmitAll = () => {
    onSendToCpa(client.id, project.id, clientComments);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans" dir="rtl">
      {/* Client Header bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="גוטליב את ביטון"
              className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200 p-0.5"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">גוטליב את ביטון רואי חשבון</h1>
              <p className="text-xs text-slate-500">פורטל לקוחות חכם למעקב והעלאת מסמכים</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 w-full sm:w-auto justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">{client.name}</p>
                <p className="text-xs text-slate-500">
                  סוג לקוח: {client.role === 'manager' ? 'מנהל (מקבלי התראות)' : 'לקוח רגיל'}
                </p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="mr-4 p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              title="התנתק"
              id="btn-client-logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Project Header Alert Banner */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden mb-8"
        >
          <div className="bg-indigo-50 border-b border-indigo-100 text-indigo-950 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-indigo-600" />
              <h2 className="text-lg font-bold">פרויקט פעיל: {project.name}</h2>
            </div>
            <span className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-semibold">
              מועד הגשה: 26.07.2026
            </span>
          </div>

          <div className="p-6 bg-white border-b border-slate-100">
            {/* The exact text requested by the user */}
            <div className="text-slate-800 leading-relaxed text-sm md:text-base space-y-4 whitespace-pre-line text-justify">
              <p className="font-bold text-slate-900 text-lg">לקוחות יקרים שלום רב,</p>
              
              <p>הינה הסתיימה שנת ניצנים תשפ"ו,</p>
              
              <p>על מנת שנוכל לתת לכם את השירות המיטבי ולבצע את מירב הבדיקות והדיוקים, יש להקפיד על ההנחיות הבאות לטובת סגירת דוחות ניצנים תשפ"ו:</p>
              
              <p className="text-rose-600 font-bold border-r-4 border-rose-500 pr-3 my-2">
                אנא שלחו לנו את החומרים המפורטים להלן לא יאוחר מתאריך 26.7.2026, לא נוכל להתחייב להגיש דוח בזמן, ללקוח שלא יעמוד בלוח הזמנים שנקבע.
              </p>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-xs space-y-2">
                <p className="font-bold text-slate-900">מה צריך לעשות כעת:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-700 pr-1">
                  <li>חשוב כבר בימים אלו לסגור את מערכת הנה"ח, לדבר עם ספקים שטרם שלחו חשבוניות ולוודא שלכל עובד במערכת השכר – משוייך תפקיד (כמפורט בסעיף 1).</li>
                  <li>לוודא שסוגרים את ההתחשבנות עם כלל העובדים – כולל תמורת חופשה, הבראה וכו'.. כבר בשכר 7.26.</li>
                  <li>לשלוח את כלל הנתונים כמופיע בהמשך באופן מסודר.</li>
                </ol>
              </div>

              <p className="bg-indigo-50/50 text-indigo-950 p-4 rounded-lg border border-indigo-100 font-medium">
                ⚠️ <strong className="font-bold">שימו לב:</strong> אין לשלוח חומרים ללא קיום פגישת תיאום בין מנהלת הכספים לרכזת הפעילות - יש לוודא שכל ההוצאות ששייכות לפעילות ניצנים תשפ"ו רשומות במערכת הנה"ח והשכר במלואם!!
              </p>

              <p>מזכירה לכם שהשנה, תוקצבו עד כה ב-80% מהזכאות, 20% משרד החינוך ישלים לאחר הגשת דוח ביצוע זה.</p>
              
              <p>בנוסף, כיון שמדובר על ימי הקיץ, וישנם מנהלי כספים בחופשה, אנא שלחו לנו יחד עם החומרים את התאריכים בהם אתם צפויים לצאת לחופשה, ע"מ שנתעדף דוחות באופן מיטבי. אנא היערכו בהתאם ושתפו אותנו בזמן.</p>
              
              <p className="font-bold text-slate-950">חשוב להדגיש שיש ליצור הפרדה מלאה בין נתוני גנים לבתי ספר.</p>
            </div>
          </div>
        </motion.div>

        {/* Progress Tracker Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">מאושרים</p>
              <p className="text-xl font-bold text-emerald-600">{statusCounts.approved} / {totalDocs}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">בבדיקת רו"ח</p>
              <p className="text-xl font-bold text-indigo-600">{statusCounts.pending}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">טיוטה (טרם נשלח)</p>
              <p className="text-xl font-bold text-amber-600">{statusCounts.draft || 0}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">דורש תיקון</p>
              <p className="text-xl font-bold text-rose-600">{statusCounts.rejected}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">טרם הועלו</p>
              <p className="text-xl font-bold text-slate-700">{statusCounts.missing}</p>
            </div>
          </div>
        </div>

        {/* Documents Checklist & Upload Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-lg">רשימת מסמכים להגשה</h3>
            <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded font-mono">
              מזהה לקוח: {client.accessCode}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {project.requiredDocuments.map((doc, idx) => {
              const versions = clientState.documents[doc.id] || [];
              const latestFile = versions[0];
              const isExpanded = expandedDocId === doc.id;
              const isDragActive = dragActiveId === doc.id;

              // Determine status
              let statusText = 'טרם הועלה';
              let statusColor = 'bg-slate-100 text-slate-600 border-slate-200';
              let statusIcon = <FileText className="w-3.5 h-3.5" />;

              if (latestFile) {
                if (latestFile.status === 'approved') {
                  statusText = 'מאושר';
                  statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  statusIcon = <CheckCircle className="w-3.5 h-3.5" />;
                } else if (latestFile.status === 'draft') {
                  statusText = 'טיוטה';
                  statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
                  statusIcon = <FileText className="w-3.5 h-3.5" />;
                } else if (latestFile.status === 'pending') {
                  statusText = 'בבדיקה';
                  statusColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                  statusIcon = <Clock className="w-3.5 h-3.5" />;
                } else if (latestFile.status === 'rejected') {
                  statusText = 'לא תקין';
                  statusColor = 'bg-rose-50 text-rose-700 border-rose-200';
                  statusIcon = <AlertTriangle className="w-3.5 h-3.5" />;
                }
              }

              return (
                <div
                  key={doc.id}
                  onDragEnter={(e) => handleDrag(e, doc.id)}
                  onDragOver={(e) => handleDrag(e, doc.id)}
                  onDragLeave={(e) => handleDrag(e, doc.id)}
                  onDrop={(e) => handleDrop(e, doc.id)}
                  className={`flex flex-col gap-2 rounded-xl border p-4 transition-colors ${
                    isDragActive
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                      : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm'
                  }`}
                  id={`doc-row-${doc.id}`}
                >
                  {/* Header: index + name + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded flex-shrink-0">
                        {idx + 1}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight truncate" title={doc.name}>
                        {doc.name}
                      </h4>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${statusColor}`}>
                      {statusIcon}
                      {statusText}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {doc.isRequired ? (
                      <span className="text-rose-600 text-[10px] font-semibold bg-rose-50 px-1.5 py-0.5 rounded">
                        * חובה
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                        רשות
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">{getAllowedTypesLabel(doc)}</span>
                  </div>

                  {doc.description && (
                    <p className="text-[11px] text-slate-500">{doc.description}</p>
                  )}

                  {/* CPA Feedback alert if rejected */}
                  {latestFile && latestFile.status === 'rejected' && (
                    <div className="bg-rose-50 border-r-4 border-rose-500 p-2 rounded-l-lg text-rose-900 text-[11px] flex gap-1.5 items-start">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">הערת רו"ח - נא לתקן ולהעלות קובץ חדש:</p>
                        <p className="mt-0.5 text-rose-800">{latestFile.reviewComment || 'נא לבדוק את תקינות הקובץ.'}</p>
                      </div>
                    </div>
                  )}

                  {/* CPA Approved Feedback if exists */}
                  {latestFile && latestFile.status === 'approved' && latestFile.reviewComment && (
                    <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                      ✓ {latestFile.reviewComment}
                    </p>
                  )}

                  {/* Latest file info */}
                  {latestFile && (
                    <p className="text-[11px] text-slate-500 truncate flex items-center gap-1" title={latestFile.fileName}>
                      <Paperclip className="w-3 h-3 flex-shrink-0" />
                      {latestFile.fileName} • גרסה {latestFile.version}
                    </p>
                  )}

                  {/* Upload row */}
                  <div className="mt-auto flex items-center gap-2 pt-1">
                    {uploadingDocId === doc.id ? (
                      <div className="flex-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 text-xs flex items-center justify-center gap-2">
                        <svg className="animate-spin h-3.5 w-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        מעלה...
                      </div>
                    ) : (
                      <button
                        onClick={() => triggerFileInput(doc.id)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                        id={`btn-upload-${doc.id}`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {latestFile ? 'גרסה חדשה' : 'העלאת קובץ'}
                      </button>
                    )}

                    {versions.length > 0 && (
                      <button
                        onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
                        title="היסטוריית גרסאות"
                        id={`btn-history-${doc.id}`}
                      >
                        <History className="w-3.5 h-3.5" />
                        <span className="text-[10px] bg-slate-200 px-1 py-0.5 rounded font-bold">{versions.length}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 text-center">גררו קובץ לכאן או לחצו על הכפתור</p>

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    accept={getAcceptForDoc(doc)}
                    ref={(el) => { fileInputRefs.current[doc.id] = el; }}
                    onChange={(e) => handleFileChange(e, doc.id)}
                    className="hidden"
                  />

                  {/* File History Expandable Section */}
                  <AnimatePresence>
                    {isExpanded && versions.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-slate-50 rounded-lg p-3 border border-slate-200 overflow-hidden"
                      >
                        <h5 className="font-bold text-[10px] text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                          <History className="w-3 h-3" />
                          היסטוריית גרסאות:
                        </h5>
                        <div className="space-y-1.5">
                          {versions.map((ver, vIdx) => (
                            <div
                              key={ver.id}
                              className={`flex justify-between items-center p-2 rounded border text-[11px] ${
                                vIdx === 0 ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-100/50 border-slate-200 opacity-75'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Paperclip className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-800 truncate" title={ver.fileName}>
                                    {ver.fileName}
                                  </p>
                                  <p className="text-[9px] text-slate-400">
                                    {ver.uploadedAt}
                                  </p>
                                </div>
                              </div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${
                                ver.status === 'approved'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : ver.status === 'draft'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : ver.status === 'rejected'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}>
                                {ver.status === 'approved' ? 'מאושר' : ver.status === 'draft' ? 'טיוטה' : ver.status === 'rejected' ? 'לא תקין' : 'בבדיקה'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* CPA Comments & Submission Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8 p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Paperclip className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-lg">שליחת חומרים והערות לרואה החשבון</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Inbox Comment Box */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">
                ✍️ תיבת הערות והבהרות לרו"ח (אינבוקס):
              </label>
              <p className="text-xs text-slate-500">
                תוכלו לכתוב כאן הבהרות לגבי הקבצים שהעליתם, תאריכי החופשות שלכם או כל מידע אחר שחשוב שרואה החשבון יראה בעת הבדיקה.
              </p>
              <textarea
                rows={5}
                value={clientComments}
                onChange={(e) => setClientComments(e.target.value)}
                placeholder="הקלד כאן את הערותיך או עדכונים מיוחדים..."
                className="w-full bg-slate-50 text-slate-900 rounded-lg p-3 border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                id="client-comments-textarea"
              />
            </div>

            {/* Validation Panel & Send Button */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-800">📋 סטטוס הגשה ואימות:</h4>
                
                {/* Statistics / Validation Details */}
                <div className="text-xs space-y-2 text-slate-600">
                  <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-100">
                    <span>מסמכים בטיוטה (ממתינים לשליחה):</span>
                    <span className="font-bold text-amber-600">{draftCount}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-100">
                    <span>מסמכים שכבר נשלחו או אושרו:</span>
                    <span className="font-bold text-indigo-600">{statusCounts.pending + statusCounts.approved}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-100">
                    <span>סעיפי חובה שטרם הועלו להם קבצים:</span>
                    <span className={`font-bold ${missingRequiredDocs.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {missingRequiredDocs.length}
                    </span>
                  </div>
                </div>

                {/* Validation Warnings */}
                {missingRequiredDocs.length > 0 ? (
                  <div className="bg-amber-50 border-r-4 border-amber-500 p-3 rounded-l text-xs text-amber-900 flex gap-1.5 items-start">
                    <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">שים לב: חסרים קבצים עבור סעיפי חובה הבאים:</p>
                      <ul className="list-disc list-inside mt-1 font-medium pr-1">
                        {missingRequiredDocs.map(doc => (
                          <li key={doc.id}>{doc.name}</li>
                        ))}
                      </ul>
                      <p className="mt-1 text-[10px] text-amber-700 font-bold">תוכל לשלוח כעת, אך מומלץ להשלים את כלל חובות ההגשה.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border-r-4 border-emerald-500 p-3 rounded-l text-xs text-emerald-950 flex gap-1.5 items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <p className="font-bold">כלל קבצי החובה הועלו בהצלחה! ניתן לשלוח את החומרים כעת.</p>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={handleSubmitAll}
                disabled={draftCount === 0 && clientComments === (clientState.comments || '')}
                className={`w-full font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all mt-4 cursor-pointer ${
                  draftCount > 0 || clientComments !== (clientState.comments || '')
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                id="btn-submit-to-cpa"
              >
                <Upload className="w-4 h-4" />
                <span>שלח הכל לרואה החשבון ({draftCount} קבצים בטיוטה)</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white text-slate-500 py-8 border-t border-slate-200 mt-12 text-center text-xs">
        <div className="max-w-6xl mx-auto px-4 space-y-2">
          <p className="font-bold text-slate-700">גוטליב את ביטון רואי חשבון © 2026</p>
          <p>המערכת מאובטחת ועומדת בתקני אבטחת מידע קפדניים. כלל הגרסאות נשמרות לצרכי מעקב וביקורת.</p>
        </div>
      </footer>
    </div>
  );
}

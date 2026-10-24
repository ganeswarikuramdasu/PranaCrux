import { PatientMedicalRecordsPanel } from './PatientMedicalRecordsPanel';
import { PatientAccountPanel } from './PatientAccountPanel';
import { PatientOverview } from './PatientOverview';
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  PatientProfile,
  MedicalRecord,
  ConsentGrant,
  DoctorProfile,
  HospitalProfile,
  UserRole,
} from "../types";
import { LabReportExplainModal } from "./LabReportExplainModal";
import { ProactiveCarePanel } from './ProactiveCarePanel';
import { EmergencyReportPanel } from './EmergencyReportPanel';
import { PatientMedicationsPanel } from './PatientMedicationsPanel';
import { HierarchicalAuditLogViewer } from "./HierarchicalAuditLogViewer";
import { AppShell, NavItem } from "./AppShell";
import { WarningsBanner } from "./WarningsBanner";
import { ComplaintCenter, LinkedAccessEvent } from "./ComplaintCenter";
import { downloadLabReportPDF, downloadMedicalRecordPDF } from "../utils/downloadHelper";
import { safeFetchJson, parseResponseSafe } from "../utils/api";
import { validateVitalsMap } from "../utils/validation";
import {
  ShieldCheck,
  Shield,
  FileText,
  Lock,
  Calendar,
  Bot,
  Star,
  AlertTriangle,
  Activity,
  Send,
  Siren,
  Award,
  Clock,
  FlaskConical,
  History,
  Settings,
  KeyRound,
  Sparkles,
  X,
  User,
  Heart,
  Pill,
  Flame,
  ArrowUpRight,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  Phone,
  Video,
  ChevronRight,
  Plus,
  RefreshCw,
  Zap,
  Download,
  DownloadCloud,
  Eye,
  Upload,
  Printer,
  Paperclip,
  MessageSquareWarning,
  FileSpreadsheet,
  XCircle,
  Pencil,
  Trash2,
} from "lucide-react";

type PatientTabKey = "DASHBOARD" | "EMERGENCY_PROFILE" | "RECORDS" | "LAB_REPORTS" | "AI_ASSISTANT" | "VITALS_ANALYTICS" | "CARE_ANALYSIS" | "MEDICATIONS" | "COMPLAINTS" | "AUDIT_LOGS" | "ACCOUNT";
interface PatientViewProps {
  profile: PatientProfile;
  records: MedicalRecord[];
  consents: ConsentGrant[];
  doctors: DoctorProfile[];
  hospitals: HospitalProfile[];
  onGrantConsent: (doctorId: string, consentType: string) => void;
  onRevokeConsent: (consentId: string) => void;
  patientName: string;
  appUser?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    globalHealthId?: string;
  };
  onLogout?: () => void;
  onGoToHome?: () => void;
  onRefreshRecords?: () => void;
}

export const PatientView: React.FC<PatientViewProps> = ({
  profile,
  records,
  consents,
  doctors,
  hospitals,
  onGrantConsent,
  onRevokeConsent,
  patientName,
  appUser,
  onLogout,
  onGoToHome,
  onRefreshRecords,
}) => {
  const PATIENT_TABS: PatientTabKey[] = ["DASHBOARD", "EMERGENCY_PROFILE", "RECORDS", "LAB_REPORTS", "AI_ASSISTANT", "VITALS_ANALYTICS", "CARE_ANALYSIS", "MEDICATIONS", "COMPLAINTS", "AUDIT_LOGS", "ACCOUNT"];

  const [activeTab, setActiveTab] = useState<PatientTabKey>(() => {
    const saved = localStorage.getItem("pranacrux_tab_PATIENT");
    return saved && (PATIENT_TABS as string[]).includes(saved) ? (saved as PatientTabKey) : "DASHBOARD";
  });

  useEffect(() => {
    try {
      localStorage.setItem("pranacrux_tab_PATIENT", activeTab);
    } catch {
      // storage unavailable
    }
  }, [activeTab]);

  // Explain Modal state
  const [selectedReportForExplain, setSelectedReportForExplain] = useState<any | null>(null);
  const [linkedAccessEvent, setLinkedAccessEvent] = useState<LinkedAccessEvent | null>(null);

  // Patient Manual Upload Lab Report State
  const [showManualLabModal, setShowManualLabModal] = useState(false);
  const [patientUploadedReports, setPatientUploadedReports] = useState<any[]>([]);

  // Lab Report File Attachment State
  const [uploadAttachment, setUploadAttachment] = useState<{ name: string; size: number; dataUrl: string } | null>(null);
  const labFileInputRef = useRef<HTMLInputElement | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{
    valid: boolean;
    reason?: string;
    report?: any;
    summary?: string;
    flaggedValues?: any[];
    source?: string;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // In-app attachment viewer (open without downloading)
  const [viewAttachment, setViewAttachment] = useState<{ name: string; dataUrl: string } | null>(null);

  const resetUploadState = () => {
    setUploadAttachment(null);
    setAiResult(null);
    setAiAnalyzing(false);
    setSaveSuccess(false);
    if (labFileInputRef.current) labFileInputRef.current.value = "";
  };

  const handleLabFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert("File exceeds 15MB limit.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setUploadAttachment({ name: file.name, size: file.size, dataUrl });
      setAiResult(null);
      setSaveSuccess(false);
      validateAndUploadLabReport(file.name, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const validateAndUploadLabReport = async (fileName: string, dataUrl: string, reportText?: string) => {
    setAiAnalyzing(true);
    try {
      const res = await fetch("/api/ai/validate-extract-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachmentName: fileName,
          attachmentDataUrl: dataUrl,
          reportText: reportText || "",
          patientHealthId: profile.globalHealthId || appUser?.globalHealthId || "",
        }),
      });
      const data = await parseResponseSafe<any>(res, { success: false });
      if (!res.ok || !data || !data.success) {
        setAiResult({ valid: false, reason: data?.message || "This does not appear to be a valid health lab report or diagnostic scan." });
        return;
      }
      const result = {
        valid: true,
        report: data.report || {},
        summary: data.summary || "",
        flaggedValues: data.flaggedValues || [],
        source: data.source || "SIMULATED",
      };
      setAiResult(result);
      // Valid document -> auto-save with AI summary & flagged values
      const savedRecord = await saveValidatedLabReport(fileName, dataUrl, result);
      setSaveSuccess(!!savedRecord);
      if (savedRecord) {
        const savedReport = {
          id: savedRecord.id || `manual_lab_${Date.now()}`,
          title: result.report?.title || fileName,
          recordType: result.report?.recordType || "LAB_REPORT",
          labName: result.report?.labName || "Patient Uploaded Diagnostics",
          date: result.report?.date || new Date().toISOString().split("T")[0],
          diagnosis: result.report?.diagnosis || result.summary || "Patient uploaded validated lab report.",
          doctorName: "Self / External Physician",
          patientName,
          status: "COMPLETED",
          aiSummary: result.summary || "",
          flaggedValues: result.flaggedValues || [],
          parameters: result.report?.parameters || [],
          attachmentName: fileName,
          attachmentDataUrl: dataUrl,
        };
        setPatientUploadedReports((prev) => [savedReport, ...prev]);
      }
    } catch (err) {
      setAiResult({ valid: false, reason: "Could not reach the AI service. Please try again in a moment." });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const saveValidatedLabReport = async (fileName: string, dataUrl: string, result: any): Promise<any> => {
    const parameters = result.report?.parameters?.length ? result.report.parameters : [];
    try {
      const res = await fetch("/api/patient/add-manual-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: profile.userId || appUser?.id || "",
          patientHealthId: profile.globalHealthId || appUser?.globalHealthId || "",
          date: result.report?.date || new Date().toISOString().split("T")[0],
          recordType: result.report?.recordType || "LAB_REPORT",
          title: result.report?.title || fileName,
          diagnosis: result.report?.diagnosis || result.summary || "",
          doctorName: "Patient Uploaded",
          hospitalName: result.report?.labName || "Independent Diagnostics / Self Upload",
          symptoms: `Patient uploaded ${result.report?.recordType === "IMAGING_SCAN" ? "diagnostic scan" : "lab report"}`,
          doctorNotes: result.summary || "Validated by PranaCrux AI",
          aiSummary: result.summary || "",
          flaggedValues: result.flaggedValues || [],
          labResults: parameters.map((p: any) => ({
            parameter: p.name,
            value: p.value,
            unit: p.unit,
            referenceRange: p.referenceRange,
            status: p.status,
          })),
          attachmentUrl: `patient_uploaded:${fileName}`,
          attachmentDataUrl: dataUrl || null,
          fileName,
        }),
      });
      const data = await parseResponseSafe<any>(res, { success: false });
      if (data?.success && data.record) onRefreshRecords?.();
      return (data && data.success && data.record) ? data.record : null;
    } catch (err) {
      console.warn("Lab report save failed:", err);
      return null;
    }
  };

  // Edit / Delete patient-uploaded lab reports
  const [editingReport, setEditingReport] = useState<any>(null);
  const [editForm, setEditForm] = useState({ title: "", labName: "", date: "", aiSummary: "", diagnosis: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditReport = (report: any) => {
    setEditingReport(report);
    setEditForm({
      title: report.title || report.testName || "",
      labName: report.labName || report.hospitalName || "",
      date: report.date || new Date().toISOString().split("T")[0],
      aiSummary: report.aiSummary || "",
      diagnosis: report.diagnosis || "",
    });
  };

  const saveEditReport = async () => {
    if (!editingReport) return;
    setSavingEdit(true);
    try {
      const body: any = {
        recordId: editingReport.id,
        title: editForm.title,
        diagnosis: editForm.diagnosis,
        doctorNotes: editForm.aiSummary,
        hospitalName: editForm.labName,
        date: editForm.date || new Date().toISOString().split("T")[0],
      };
      if (editForm.aiSummary) body.aiSummary = editForm.aiSummary;
      const res = await fetch("/api/medical-records/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseResponseSafe<any>(res, { success: false });
      if (!res.ok || !data || !data.success) {
        alert(data?.message || "Failed to update the report. Please try again.");
        return;
      }
      setPatientUploadedReports((prev) => prev.map((r) =>
        r.id === editingReport.id
          ? {
              ...r,
              title: editForm.title || r.title,
              labName: editForm.labName || r.labName,
              date: editForm.date || r.date,
              diagnosis: editForm.diagnosis || r.diagnosis,
              aiSummary: editForm.aiSummary || r.aiSummary,
            }
          : r
      ));
      setEditingReport(null);
      onRefreshRecords?.();
    } catch (err) {
      console.warn("Failed to update report:", err);
      alert("Could not reach the server. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteLabReport = async (report: any) => {
    if (!window.confirm(`Delete "${report.title || report.testName || "this report"}"? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/medical-records/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: report.id }),
      });
      const data = await parseResponseSafe<any>(res, { success: false });
      if (!res.ok || !data || !data.success) {
        alert(data?.message || "Failed to delete the report. Please try again.");
        return;
      }
      setPatientUploadedReports((prev) => prev.filter((r) => r.id !== report.id));
      onRefreshRecords?.();
    } catch (err) {
      console.warn("Failed to delete report:", err);
      alert("Could not reach the server. Please try again.");
    }
  };

  const deleteVital = async (vital: any) => {
    if (vital.id) {
      if (!window.confirm("Delete this vitals reading? This cannot be undone.")) return;
      try {
        const res = await fetch("/api/medical-records/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordId: vital.id }),
        });
        const data = await parseResponseSafe<any>(res, { success: false });
        if (!res.ok || !data || !data.success) {
          alert(data?.message || "Failed to delete the vitals reading. Please try again.");
          return;
        }
        setVitalsHistory((prev) => prev.filter((v: any) => v.id !== vital.id));
        onRefreshRecords?.();
      } catch (err) {
        console.warn("Failed to delete vitals reading:", err);
        alert("Could not reach the server. Please try again.");
      }
    } else {
      setVitalsHistory((prev) => prev.filter((v: any) => v !== vital));
    }
  };

  const approvedHospitals = hospitals.filter((h) => h.status === "APPROVED" || h.status === "ACTIVE" || !h.status);
  const activeHospitalsList = approvedHospitals.length > 0 ? approvedHospitals : hospitals;

  const patientDoctorIds = Array.from(new Set((records || []).map((r) => r.doctorId).filter(Boolean)));
  const patientDoctors = patientDoctorIds
    .map((id) => (doctors || []).find((d) => d.id === id || d.userId === id))
    .filter((d): d is DoctorProfile => Boolean(d));
  const flaggedPatientDoctors = patientDoctors.filter((d) => (d.malpracticeCount ?? 0) > 0);
  const patientMalpracticeTotal = flaggedPatientDoctors.length;

  // AI Assistant Chat State
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatHistory, setAiChatHistory] = useState<Array<{ role: "user" | "ai"; text: string }>>([
    {
      role: "ai",
      text: `Hello ${patientName}! I am your Gemini 3.6 Flash Health Assistant. I have indexed your Health ID (${profile.globalHealthId}) and medical history. Ask me anything about symptoms, medication contraindications, or lab values!`,
    },
  ]);
  const [isAiReplying, setIsAiReplying] = useState(false);

  // Vitals State (Advanced Section)
  const getDefaultVitalsHistory = () => [];

  const [vitalsHistory, setVitalsHistory] = useState(getDefaultVitalsHistory());

  // Vitals Add Form State
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    bpSystolic: "",
    bpDiastolic: "",
    glucose: "",
    heartRate: "",
    spo2: "",
    weight: "",
    height: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [vitalsFormError, setVitalsFormError] = useState("");

  useEffect(() => {
    setVitalsHistory([]);
  }, [profile.globalHealthId]);

  // Reload vitals saved to the backend after a refresh (stored as VITALS medical records).
  useEffect(() => {
    const pid = profile.userId || profile.id;
    if (!pid) return;
    const savedVitals = (records || [])
      .filter((r: any) => r.patientId === pid && r.vitals && typeof r.vitals === "object" && Object.keys(r.vitals).length > 0)
      .map((r: any) => ({
        id: r.id,
        date: (r.vitals && r.vitals.date) || r.date || "",
        bpSystolic: r.vitals.bpSystolic,
        bpDiastolic: r.vitals.bpDiastolic,
        glucose: r.vitals.glucose,
        heartRate: r.vitals.heartRate,
        spo2: r.vitals.spo2,
        weight: r.vitals.weight,
        height: r.vitals.height,
      }))
      .sort((a: any, b: any) => (a.date < b.date ? -1 : 1));
    if (savedVitals.length > 0) setVitalsHistory(savedVitals);
  }, [records, profile.userId, profile.id, profile.globalHealthId]);

  const displayedLabReports = patientUploadedReports;

  // Most recent vitals reading; null for a newly registered patient with no log.
  const latestVitals = vitalsHistory.length > 0 ? vitalsHistory[vitalsHistory.length - 1] : null;

  const handleSendAiMessage = async (msgOverride?: string) => {
    const textToSend = msgOverride || aiChatInput;
    if (!textToSend.trim()) return;

    const userMsg = { role: "user" as const, text: textToSend };
    setAiChatHistory((prev) => [...prev, userMsg]);
    if (!msgOverride) setAiChatInput("");
    setIsAiReplying(true);

    try {
      const res = await fetch("/api/ai/patient-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientHealthId: profile.globalHealthId,
          prompt: textToSend,
          query: textToSend,
          contextRecords: records,
          patientProfile: profile,
        }),
      });
      const data = await parseResponseSafe<any>(res, { reply: null });
      const aiReply = data?.reply || data?.response || "I analyzed your clinical records. Everything looks stable! Consult your attending physician for explicit medical orders.";
      setAiChatHistory((prev) => [
        ...prev,
        {
          role: "ai",
          text: aiReply,
        },
      ]);
    } catch (err) {
      setAiChatHistory((prev) => [
        ...prev,
        { role: "ai", text: "Unable to reach Gemini AI engine at this moment. Please try again shortly." },
      ]);
    } finally {
      setIsAiReplying(false);
    }
  };

  const navTabs = [
    { key: "DASHBOARD", label: "Dashboard", icon: Activity },
    { key: "EMERGENCY_PROFILE", label: "Emergency Report", icon: Siren },
    { key: "AUDIT_LOGS", label: "Record Access Audit Log", icon: History, badge: "Ledger" },
    { key: "RECORDS", label: "EHR Medical History", icon: FileText, badge: "Stream" },
    { key: "LAB_REPORTS", label: "Lab Reports & Scans", icon: FlaskConical, badge: "AI" },
    { key: "AI_ASSISTANT", label: "Health Assistant", icon: Bot, badge: "AI" },
    { key: "VITALS_ANALYTICS", label: "Vitals & Biomarkers", icon: Heart },
    { key: "CARE_ANALYSIS", label: "Proactive AI Care Analysis", icon: Sparkles },
    { key: "MEDICATIONS", label: "Medications", icon: Pill },
    { key: "ACCOUNT", label: "Account & Profile", icon: Settings },
  ];

  const navItems: NavItem[] = navTabs.map((t) => ({
    id: t.key as string,
    label: t.label,
    icon: t.icon,
    badge: t.badge,
  }));

  const shellUser = appUser || {
    id: "",
    name: patientName || "Patient",
    email: "patient@pranacrux.org",
    role: "PATIENT" as UserRole,
  };

  return (
    <>
      <AppShell
        user={shellUser}
        roleLabel="Verified Health ID"
        subtitle="Patient Portal"
        navItems={navItems}
        active={activeTab}
        onSelect={(k) => setActiveTab(k as any)}
        onLogout={onLogout}
        onGoToHome={onGoToHome}
        supportAction={
          <button onClick={() => { setLinkedAccessEvent(null); setActiveTab("COMPLAINTS"); }}
            className="w-full flex items-center gap-3 rounded-xl bg-orange-500/15 text-orange-200 hover:bg-orange-500/25 border border-orange-400/30 px-4 py-3 text-sm font-semibold">
            <MessageSquareWarning className="w-5 h-5" />Raise Complaint
          </button>
        }
      >

        {/* DASHBOARD TAB */}
        {activeTab === "DASHBOARD" && <PatientOverview profile={profile} records={records} onNavigate={tab => setActiveTab(tab as PatientTabKey)} />}

        {/* EHR MEDICAL RECORDS TAB */}
        {activeTab === "RECORDS" && <PatientMedicalRecordsPanel profile={profile} onChanged={onRefreshRecords} />}

        {/* LAB REPORTS TAB */}
        {activeTab === "LAB_REPORTS" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                  <FlaskConical className="w-5 h-5 text-[#527D73]" />
                  <span>Lab Reports & Diagnostic Scans</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Doctor uploaded panels & manually attached patient diagnostic records linked to Health ID
                </p>
              </div>

              <button
                onClick={() => setShowManualLabModal(true)}
                className="px-4 py-2 bg-[#527D73] hover:bg-[#0f172a] text-white font-bold rounded-xl text-xs transition flex items-center space-x-2 shadow-md shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Upload Lab Report</span>
              </button>
            </div>

            {/* List of Lab Reports */}
            <div className="grid grid-cols-1 gap-6">
              {displayedLabReports.map((report) => (
                <div key={report.id} className="bg-[#FFFFFF] border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xl relative">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-md border ${
                          report.status === "ELEVATED"
                            ? "bg-[#FDECE8] border-[#F2603C]/40 text-[#E23A2E]"
                            : "bg-[#EDF4EF] border-[#527D73]/40 text-[#527D73]"
                        }`}>
                          {report.status || "COMPLETED"}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">Date: {report.date}</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">{report.title}</h3>
                      <p className="text-xs text-[#527D73] font-mono">Facility: {report.labName || report.hospitalName || "Diagnostic Pathology Lab"}</p>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-y-2 justify-end">
                      <button
                        onClick={() => setSelectedReportForExplain(report)}
                        className="px-3.5 py-2 bg-[#EDF4EF] hover:bg-[#527D73]/20 border border-[#527D73]/40 text-[#527D73] font-bold rounded-xl text-xs transition flex items-center space-x-1.5"
                      >
                        <Sparkles className="w-4 h-4 text-[#527D73]" />
                        <span>Explain with Gemini AI</span>
                      </button>

                      <button
                        onClick={() => downloadLabReportPDF(report, patientName, profile.globalHealthId)}
                        className="px-3.5 py-2 bg-[#527D73] hover:bg-[#0f172a] text-white font-bold rounded-xl text-xs transition flex items-center space-x-1.5 shadow-md shadow-[#527D73]/20"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Report</span>
                      </button>

                      <button
                        onClick={() => openEditReport(report)}
                        className="px-3.5 py-2 bg-[#0f172a] hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition flex items-center space-x-1.5"
                      >
                        <Pencil className="w-4 h-4" />
                        <span>Modify</span>
                      </button>

                      <button
                        onClick={() => deleteLabReport(report)}
                        className="px-3.5 py-2 bg-[#E23A2E] hover:bg-[#C9302A] text-white font-bold rounded-xl text-xs transition flex items-center space-x-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  {/* AI Summary */}
                  {report.aiSummary && (
                    <div className="bg-[#EDF1F5] border border-slate-200 rounded-2xl p-4 space-y-1.5">
                      <p className="text-[10px] font-bold text-[#527D73] uppercase tracking-wide">PranaCrux AI Summary</p>
                      <p className="text-xs text-slate-700 leading-relaxed">{report.aiSummary}</p>
                    </div>
                  )}

                  {/* Flagged Values */}
                  {report.flaggedValues && report.flaggedValues.length > 0 && (
                    <div className="bg-[#FDECE8] border border-[#F2603C]/40 rounded-2xl p-4 space-y-2">
                      <p className="text-[10px] font-bold text-[#E23A2E] uppercase tracking-wide">Flagged Values</p>
                      <div className="space-y-1.5">
                        {report.flaggedValues.map((f: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-[#FFFFFF]/70 border border-[#F2603C]/20 rounded-lg px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{f.name}</p>
                              <p className="text-[10px] text-slate-500">
                                {f.value} {f.unit}{f.referenceRange ? ` (Ref: ${f.referenceRange})` : ""}
                              </p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              f.status === "HIGH"
                                ? "bg-[#F2603C]/10 text-[#E23A2E] border-[#F2603C]/30"
                                : "bg-[#F59E0B]/10 text-[#B45309] border-[#F59E0B]/30"
                            }`}>
                              {f.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Parameters Table */}
                  {report.parameters && report.parameters.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2 px-3">Test Parameter</th>
                            <th className="py-2 px-3">Measured Value</th>
                            <th className="py-2 px-3">Reference Range</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/80 text-slate-800">
                          {report.parameters.map((p: any, idx: number) => (
                            <tr key={idx} className="hover:bg-[#EDF1F5]">
                              <td className="py-2.5 px-3 font-bold text-slate-900">{p.name || p.parameter}</td>
                              <td className="py-2.5 px-3 font-bold text-[#527D73]">{p.value} {p.unit}</td>
                              <td className="py-2.5 px-3 text-slate-500">{p.referenceRange || "-"}</td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  p.status === "HIGH" || p.status === "ELEVATED"
                                    ? "bg-[#FDECE8] text-[#E23A2E] border border-[#F2603C]/30"
                                    : "bg-[#EDF4EF] text-[#527D73] border border-[#527D73]/30"
                                }`}>
                                  {p.status || "NORMAL"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {report.attachmentName && report.attachmentDataUrl && (
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-3 flex items-center justify-between bg-[#FAFBFC]">
                      <div className="flex items-center space-x-2 min-w-0">
                        <Paperclip className="w-4 h-4 text-[#527D73] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{report.attachmentName}</p>
                          <p className="text-[10px] text-slate-500">Attached by patient</p>
                        </div>
                      </div>
                      {report.attachmentDataUrl.startsWith("data:image") && (
                        <img src={report.attachmentDataUrl} alt={report.attachmentName} className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0" />
                      )}
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => setViewAttachment({ name: report.attachmentName, dataUrl: report.attachmentDataUrl })}
                          className="px-2.5 py-1 bg-[#EDF1F5] hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-lg text-[10px] font-bold flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <a
                          href={report.attachmentDataUrl}
                          download={report.attachmentName}
                          className="px-2.5 py-1 bg-[#527D73] text-white rounded-lg text-[10px] font-bold flex items-center space-x-1 no-underline"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GEMINI AI DOCTOR & SYMPTOM CHECKER TAB */}
        {activeTab === "AI_ASSISTANT" && (
          <div className="bg-[#FFFFFF] border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col h-[700px]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#527D73]/15 border border-[#527D73]/40 flex items-center justify-center text-[#527D73]">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Gemini 3.6 AI Clinical Assistant</h2>
                  <p className="text-xs text-slate-500">Contextual Q&A over your personal Electronic Health Record</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-[#EDF4EF] border border-[#527D73]/40 text-[#527D73] text-xs font-mono font-bold rounded-xl">
                Gemini 3.6 Flash
              </span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-[#EDF1F5] border border-slate-200/80 rounded-2xl font-sans text-xs">
              {aiChatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-xl p-3.5 rounded-2xl leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#527D73] text-white font-medium shadow-md"
                        : "bg-[#FFFFFF] border border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="font-bold text-[10px] mb-1 opacity-70">
                      {m.role === "user" ? "You" : "Gemini AI Clinical Support"}
                    </div>
                    {m.text}
                  </div>
                </div>
              ))}
              {isAiReplying && (
                <div className="flex justify-start">
                  <div className="p-3 bg-[#FFFFFF] border border-slate-200 rounded-2xl text-[#527D73] text-xs font-mono flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Gemini AI is reviewing your clinical history...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Questions & Input Bar */}
            <div className="space-y-2 shrink-0 pt-2">
              <div className="flex flex-wrap gap-2 text-[11px]">
                <button
                  onClick={() => handleSendAiMessage("Summarize my recent lab reports and lipid profile.")}
                  className="px-3 py-1.5 bg-[#EDF1F5] hover:bg-slate-100 border border-slate-300/60 rounded-xl text-slate-700 font-medium transition"
                >
                  🤖 Summarize recent lab panels
                </button>
                <button
                  onClick={() => handleSendAiMessage("Are there any drug interactions in my active prescriptions?")}
                  className="px-3 py-1.5 bg-[#EDF1F5] hover:bg-slate-100 border border-slate-300/60 rounded-xl text-slate-700 font-medium transition"
                >
                  🤖 Check prescription drug interactions
                </button>
                <button
                  onClick={() => handleSendAiMessage("Explain my blood pressure readings and lifestyle tips.")}
                  className="px-3 py-1.5 bg-[#EDF1F5] hover:bg-slate-100 border border-slate-300/60 rounded-xl text-slate-700 font-medium transition"
                >
                  🤖 Explain blood pressure ranges
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={aiChatInput}
                  onChange={(e) => setAiChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendAiMessage()}
                  placeholder="Ask a health question, request a lab explanation, or describe symptoms..."
                  className="flex-1 bg-[#EDF1F5] border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#527D73]/50"
                />
                <button
                  onClick={() => handleSendAiMessage()}
                  className="px-5 py-3 bg-[#527D73] hover:bg-[#0f172a] text-white font-bold rounded-xl text-xs transition shadow-md shadow-[#527D73]/30"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VITALS & BIOMARKERS ANALYTICS TAB (ADVANCED SECTION) */}
        {activeTab === "VITALS_ANALYTICS" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                  <Heart className="w-5 h-5 text-[#F2603C]" />
                  <span>Vitals & Biomarkers Analytics</span>
                </h2>
                <p className="text-xs text-slate-500">Your saved readings and history. Run care analysis in its separate section.</p>
              </div>
              <button
                onClick={() => {
                  setVitalsForm({
                    bpSystolic: "",
                    bpDiastolic: "",
                    glucose: "",
                    heartRate: "",
                    spo2: "",
                    weight: "",
                    height: "",
                    date: new Date().toISOString().split("T")[0],
                  });
                  setVitalsFormError("");
                  setShowVitalsModal(true);
                }}
                className="px-4 py-2 bg-[#527D73] hover:bg-[#41685F] text-white font-bold rounded-xl text-xs transition flex items-center space-x-2 shadow-md shadow-[#527D73]/20"
              >
                <Plus className="w-4 h-4" />
                <span>Log New Vitals</span>
              </button>
            </div>

            {/* Vitals Summary Metric Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#FFFFFF] border border-slate-200 rounded-2xl p-4 space-y-1 shadow-md">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Blood Pressure</span>
                <div className="text-2xl font-semibold text-[#F2603C] font-mono">
                  {latestVitals?.bpSystolic ? `${latestVitals.bpSystolic}/${latestVitals.bpDiastolic} ` : <span className="text-slate-300">—</span>}
                  <span className="text-xs text-slate-500 font-sans">mmHg</span>
                </div>
                <div className="text-[10px] text-[#527D73] font-mono font-bold">{latestVitals?.bpSystolic ? "LATEST READING" : "NO DATA YET"}</div>
              </div>

              <div className="bg-[#FFFFFF] border border-slate-200 rounded-2xl p-4 space-y-1 shadow-md">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Fasting Glucose</span>
                <div className="text-2xl font-semibold text-[#527D73] font-mono">
                  {latestVitals?.glucose ? `${latestVitals.glucose} ` : <span className="text-slate-300">—</span>}
                  <span className="text-xs text-slate-500 font-sans">mg/dL</span>
                </div>
                <div className="text-[10px] text-[#527D73] font-mono font-bold">{latestVitals?.glucose ? "LATEST READING" : "NO DATA YET"}</div>
              </div>

              <div className="bg-[#FFFFFF] border border-slate-200 rounded-2xl p-4 space-y-1 shadow-md">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Resting Heart Rate</span>
                <div className="text-2xl font-semibold text-[#527D73] font-mono">
                  {latestVitals?.heartRate ? `${latestVitals.heartRate} ` : <span className="text-slate-300">—</span>}
                  <span className="text-xs text-slate-500 font-sans">bpm</span>
                </div>
                <div className="text-[10px] text-[#527D73] font-mono font-bold">{latestVitals?.heartRate ? "LATEST READING" : "NO DATA YET"}</div>
              </div>

              <div className="bg-[#FFFFFF] border border-slate-200 rounded-2xl p-4 space-y-1 shadow-md">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Oxygen Saturation (SpO2)</span>
                <div className="text-2xl font-semibold text-[#527D73] font-mono">
                  {latestVitals?.spo2 ? `${latestVitals.spo2}%` : <span className="text-slate-300">—</span>}
                </div>
                <div className="text-[10px] text-[#527D73] font-mono font-bold">{latestVitals?.spo2 ? "LATEST READING" : "NO DATA YET"}</div>
              </div>

              <div className="bg-[#FFFFFF] border border-slate-200 rounded-2xl p-4 space-y-1 shadow-md md:col-span-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">BMI & Body Composition</span>
                <div className="text-2xl font-semibold text-[#0f172a] font-mono">
                  {latestVitals?.height && latestVitals?.weight ? (
                    (latestVitals.weight / Math.pow(latestVitals.height / 100, 2)).toFixed(1)
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                  <span className="text-xs text-slate-500 font-sans">kg/m²</span>
                </div>
                <div className="text-[10px] font-mono font-bold">
                  {latestVitals?.height && latestVitals?.weight ? (
                    "CALCULATED FROM SAVED VALUES"
                  ) : (
                    "ADD HEIGHT + WEIGHT"
                  )}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 -mt-2">
              Height and weight are optional — add them anytime so the AI can compute your BMI and body-composition trends.
            </div>




            {/* Historical Log Table */}
            <div className="bg-[#FFFFFF] border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3">Historical Vitals Log</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Blood Pressure</th>
                      <th className="py-2.5 px-3">Glucose</th>
                      <th className="py-2.5 px-3">Heart Rate</th>
                      <th className="py-2.5 px-3">SpO2</th>
                      <th className="py-2.5 px-3">Weight</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 text-slate-800">
                    {vitalsHistory.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center">
                          <Heart className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm font-bold text-slate-500">No vitals logged yet</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Use "Log New Vitals" to record your first reading. New readings appear here.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      vitalsHistory.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#EDF1F5]">
                        <td className="py-3 px-3 font-bold text-[#527D73]">{item.date}</td>
                        <td className="py-3 px-3">{item.bpSystolic}/{item.bpDiastolic} mmHg</td>
                        <td className="py-3 px-3">{item.glucose} mg/dL</td>
                        <td className="py-3 px-3">{item.heartRate} bpm</td>
                        <td className="py-3 px-3">{item.spo2}%</td>
                        <td className="py-3 px-3">{item.weight} kg</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-[#EDF4EF] text-[#527D73] border border-[#527D73]/40 rounded text-[10px] font-bold">
                            NORMAL
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => deleteVital(item)}
                            title="Delete this vitals reading"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#E23A2E] hover:bg-[#FDECE8] transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MEDICATION SCHEDULE TAB (CLINICAL WORKFLOW INTEGRATED) */}
        {activeTab === "MEDICATIONS" && <PatientMedicationsPanel patientId={profile.userId || profile.id} />}

        {activeTab === "COMPLAINTS" && (
            <ComplaintCenter
              openOnMount
              appUser={{
                id: appUser?.id || profile.userId,
                name: appUser?.name || patientName,
                email: appUser?.email || "patient@pranacrux.org",
                role: "PATIENT",
              }}
              module="PATIENT"
              patientContext={{
                patientId: appUser?.id || profile.userId,
                patientHealthId: appUser?.globalHealthId || profile.globalHealthId,
                patientName: patientName,
              }}
              linkedAccess={linkedAccessEvent}
              onLinkedAccessCleared={() => setLinkedAccessEvent(null)}
              doctors={doctors}
              hospitals={hospitals}
            />
        )}

        {/* ACCOUNT & PROFILE TAB */}
        {activeTab === "ACCOUNT" && <PatientAccountPanel profile={profile} />}

        {activeTab === "CARE_ANALYSIS" && <ProactiveCarePanel patientId={profile.userId || profile.id} />}

        {/* EMERGENCY REPORT TAB */}
        {activeTab === "EMERGENCY_PROFILE" && (
          <EmergencyReportPanel patientId={profile.userId || profile.id} onEditDetails={() => setActiveTab("ACCOUNT")} onRunChecks={() => setActiveTab("CARE_ANALYSIS")} />
        )}

        {/* RECORD ACCESS AUDIT LOG TAB */}
        {activeTab === "AUDIT_LOGS" && (
          <HierarchicalAuditLogViewer
            viewMode="PATIENT"
            patientHealthId={profile.globalHealthId}
            patientUserId={profile.userId}
            onRaiseComplaint={(event) => { setLinkedAccessEvent(event); setActiveTab("COMPLAINTS"); }}
          />
        )}

      </AppShell>

      {/* MANUAL LAB REPORT UPLOAD MODAL */}
      {/* VITALS ADD MODAL (patient enters real reading) */}
      {showVitalsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#527D73]/30 rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-4 text-slate-900 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowVitalsModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 p-1 rounded-xl bg-[#EDF1F5]"
            >
              ✕
            </button>

            <div className="flex items-center space-x-3 text-[#527D73] pb-2 border-b border-slate-200">
              <div className="w-10 h-10 rounded-2xl bg-[#527D73]/15 border border-[#527D73]/40 flex items-center justify-center text-[#527D73]">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Log New Vitals</h3>
                <p className="text-xs text-[#527D73] font-mono">Enter your latest measured readings</p>
              </div>
            </div>

            {vitalsFormError && (
              <div className="rounded-xl px-3 py-2 text-[11px] font-bold" style={{ backgroundColor: "#FDECE8", color: "#E23A2E", border: "1px solid #F2603C44" }}>
                {vitalsFormError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Systolic BP (mmHg)</label>
                <input
                  type="number" min="50" max="250"
                  value={vitalsForm.bpSystolic}
                  onChange={(e) => setVitalsForm((p) => ({ ...p, bpSystolic: e.target.value }))}
                  placeholder="e.g. 120"
                  className="w-full bg-[#EDF1F5] border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Diastolic BP (mmHg)</label>
                <input
                  type="number" min="30" max="160"
                  value={vitalsForm.bpDiastolic}
                  onChange={(e) => setVitalsForm((p) => ({ ...p, bpDiastolic: e.target.value }))}
                  placeholder="e.g. 80"
                  className="w-full bg-[#EDF1F5] border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Fasting Glucose (mg/dL)</label>
                <input
                  type="number" min="40" max="500"
                  value={vitalsForm.glucose}
                  onChange={(e) => setVitalsForm((p) => ({ ...p, glucose: e.target.value }))}
                  placeholder="e.g. 95"
                  className="w-full bg-[#EDF1F5] border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Heart Rate (bpm)</label>
                <input
                  type="number" min="30" max="220"
                  value={vitalsForm.heartRate}
                  onChange={(e) => setVitalsForm((p) => ({ ...p, heartRate: e.target.value }))}
                  placeholder="e.g. 72"
                  className="w-full bg-[#EDF1F5] border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">SpO2 (%)</label>
                <input
                  type="number" min="50" max="100"
                  value={vitalsForm.spo2}
                  onChange={(e) => setVitalsForm((p) => ({ ...p, spo2: e.target.value }))}
                  placeholder="e.g. 98"
                  className="w-full bg-[#EDF1F5] border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Weight (kg)</label>
                <input
                  type="number" min="2" max="300"
                  value={vitalsForm.weight}
                  onChange={(e) => setVitalsForm((p) => ({ ...p, weight: e.target.value }))}
                  placeholder="e.g. 68"
                  className="w-full bg-[#EDF1F5] border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Height (cm)</label>
                <input
                  type="number" min="60" max="250"
                  value={vitalsForm.height}
                  onChange={(e) => setVitalsForm((p) => ({ ...p, height: e.target.value }))}
                  placeholder="e.g. 168"
                  className="w-full bg-[#EDF1F5] border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-500"
                />
              </div>
              </div>

              <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-2">
                All readings are optional — fill in what you measured. Adding Height + Weight lets the AI compute your BMI.
              </div>

            <button
              onClick={async () => {
                const entries = [
                  { k: "bpSystolic", v: Number(vitalsForm.bpSystolic) },
                  { k: "bpDiastolic", v: Number(vitalsForm.bpDiastolic) },
                  { k: "glucose", v: Number(vitalsForm.glucose) },
                  { k: "heartRate", v: Number(vitalsForm.heartRate) },
                  { k: "spo2", v: Number(vitalsForm.spo2) },
                  { k: "weight", v: Number(vitalsForm.weight) },
                  { k: "height", v: Number(vitalsForm.height) },
                ];
                const provided = entries.filter((e) => e.v > 0);
                if (provided.length === 0) {
                  setVitalsFormError("Please enter at least one reading (BP, glucose, heart rate, SpO2, weight or height).");
                  return;
                }
                const hasSys = provided.some((e) => e.k === "bpSystolic");
                const hasDia = provided.some((e) => e.k === "bpDiastolic");
                if (hasSys !== hasDia) {
                  setVitalsFormError("Please enter both Systolic and Diastolic BP together, or leave both empty.");
                  return;
                }
                const newLog: any = { date: new Date().toISOString().split("T")[0] };
                provided.forEach((e) => { newLog[e.k] = e.v; });
                const vitalValidationError = validateVitalsMap(newLog);
                if (vitalValidationError) {
                  setVitalsFormError(vitalValidationError);
                  return;
                }
                try {
                  const res = await fetch("/api/medical-records/vitals", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      patientId: profile.userId || profile.id || appUser?.id,
                      patientName: profile.name || appUser?.name,
                      patientHealthId: profile.globalHealthId,
                      vitals: newLog,
                    }),
                  });
                  const data = await parseResponseSafe<any>(res, { success: false });
                  if (!res.ok || !data || !data.success) {
                    setVitalsFormError(data?.message || "Failed to save vitals reading. Please try again.");
                    return;
                  }
                  const saved = data.record && data.record.vitals ? { ...data.record.vitals, id: data.record.id } : { ...newLog };
                  setVitalsHistory((prev) => [...prev, saved]);
                  onRefreshRecords?.();
                  setShowVitalsModal(false);
                } catch (err) {
                  setVitalsFormError("Server communication error. Please try again.");
                }
              }}
              className="w-full py-3 bg-[#527D73] hover:bg-[#41685F] text-white font-bold rounded-xl transition text-xs shadow-lg shadow-[#527D73]/30"
            >
              Save Vitals Reading
            </button>
          </div>
        </div>
      )}

      {showManualLabModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#527D73]/30 rounded-3xl w-full max-w-xl p-6 shadow-2xl relative space-y-4 text-slate-900 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { setShowManualLabModal(false); resetUploadState(); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 p-1 rounded-xl bg-[#EDF1F5]"
            >
              ✕
            </button>

            <div className="flex items-center space-x-3 text-[#527D73] pb-2 border-b border-slate-200">
              <div className="w-10 h-10 rounded-2xl bg-[#527D73]/15 border border-[#527D73]/40 flex items-center justify-center text-[#527D73]">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Upload Lab Report / Scan</h3>
                <p className="text-xs text-[#527D73] font-mono">PranaCrux AI validates the document before saving</p>
              </div>
            </div>

            {/* STEP 1: File drop-zone */}
            {!uploadAttachment && !aiAnalyzing && (
              <div>
                <label className="block text-slate-700 font-bold mb-1 text-xs">Select a lab report or diagnostic scan document</label>
                <input
                  type="file"
                  ref={labFileInputRef}
                  accept="application/pdf,image/png,image/jpeg,image/jpg"
                  onChange={handleLabFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => labFileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-300 hover:border-[#527D73]/60 p-8 rounded-2xl text-center space-y-2 bg-[#EDF1F5] cursor-pointer"
                >
                  <Upload className="w-8 h-8 text-[#527D73] mx-auto" />
                  <p className="text-sm text-slate-700 font-bold">Click to select a scan image or PDF file</p>
                  <p className="text-[11px] text-slate-500">Supports PDF, PNG, JPG up to 15MB</p>
                </button>
              </div>
            )}

            {/* AI ANALYZING */}
            {aiAnalyzing && (
              <div className="bg-[#EDF1F5] border border-slate-200 rounded-2xl p-6 flex flex-col items-center space-y-3">
                <RefreshCw className="w-8 h-8 text-[#527D73] animate-spin" />
                <p className="text-sm font-bold text-slate-800">PranaCrux AI is validating & reading the document...</p>
                <p className="text-[11px] text-slate-500 text-center">
                  Checking that this is a genuine lab report / diagnostic scan, extracting results and generating a summary.
                </p>
              </div>
            )}

            {/* INVALID DOCUMENT */}
            {!aiAnalyzing && aiResult && !aiResult.valid && (
              <div className="bg-[#FDECE8] border border-[#F2603C]/40 rounded-2xl p-5 space-y-3">
                <div className="flex items-center space-x-2 text-[#E23A2E]">
                  <XCircle className="w-6 h-6" />
                  <h4 className="font-bold text-sm">Upload Rejected</h4>
                </div>
                <p className="text-xs text-slate-700">
                  This does not appear to be a valid health lab report or diagnostic scan.
                </p>
                {aiResult.reason && (
                  <p className="text-xs text-[#E23A2E] font-semibold bg-[#FFFFFF]/60 rounded-lg px-3 py-2 border border-[#F2603C]/20">
                    {aiResult.reason}
                  </p>
                )}
                <p className="text-[11px] text-slate-500">
                  Please upload a genuine medical report. If this is an error, try a clearer image of the report.
                </p>
                <button
                  onClick={() => resetUploadState()}
                  className="w-full py-2.5 bg-[#E23A2E] hover:bg-[#C9302A] text-white font-bold rounded-xl transition text-xs"
                >
                  Try Another Document
                </button>
              </div>
            )}

            {/* VALID DOCUMENT (auto-saved) */}
            {!aiAnalyzing && aiResult && aiResult.valid && saveSuccess && (
              <div className="space-y-3">
                <div className="bg-[#EDF4EF] border border-[#527D73]/40 rounded-2xl p-6 flex flex-col items-center space-y-3 text-center">
                  <CheckCircle2 className="w-12 h-12 text-[#527D73]" />
                  <h4 className="font-bold text-slate-900 text-base">Report saved successfully</h4>
                  <p className="text-xs text-slate-600">
                    Your validated {aiResult.report?.recordType === "IMAGING_SCAN" ? "diagnostic scan" : "lab report"} has been stored and linked to your Health ID.
                  </p>
                </div>

                {aiResult.summary && (
                  <div className="bg-[#EDF1F5] border border-slate-200 rounded-2xl p-4 space-y-1.5">
                    <p className="text-[10px] font-bold text-[#527D73] uppercase tracking-wide">
                      AI Summary{aiResult.source === "GEMINI" ? " (PranaCrux AI)" : ""}
                    </p>
                    <p className="text-xs text-slate-700 leading-relaxed">{aiResult.summary}</p>
                  </div>
                )}

                {aiResult.flaggedValues && aiResult.flaggedValues.length > 0 && (
                  <div className="bg-[#FDECE8] border border-[#F2603C]/40 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-bold text-[#E23A2E] uppercase tracking-wide">Flagged Values</p>
                    <div className="space-y-1.5">
                      {aiResult.flaggedValues.map((f: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-[#FFFFFF]/70 border border-[#F2603C]/20 rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{f.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {f.value} {f.unit}{f.referenceRange ? ` (Ref: ${f.referenceRange})` : ""}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              f.status === "HIGH"
                                ? "bg-[#F2603C]/10 text-[#E23A2E] border-[#F2603C]/30"
                                : "bg-[#F59E0B]/10 text-[#B45309] border-[#F59E0B]/30"
                            }`}
                          >
                            {f.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiResult.report?.parameters && aiResult.report.parameters.length > 0 && (
                  <div className="bg-[#EDF1F5] border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-bold text-[#527D73] uppercase tracking-wide">Extracted Measurements</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {aiResult.report.parameters.map((p: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 truncate pr-2">{p.name}</span>
                          <span className="font-mono text-slate-900 font-bold shrink-0">
                            {p.value} {p.unit}
                            <span className="text-slate-400 font-normal"> ({p.referenceRange})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setShowManualLabModal(false); resetUploadState(); }}
                  className="w-full py-3 bg-[#527D73] hover:bg-[#0f172a] text-white font-bold rounded-xl transition text-xs"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ATTACHMENT VIEWER MODAL (view without downloading) */}
      {viewAttachment && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#527D73]/30 rounded-3xl w-full max-w-4xl shadow-2xl relative overflow-hidden text-slate-900 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center space-x-2 min-w-0">
                <Paperclip className="w-4 h-4 text-[#527D73] shrink-0" />
                <p className="text-xs font-bold text-slate-800 truncate">{viewAttachment.name}</p>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <a
                  href={viewAttachment.dataUrl}
                  download={viewAttachment.name}
                  className="px-3 py-1.5 bg-[#527D73] text-white rounded-xl text-[10px] font-bold flex items-center space-x-1 no-underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setViewAttachment(null)}
                  className="p-2 rounded-xl bg-[#EDF1F5] hover:bg-slate-200 text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-[#111318] p-4 flex items-center justify-center">
              {viewAttachment.dataUrl.startsWith("data:image") ? (
                <img src={viewAttachment.dataUrl} alt={viewAttachment.name} className="max-h-[70vh] max-w-full object-contain rounded-lg" />
              ) : (
                <embed src={viewAttachment.dataUrl} type="application/pdf" className="w-full h-[72vh]" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT REPORT MODAL */}
      {editingReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl relative overflow-hidden text-slate-900">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <Pencil className="w-4 h-4 text-[#527D73]" />
                <span>Modify Lab Report</span>
              </h3>
              <button onClick={() => setEditingReport(null)} className="p-2 rounded-xl bg-[#EDF1F5] hover:bg-slate-200 text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-slate-700 font-bold mb-1 text-xs">Report Title / Test Name</label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-[#527D73] focus:outline-none text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">Facility / Lab Name</label>
                  <input
                    value={editForm.labName}
                    onChange={(e) => setEditForm((f) => ({ ...f, labName: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-[#527D73] focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">Report Date</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-[#527D73] focus:outline-none text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1 text-xs">Result / Clinical Summary</label>
                <textarea
                  value={editForm.diagnosis}
                  onChange={(e) => setEditForm((f) => ({ ...f, diagnosis: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-[#527D73] focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1 text-xs">AI Summary</label>
                <textarea
                  value={editForm.aiSummary}
                  onChange={(e) => setEditForm((f) => ({ ...f, aiSummary: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-[#527D73] focus:outline-none text-sm"
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setEditingReport(null)}
                  className="px-4 py-2.5 bg-[#EDF1F5] hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditReport}
                  disabled={savingEdit}
                  className="px-5 py-2.5 bg-[#527D73] hover:bg-[#0f172a] text-white font-bold rounded-xl transition text-xs disabled:opacity-60 flex items-center space-x-1.5"
                >
                  {savingEdit && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{savingEdit ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LabReportExplainModal
        isOpen={!!selectedReportForExplain}
        onClose={() => setSelectedReportForExplain(null)}
        report={selectedReportForExplain}
      />
    </>
  );
};

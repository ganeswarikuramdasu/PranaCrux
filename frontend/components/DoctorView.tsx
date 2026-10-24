import React, { useState, useEffect } from "react";
import { DoctorProfile, MedicalRecord, ConsentGrant, PatientProfile, HospitalProfile, UserRole } from "../types";
import { safeFetchJson } from "../utils/api";
import { AppShell, NavItem } from "./AppShell";
import { WorkspaceIntro } from "./WorkspaceIntro";
import { WarningsBanner } from "./WarningsBanner";
import { ComplaintCenter } from "./ComplaintCenter";
import { PatientRecordsTable } from "./PatientRecordsTable";
import { CardScannerModal } from "./CardScannerModal";
import { DoctorCardScannerSection } from "./DoctorCardScannerSection";
import { EmergencyAccessDoctorView } from "./EmergencyAccessDoctorView";
import { DoctorProfileSettings } from "./DoctorProfileSettings";
import { DoctorPatientAccessCenter } from "./DoctorPatientAccessCenter";
import { DoctorAccessHistorySection } from "./DoctorAccessHistorySection";
import {
  Stethoscope,
  Search,
  User,
  Plus,
  ShieldCheck,
  FileText,
  Lock,
  Calendar,
  Bot,
  ShieldAlert,
  Clock,
  Sparkles,
  Send,
  AlertTriangle,
  CheckCircle2,
  Activity,
  UserCheck,
  Pill,
  Award,
  BarChart3,
  TrendingUp,
  MessageSquare,
  Users,
  ChevronRight,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
  QrCode,
  CreditCard,
  Siren,
  History,
  MessageSquareWarning,
} from "lucide-react";

interface DoctorViewProps {
  doctor: DoctorProfile;
  records: MedicalRecord[];
  consents: ConsentGrant[];
  patientProfiles: PatientProfile[];
  hospitals: HospitalProfile[];
  onBreakGlassAccess: (patientHealthId: string, reason: string) => void;
  doctorName: string;
  appUser?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    globalHealthId?: string;
  };
  onLogout?: () => void;
  onGoToHome?: () => void;
}

export const DoctorView: React.FC<DoctorViewProps> = ({
  doctor,
  records,
  consents,
  patientProfiles,
  hospitals,
  onBreakGlassAccess,
  doctorName,
  appUser,
  onLogout,
  onGoToHome,
}) => {
  const DOCTOR_TABS = ["DASHBOARD", "PATIENT_ACCESS", "EMERGENCY_ACCESS", "PATIENT_RECORDS_TABLE", "PROFILE_SETTINGS", "ACCESS_HISTORY", "COMPLAINTS"];

  const [activeTab, setActiveTab] = useState<
    | "DASHBOARD"
    | "PATIENT_ACCESS"
    | "EMERGENCY_ACCESS"
    | "PATIENT_RECORDS_TABLE"
    | "PROFILE_SETTINGS"
    | "ACCESS_HISTORY"
    | "COMPLAINTS"
  >(() => {
    const saved = localStorage.getItem("pranacrux_tab_DOCTOR");
    return saved && DOCTOR_TABS.includes(saved) ? (saved as any) : "DASHBOARD";
  });

  useEffect(() => {
    try {
      localStorage.setItem("pranacrux_tab_DOCTOR", activeTab);
    } catch {
      // storage unavailable
    }
  }, [activeTab]);

  // Local state for doctor profile to reflect edits
  const [activeDoctorState, setActiveDoctorState] = useState<DoctorProfile>(doctor);

  useEffect(() => { setActiveDoctorState(doctor); }, [doctor]);

  // Patient Lookup State
  const [searchHealthId, setSearchHealthId] = useState("");
  const [activePatient, setActivePatient] = useState<PatientProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchedRecords, setSearchedRecords] = useState<MedicalRecord[]>([]);
  const [searchedConsents, setSearchedConsents] = useState<ConsentGrant[]>([]);
  const [showCardScanner, setShowCardScanner] = useState(false);

  // Break-Glass State
  const [bgHealthId, setBgHealthId] = useState("");
  const [bgReason, setBgReason] = useState("");

  // Safe Doctor & Name Fallbacks
  const safeDoctorName = doctorName || doctor?.name || "Practicing Physician";
  const safeDoctor = doctor || {
    id: "doc_1",
    name: safeDoctorName,
    specialization: "General Medicine",
    licenseNumber: "MCI-2026-REG",
    experienceYears: 10,
    hospitalId: "hosp_1",
    hospitalName: "Apollo Speciality Hospital",
    status: "APPROVED",
    fee: 500,
  };

  const handlePatientLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawId = searchHealthId.trim();
    if (!rawId) {
      setSearchError("Please enter a valid Patient Global Unique Health ID (e.g., NH-IND-2026-XXXXXXXX).");
      setActivePatient(null);
      setSearchedRecords([]);
      setSearchedConsents([]);
      setHasSearched(true);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const data = await safeFetchJson<any>(
        `/api/doctor/access-records`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doctorId: safeDoctor.id || doctor?.id,
            doctorName: safeDoctorName,
            patientHealthId: rawId,
          }),
        },
        null
      );

      if (data && data.success && data.patient) {
        setActivePatient(data.patient);
        setSearchedRecords(data.records || []);
        setSearchedConsents(data.consents || []);
        setSearchError(null);
      } else {
        setActivePatient(null);
        setSearchedRecords([]);
        setSearchedConsents([]);
        setSearchError(
          data?.message || `Patient Not Found: No patient record registered with Global Unique Health ID "${rawId}".`
        );
      }
    } catch {
      setActivePatient(null);
      setSearchedRecords([]);
      setSearchedConsents([]);
      setSearchError(
        "Patient lookup could not be completed. Patient records are only accessible with active consent or Emergency Break-Glass authorization."
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchHealthId("");
    setActivePatient(null);
    setSearchedRecords([]);
    setSearchedConsents([]);
    setSearchError(null);
    setHasSearched(false);
  };

  const navTabs: Array<{ key: string; label: string; icon: any; count?: number; badge?: string }> = [
    { key: "DASHBOARD", label: "Dashboard", icon: Stethoscope },
    { key: "PATIENT_ACCESS", label: "Patient access", icon: Lock, badge: "Main" },
    { key: "EMERGENCY_ACCESS", label: "Emergency access", icon: Siren, badge: "ER" },
    { key: "PATIENT_RECORDS_TABLE", label: "Patient records", icon: FileSpreadsheet, badge: "Handled" },
    { key: "PROFILE_SETTINGS", label: "Profile & settings", icon: User, badge: "Config" },
    { key: "ACCESS_HISTORY", label: "Access history", icon: History, badge: "Ledger" },
    { key: "COMPLAINTS", label: "Complaints", icon: MessageSquareWarning, badge: "New" },
  ];

  const navItems: NavItem[] = navTabs.map((t) => ({
    id: t.key as string,
    label: t.label,
    icon: t.icon,
    count: t.count,
    badge: t.badge,
  }));

  const shellUser = appUser || {
    id: "doc_1",
    name: doctorName || "Physician",
    email: "doctor@pranacrux.org",
    role: "DOCTOR" as UserRole,
  };

  return (
    <>
      <AppShell
        user={shellUser}
        roleLabel="Doctor"
        subtitle="Clinician"
        navItems={navItems}
        active={activeTab}
        onSelect={(k) => setActiveTab(k as any)}
        onLogout={onLogout}
        onGoToHome={onGoToHome}
      >

        {/* DASHBOARD TAB */}
        {activeTab === "DASHBOARD" && (
          <div className="space-y-6">
            
            {/* Announcements / Warnings */}
            <WarningsBanner role="DOCTOR" module="DOCTOR" />
            
            {(doctor.malpracticeCount ?? 0) > 0 && (
              <div className={`p-4 rounded-lg border flex items-start space-x-3 ${
                (doctor.malpracticeCount ?? 0) >= 3
                  ? "bg-red-50 border-red-300"
                  : "bg-amber-50 border-amber-300"
              }`}>
                <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${
                  (doctor.malpracticeCount ?? 0) >= 3 ? "text-red-600" : "text-amber-600"
                }`} />
                <div>
                  <p className={`text-sm font-bold ${
                    (doctor.malpracticeCount ?? 0) >= 3 ? "text-red-800" : "text-amber-800"
                  }`}>
                    {(doctor.malpracticeCount ?? 0) >= 3
                      ? "Account Deleted — Malpractice Threshold Reached"
                      : `Malpractice Warning — ${doctor.malpracticeCount} of 3 confirmed complaint${(doctor.malpracticeCount ?? 0) !== 1 ? "s" : ""}`
                    }
                  </p>
                  <p className={`text-xs mt-1 ${
                    (doctor.malpracticeCount ?? 0) >= 3 ? "text-red-700" : "text-amber-700"
                  }`}>
                    {(doctor.malpracticeCount ?? 0) >= 3
                      ? "Your account has been deleted by the Super Admin due to 3+ confirmed malpractice complaints. Patient access is blocked. Contact the Super Admin to resolve this."
                      : "A patient complaint has been confirmed against you. At 3 confirmed malpractices, your account will be automatically deleted and patient access will be blocked. Please review the Complaints section for details."
                    }
                  </p>
                  {Array.isArray(doctor.malpracticeHistory) && doctor.malpracticeHistory.length > 0 && (
                    <div className="mt-2 bg-white/70 border border-current/20 rounded-xl p-3 space-y-1.5">
                      <p className={`text-[10px] font-sans font-bold uppercase tracking-wider ${
                        (doctor.malpracticeCount ?? 0) >= 3 ? "text-red-600" : "text-amber-600"
                      }`}>
                        Recorded Reasons
                      </p>
                      {doctor.malpracticeHistory.slice(0, 6).map((h, hi) => (
                        <div key={hi} className="flex items-start justify-between gap-2 text-[11px]">
                          <div className="min-w-0">
                            <p className="font-sans font-bold text-slate-800">{h.reason || "No reason recorded"}</p>
                            <p className="text-slate-500 font-sans">
                              {h.actorName || "Super Admin"} · {h.at ? new Date(h.at).toLocaleString() : ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-slate-600 font-sans font-bold">{h.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <WorkspaceIntro eyebrow="Clinical workspace" title={`Welcome, ${safeDoctorName}`} description="Find patient records, review authorized clinical information, and manage emergency access.">
              <button id="doctor-patient-access-center-btn" onClick={() => setActiveTab("PATIENT_ACCESS")} className="care-button"><Lock size={16} />Patient access</button>
              <button id="doctor-emergency-access-btn" onClick={() => setActiveTab("EMERGENCY_ACCESS")} className="care-button-secondary care-urgent-action"><Siren size={16} />Emergency access</button>
              <button id="doctor-scan-card-btn" onClick={() => setShowCardScanner(true)} className="care-button-secondary"><QrCode size={16} />Scan access card</button>
            </WorkspaceIntro>

            {/* Prominent Global Unique Health ID Search / Lookup Section */}
            <div className="bg-[#FFFFFF] border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#f0f6f5] border border-[#317b78]/40 flex items-center justify-center text-[#317b78]">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Patient Record Lookup</h2>
                    <p className="text-xs text-slate-500">Search by Patient Global Unique Health ID to retrieve verified EHR records</p>
                  </div>
                </div>

                {activePatient && (
                  <span className="px-3 py-1 bg-[#f0f6f5] border border-[#317b78]/40 text-[#317b78] text-xs font-sans font-bold rounded-xl flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Patient Verified</span>
                  </span>
                )}
              </div>

              <form onSubmit={handlePatientLookup} className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                    <input
                      id="doctor-health-id-search-input"
                      type="text"
                      placeholder="Enter Patient Global Unique Health ID (e.g. NH-IND-2026-XXXXXXXX)..."
                      value={searchHealthId}
                      onChange={(e) => {
                        setSearchHealthId(e.target.value);
                        if (searchError) setSearchError(null);
                      }}
                      className="w-full bg-[#EDF1F5] border border-slate-300 focus:border-[#317b78] rounded-lg pl-11 pr-4 py-3 text-sm text-slate-900 placeholder-slate-500 focus:outline-none transition shadow-inner font-sans"
                    />
                  </div>

                  <button
                    id="doctor-health-id-search-btn"
                    type="submit"
                    disabled={isSearching}
                    className="px-6 py-3 bg-[#317b78] hover:bg-[#266b68] disabled:bg-slate-700 text-white font-bold rounded-lg shadow-sm shadow-[#317b78]/30 text-sm transition flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
                  >
                    {isSearching ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Searching Registry...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Search</span>
                      </>
                    )}
                  </button>

                  {(activePatient || hasSearched || searchError) && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="px-4 py-3 bg-[#EDF1F5] hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 font-bold rounded-lg text-sm transition shrink-0 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                  <div className="flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#317b78] shrink-0" />
                    <span>Enter the patient's Global Unique Health ID to verify identity and fetch clinical records. Access requires active consent or Emergency Break-Glass authorization.</span>
                  </div>
                </div>
              </form>
            </div>

            {/* Patient Not Found Message Card */}
            {searchError && (
              <div className="bg-[#FDECE8] border border-[#ac6658]/50 rounded-xl p-6 shadow-sm space-y-3 animate-fade-in">
                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-lg bg-[#ac6658]/20 border border-[#ac6658]/40 flex items-center justify-center text-[#955348] shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h3 className="text-base font-bold text-[#955348]">Patient Not Found</h3>
                    <p className="text-xs text-[#955348]/90 leading-relaxed">
                      {searchError}
                    </p>
                    <p className="text-[11px] text-slate-500 pt-1 font-sans">
                      Please confirm the Global Unique Health ID format with the patient or hospital registration reception desk.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Verified Patient Details (Displayed ONLY after successful Global Health ID lookup) */}
            {activePatient && (
              <div className="bg-[#FFFFFF] border border-slate-200 rounded-xl p-6 space-y-6 shadow-sm animate-fade-in">
                
                {/* Patient Header Box */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-lg bg-[#f0f6f5] border border-[#317b78]/40 flex items-center justify-center text-[#317b78] font-bold text-xl shadow-sm">
                      {(activePatient.name || "Patient").substring(0, 2).toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2.5 flex-wrap">
                        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">{activePatient.name || "Patient Citizen"}</h2>
                        <span className="px-2.5 py-0.5 bg-[#f0f6f5] border border-[#317b78]/40 text-[#317b78] text-[10px] font-sans font-bold rounded-md uppercase">
                          VERIFIED IDENTITY
                        </span>
                      </div>
                      <div className="text-xs text-[#317b78] font-sans font-bold flex items-center space-x-1.5">
                        <span>Global Health ID:</span>
                        <span className="bg-[#f0f6f5] px-2 py-0.5 rounded border border-[#317b78]/30 text-slate-900 font-sans">{activePatient.globalHealthId}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-sans">
                    <span className="px-3.5 py-1.5 bg-[#FDECE8] border border-[#ac6658]/40 text-[#955348] rounded-xl font-bold">
                      Blood Group: {activePatient.bloodGroup || "Not provided"}
                    </span>
                    <span className="px-3.5 py-1.5 bg-[#f0f6f5] border border-[#317b78]/40 text-[#317b78] rounded-xl font-bold">
                      Gender: {activePatient.gender || "Not Specified"}
                    </span>
                    {activePatient.dob && (
                      <span className="px-3.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-xl">
                        DOB: {activePatient.dob}
                      </span>
                    )}
                    {activePatient.organDonor && (
                      <span className="px-3.5 py-1.5 bg-[#f0f6f5] border border-[#317b78]/40 text-[#317b78] rounded-xl font-bold">
                        Organ Donor
                      </span>
                    )}
                  </div>
                </div>

                {/* Patient Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  
                  {/* Emergency Contact */}
                  <div className="bg-[#EDF1F5] p-4 rounded-lg border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between text-slate-500 uppercase text-[10px] font-bold">
                      <span>Emergency Contact</span>
                      <User className="w-3.5 h-3.5 text-[#317b78]" />
                    </div>
                    <div className="text-slate-900 font-bold text-sm">{activePatient.emergencyContactName || "Family Contact"}</div>
                    <div className="text-[#317b78] font-sans text-xs">{activePatient.emergencyContactPhone || "+91 98765 43210"}</div>
                    {activePatient.emergencyContactRelation && (
                      <div className="text-[10px] text-slate-500">Relation: {activePatient.emergencyContactRelation}</div>
                    )}
                  </div>

                  {/* Vitals Baseline & Physical Profile */}
                  <div className="bg-[#EDF1F5] p-4 rounded-lg border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between text-slate-500 uppercase text-[10px] font-bold">
                      <span>Vitals & Physical Profile</span>
                      <Activity className="w-3.5 h-3.5 text-[#317b78]" />
                    </div>
                    <div className="text-[#317b78] font-sans font-bold text-xs">
                      Height: {activePatient.heightCm ? `${activePatient.heightCm} cm` : "168 cm"} • Weight: {activePatient.weightKg ? `${activePatient.weightKg} kg` : "62 kg"}
                    </div>
                    <div className="text-slate-700 font-sans text-[11px]">
                      Insurance: {activePatient.insuranceProvider || "Universal Health Guard"}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Policy: {activePatient.insurancePolicyNumber || "POL-IND-STANDARD"}
                    </div>
                  </div>

                  {/* Consent & Access Status */}
                  <div className="bg-[#EDF1F5] p-4 rounded-lg border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between text-slate-500 uppercase text-[10px] font-bold">
                      <span>Consent Authorization</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-[#317b78]" />
                    </div>
                    <div className="text-[#317b78] font-bold text-xs flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>REGISTRY VERIFIED ACCESS</span>
                    </div>
                    <p className="text-slate-500 text-[10px] leading-relaxed">
                      Patient profile securely verified from Global Health Identity Registry.
                    </p>
                  </div>
                </div>

                {/* Allergies & Chronic Conditions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-[#EDF1F5] p-4 rounded-lg border border-slate-200/80 space-y-2">
                    <span className="font-bold text-[#955348] uppercase text-[10px] tracking-wider flex items-center space-x-1.5">
                      <AlertTriangle className="w-3 h-3 text-[#955348]" />
                      <span>Known Allergies & Contraindications</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(activePatient.allergies && activePatient.allergies.length > 0) ? (
                        activePatient.allergies.map((alg: string, idx: number) => (
                          <span key={idx} className="px-2.5 py-1 bg-[#FDECE8] border border-[#ac6658]/40 text-[#955348] rounded-lg text-[11px] font-medium font-sans">
                            {alg}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-xs italic">No critical allergies recorded.</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#EDF1F5] p-4 rounded-lg border border-slate-200/80 space-y-2">
                    <span className="font-bold text-amber-400 uppercase text-[10px] tracking-wider flex items-center space-x-1.5">
                      <Activity className="w-3 h-3 text-amber-400" />
                      <span>Chronic Medical Conditions</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(activePatient.chronicConditions && activePatient.chronicConditions.length > 0) ? (
                        activePatient.chronicConditions.map((cond: string, idx: number) => (
                          <span key={idx} className="px-2.5 py-1 bg-amber-950/80 border border-amber-500/40 text-amber-300 rounded-lg text-[11px] font-medium font-sans">
                            {cond}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-xs italic">No active chronic conditions recorded.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Patient Clinical Records Preview if Available */}
                {searchedRecords.length > 0 && (
                  <div className="bg-[#EDF1F5] p-4 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
                        <FileText className="w-4 h-4 text-[#317b78]" />
                        <span>Lifelong EHR Records on File ({searchedRecords.length})</span>
                      </div>
                      <button
                        onClick={() => setActiveTab("PATIENT_ACCESS")}
                        className="text-[#317b78] hover:text-[#266b68] text-xs font-bold transition flex items-center space-x-1"
                      >
                        <span>Open in Access Center</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      {searchedRecords.slice(0, 3).map((rec) => (
                        <div key={rec.id} className="bg-[#FFFFFF] p-3 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                          <div>
                            <div className="font-bold text-slate-900 flex items-center space-x-2">
                              <span>{rec.title || rec.diagnosis || "Clinical Consultation"}</span>
                              <span className="px-2 py-0.5 bg-[#f0f6f5] border border-[#317b78]/40 text-[#317b78] text-[10px] rounded font-sans">
                                {rec.recordType || rec.category || "EHR"}
                              </span>
                            </div>
                            <p className="text-slate-500 text-[11px] mt-0.5">
                              {rec.hospitalName || "Hospital"} • Dr. {rec.doctorName || "Physician"} • Date: {rec.date}
                            </p>
                          </div>
                          {rec.vitals && (
                            <div className="text-[#317b78] font-sans text-[11px] shrink-0">
                              BP: {rec.vitals.bp || "120/80"} • HR: {rec.vitals.heartRate || "72 bpm"}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Patient Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setActiveTab("PATIENT_ACCESS")}
                      className="px-5 py-2.5 bg-[#317b78] hover:bg-[#266b68] text-white font-bold rounded-xl text-xs transition flex items-center space-x-2 shadow-sm shadow-[#317b78]/30 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Full Access Center & Clinical Notes</span>
                    </button>
                    {searchedRecords.length === 0 && (
                      <button
                        onClick={() => setActiveTab("EMERGENCY_ACCESS")}
                        className="px-4 py-2.5 bg-[#FDECE8] hover:bg-[#FADBD2] border border-[#ac6658]/40 text-[#955348] font-bold rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Siren className="w-3.5 h-3.5" />
                        <span>Emergency Break-Glass</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleClearSearch}
                    className="px-4 py-2.5 bg-[#EDF1F5] hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Lookup Another Patient
                  </button>
                </div>

              </div>
            )}

            {/* Initial Blank Workspace State (Before search) */}
            {!activePatient && !searchError && (
              <div className="bg-[#FFFFFF] border border-slate-200 rounded-xl p-12 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-xl bg-[#f0f6f5] border border-[#317b78]/30 flex items-center justify-center text-[#317b78] mx-auto shadow-inner">
                  <Search className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="text-lg font-bold text-slate-900">No Patient Record Loaded</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Enter a patient's <span className="text-[#317b78] font-sans font-bold">Global Unique Health ID</span> in the search bar above and click <span className="text-slate-900 font-bold">Search</span> to verify registry credentials, review clinical history, and manage medical care.
                  </p>
                </div>
              </div>
            )}

          </div>
        )}


        {/* ACCESS CARD SECTION */}
        {activeTab === "ACCESS_CARD" && (
          <DoctorCardScannerSection
            doctor={safeDoctor}
            hospitalName={safeDoctor.hospitalName}
            onSelectPatientForEhr={(p) => {
              setActivePatient(p);
              setActiveTab("PATIENT_ACCESS");
            }}
          />
        )}



        {/* HANDLED PATIENT EHR RECORDS TABLE (DOCTOR SCOPED) */}
        {activeTab === "PATIENT_RECORDS_TABLE" && (
          <PatientRecordsTable
            records={records.filter(r => {
              const docId = safeDoctor.id;
              const docUserId = safeDoctor.userId;
              const docName = (safeDoctor.name || safeDoctorName || "").toLowerCase();
              const rDocName = (r.doctorName || "").toLowerCase();
              return r.doctorId === docId || r.doctorId === docUserId || (docName && rDocName && (rDocName.includes(docName) || docName.includes(rDocName)));
            })}
            patients={patientProfiles}
            doctorName={safeDoctorName}
            isDoctorScoped={true}
          />
        )}

        {/* PATIENT ACCESS CENTER */}
        {activeTab === "PATIENT_ACCESS" && (
          <DoctorPatientAccessCenter
            doctor={activeDoctorState}
            patientProfiles={patientProfiles}
          />
        )}

        {/* EMERGENCY ACCESS & BREAK-GLASS MODULE */}
        {activeTab === "EMERGENCY_ACCESS" && (
          <EmergencyAccessDoctorView
            doctor={activeDoctorState}
            hospitalName={activeDoctorState.hospitalName || "Apollo Multi-Specialty Hospital"}
            onNavigateToAccessHistory={() => setActiveTab("ACCESS_HISTORY")}
          />
        )}

        {/* RECORD ACCESS HISTORY */}
        {activeTab === "ACCESS_HISTORY" && (
          <DoctorAccessHistorySection doctor={activeDoctorState} />
        )}



        {/* PROFILE SETTINGS */}
        {activeTab === "PROFILE_SETTINGS" && (
          <DoctorProfileSettings
            doctor={activeDoctorState}
            onUpdateDoctor={(updated) => setActiveDoctorState(updated)}
          />
        )}

        {/* COMPLAINTS & SUPPORT */}
        {activeTab === "COMPLAINTS" && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <MessageSquareWarning className="w-5 h-5 text-[#ac6658]" />
                <span>Complaints</span>
              </h2>
              <p className="text-xs text-slate-500">
                Complaints raised against you by patients, or by you about EHR records, facilities, or workflows.
              </p>
            </div>
            <ComplaintCenter
              appUser={{
                id: appUser?.id || doctor.id,
                name: appUser?.name || doctorName,
                email: appUser?.email || "doctor@pranacrux.org",
                role: appUser?.role || "DOCTOR",
              }}
              module="DOCTOR"
            />
          </div>
        )}

      </AppShell>

      {showCardScanner && (
        <CardScannerModal
          doctor={safeDoctor}
          hospitalName={safeDoctor.hospitalName}
          onClose={() => setShowCardScanner(false)}
        />
      )}
    </>
  );
};

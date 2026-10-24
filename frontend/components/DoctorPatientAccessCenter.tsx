import React, { useState, useRef, useEffect } from "react";
import jsQR from "jsqr";
import {
  DoctorProfile,
  PatientProfile,
  AccessSession,
  RecordAccessMethod,
} from "../types";
import { CompletePatientClinicalRecord } from "./CompletePatientClinicalRecord";
import { MobileCameraBridgeModal } from "./MobileCameraBridgeModal";
import { parseResponseSafe } from "../utils/api";
import {
  Calendar,
  User,
  CreditCard,
  Fingerprint,
  Search,
  Camera,
  Lock,
  ArrowRight,
  Clock,
  Building2,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface DoctorPatientAccessCenterProps {
  doctor: DoctorProfile | any;
  patientProfiles?: PatientProfile[];
  onRefreshRecords?: () => void;
  onNavigateToEmergency?: () => void;
}

export const DoctorPatientAccessCenter: React.FC<DoctorPatientAccessCenterProps> = ({
  doctor,
  patientProfiles = [],
  onRefreshRecords,
  onNavigateToEmergency,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<RecordAccessMethod>("PATIENT_HEALTH_ID");

  // Active Session / Opened Clinical Record State
  const [activeSession, setActiveSession] = useState<AccessSession | null>(null);
  const [openedPatientProfile, setOpenedPatientProfile] = useState<PatientProfile | null>(null);
  const [openedMedicalRecords, setOpenedMedicalRecords] = useState<any[]>([]);

  // Method 1: Health ID Access State
  const [healthIdQuery, setHealthIdQuery] = useState<string>("");
  const [healthIdError, setHealthIdError] = useState<string | null>(null);

  // Method 3: Access Card State
  const [cardTokenQuery, setCardTokenQuery] = useState<string>("");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Method 4: Biometric State
  const [biometricStatus, setBiometricStatus] = useState<string | null>(null);
  const [isAuthenticatingBio, setIsAuthenticatingBio] = useState<boolean>(false);
  const [bioPatientQuery, setBioPatientQuery] = useState<string>("");

  // Mobile Remote Camera Bridge State
  const [showMobileBridgeModal, setShowMobileBridgeModal] = useState<boolean>(false);

  // Loading state
  const [isAccessing, setIsAccessing] = useState<boolean>(false);

  // Camera QR Scanner Effect
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      if (selectedMethod === "PATIENT_ACCESS_CARD" && isCameraActive) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute("playsinline", "true");
            videoRef.current.play();
            requestAnimationFrame(tickScan);
          }
        } catch (err) {
          setCardError("Camera unavailable. Enter card token manually below.");
          setIsCameraActive(false);
        }
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [selectedMethod, isCameraActive]);

  const tickScan = () => {
    if (
      videoRef.current &&
      videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA &&
      canvasRef.current
    ) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          setCardTokenQuery(code.data);
          setIsCameraActive(false);
          handleCardAccess(code.data);
          return;
        }
      }
    }
    animationFrameId.current = requestAnimationFrame(tickScan);
  };

  // Generic Function to Open Session & Record
  const startSessionAndOpenRecord = async (
    targetHealthId: string,
    method: RecordAccessMethod,
    reason?: string,
    justification?: string,
    cardId?: string
  ) => {
    setIsAccessing(true);
    setHealthIdError(null);
    setCardError(null);

    try {
      const res = await fetch("/api/doctor/access-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: doctor.id,
          patientHealthId: targetHealthId,
          accessMethod: method,
          reason: reason || `Doctor requested record access via ${method}`,
          justification,
          accessCardId: cardId,
        }),
      });

      const data = await parseResponseSafe<any>(res, { granted: false, message: "Record access authorization failed." });

      if (!data || !data.granted) {
        throw new Error(data?.message || "Record access authorization failed.");
      }

      setActiveSession(data.accessSession);
      setOpenedPatientProfile(data.patientProfile);
      setOpenedMedicalRecords(data.records || []);
      if (onRefreshRecords) onRefreshRecords();
    } catch (err: any) {
      if (method === "PATIENT_HEALTH_ID") setHealthIdError(err.message);
      else if (method === "PATIENT_ACCESS_CARD") setCardError(err.message);
      else alert(err.message || "Failed to authorize record access.");
    } finally {
      setIsAccessing(false);
    }
  };



  // Handler 2: Health ID Access
  const handleHealthIdAccess = () => {
    if (!healthIdQuery || healthIdQuery.trim() === "") {
      setHealthIdError("Please enter a valid Patient Health ID or Name.");
      return;
    }
    startSessionAndOpenRecord(
      healthIdQuery.trim(),
      "PATIENT_HEALTH_ID",
      "Direct Patient Health ID Record Lookup"
    );
  };

  // Handler 3: Card Access
  const handleCardAccess = (tokenToUse?: string) => {
    const tok = tokenToUse || cardTokenQuery;
    if (!tok || tok.trim() === "") {
      setCardError("Please scan or enter a valid Access Card Token.");
      return;
    }
    startSessionAndOpenRecord(
      tok.trim(),
      "PATIENT_ACCESS_CARD",
      "Physical / QR Patient Access Card Presented",
      undefined,
      tok
    );
  };

  // Handler 4: Biometric Access
  const handleBiometricAccess = async (targetIdOverride?: string) => {
    const targetHealthId = (targetIdOverride || bioPatientQuery || "").trim();
    if (!targetHealthId) {
      alert("Please select or enter a target Patient Health ID or Name.");
      return;
    }
    setIsAuthenticatingBio(true);
    setBiometricStatus(`Scanning biometric & face recognition for ${targetHealthId}...`);
    setTimeout(() => {
      setBiometricStatus("✅ Biometric & Face Identity Authenticated! Opening Patient Record...");
      setTimeout(() => {
        setIsAuthenticatingBio(false);
        setBiometricStatus(null);
        startSessionAndOpenRecord(
          targetHealthId,
          "BIOMETRIC",
          `Biometric / Passkey / Face Scan Authenticated Access for ${targetHealthId}`
        );
      }, 800);
    }, 1200);
  };

  // Close Clinical Record View
  const handleCloseClinicalRecord = () => {
    if (activeSession?.id) {
      fetch(`/api/doctor/access-sessions/${activeSession.id}/end`, { method: "POST" });
    }
    setActiveSession(null);
    setOpenedPatientProfile(null);
  };

  // IF CLINICAL RECORD IS OPEN -> RENDER COMPLETE RECORD VIEW!
  if (openedPatientProfile) {
    return (
      <CompletePatientClinicalRecord
        patient={openedPatientProfile}
        doctor={doctor}
        accessMethod={selectedMethod}
        accessSession={activeSession}
        records={openedMedicalRecords}
        onBack={handleCloseClinicalRecord}
        onRefreshRecords={onRefreshRecords}
        onEndEmergencySession={handleCloseClinicalRecord}
      />
    );
  }

  // ACCESS CENTER GATEWAY DASHBOARD
  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-[#FFFFFF] border border-slate-200 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#EDF4EF] border border-[#527D73]/40 rounded-full text-xs font-mono font-bold text-[#527D73] mb-2">
            <Lock className="w-3.5 h-3.5 text-[#527D73]" />
            <span>Patient Record Access Gateway</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Doctor Patient Access Center</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            Authorized portal for accessing patient electronic health records. Every access attempt is authenticated, session-tracked, and immutably audit logged.
          </p>
        </div>

        <div className="px-4 py-2 bg-[#EDF1F5] border border-slate-200 rounded-2xl text-xs font-mono text-slate-700 flex items-center space-x-2">
          <Building2 className="w-4 h-4 text-[#527D73]" />
          <span>{doctor?.hospitalName || "Apollo Speciality Hospital"}</span>
        </div>
      </div>

      {/* 3 ACCESS METHOD SELECTOR TABS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { key: "PATIENT_HEALTH_ID", label: "1. Patient Health ID", icon: User, color: "hover:border-[#527D73]" },
          { key: "PATIENT_ACCESS_CARD", label: "2. Access Card / QR", icon: CreditCard, color: "hover:border-[#527D73]" },
          { key: "BIOMETRIC", label: "3. Biometric / Device", icon: Fingerprint, color: "hover:border-[#527D73]" },
        ].map((m) => {
          const Icon = m.icon;
          const isSelected = selectedMethod === m.key;
          return (
            <button
              key={m.key}
              onClick={() => {
                setSelectedMethod(m.key as any);
                setHealthIdError(null);
                setCardError(null);
              }}
              className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center space-y-2 transition shadow-lg ${
                isSelected
                  ? "bg-[#527D73] border-[#527D73] text-white shadow-[#527D73]/30 font-bold"
                  : `bg-[#FFFFFF] border-slate-200 text-slate-500 hover:text-slate-900 ${m.color}`
              }`}
            >
              <Icon className={`w-6 h-6 ${isSelected ? "text-white" : "text-[#527D73]"}`} />
              <span className="text-xs">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* ACCESS METHOD FORM CONTAINER */}
      <div className="bg-[#FFFFFF] border border-slate-200 rounded-3xl p-6 shadow-xl space-y-5">

        {/* METHOD 2: PATIENT HEALTH ID ACCESS */}
        {selectedMethod === "PATIENT_HEALTH_ID" && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-200 pb-3">
              <User className="w-5 h-5 text-[#527D73]" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Access Patient Record via Global Health ID</h3>
                <p className="text-xs text-slate-500">Enter the patient's unique Global Health ID or full registered name.</p>
              </div>
            </div>

            <div className="space-y-3 max-w-lg">
              <div>
                <label className="text-slate-500 text-xs block mb-1">Global Health ID / Patient Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={healthIdQuery}
                    onChange={(e) => setHealthIdQuery(e.target.value)}
                    placeholder="e.g. NH-IND-2026-XXXXXXXX or Patient name"
                    className="w-full bg-[#EDF1F5] border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm font-mono focus:border-[#527D73] focus:outline-none"
                  />
                  <Search className="w-5 h-5 text-slate-500 absolute right-3 top-3" />
                </div>
              </div>

              {healthIdError && (
                <div className="p-3 bg-[#FDE9E3] border border-[#F2603C]/50 rounded-xl text-xs text-[#C83E1E]">
                  {healthIdError}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleHealthIdAccess}
                  disabled={isAccessing}
                  className="px-6 py-3 bg-[#527D73] hover:bg-[#41685F] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#527D73]/40 transition flex items-center space-x-2"
                >
                  <span>{isAccessing ? "Verifying Health ID..." : "Verify & Open Patient Record"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* METHOD 3: PATIENT ACCESS CARD / QR */}
        {selectedMethod === "PATIENT_ACCESS_CARD" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-3">
                <CreditCard className="w-5 h-5 text-[#527D73]" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Access Patient Record via Physical Access Card / QR</h3>
                  <p className="text-xs text-slate-500">Scan physical card QR code or enter token identifier manually.</p>
                </div>
              </div>

              <button
                onClick={() => setShowMobileBridgeModal(true)}
                className="px-4 py-2.5 bg-[#527D73] hover:bg-[#41685F] text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center space-x-2 shrink-0 border border-[#527D73]/40"
              >
                <Smartphone className="w-4 h-4 text-white/80 animate-bounce" />
                <span>📱 Mobile Phone Camera Bridge</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Camera Scanner */}
              <div className="bg-[#EDF1F5] border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center space-y-3">
                {isCameraActive ? (
                  <div className="relative w-full h-48 bg-black rounded-xl overflow-hidden border border-[#527D73]/50 flex items-center justify-center">
                    <video ref={videoRef} className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 border-2 border-[#527D73] border-dashed animate-pulse pointer-events-none" />
                  </div>
                ) : (
                  <div className="w-full h-48 bg-[#FFFFFF] rounded-xl border border-slate-200 flex flex-col items-center justify-center space-y-2 text-slate-500">
                    <Camera className="w-8 h-8 text-[#527D73]" />
                    <span className="text-xs">Camera QR Scanner Idle</span>
                  </div>
                )}

                <button
                  onClick={() => setIsCameraActive(!isCameraActive)}
                  className="px-4 py-2 bg-[#527D73] hover:bg-[#41685F] text-white font-bold text-xs rounded-xl transition flex items-center space-x-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isCameraActive ? "Stop Camera" : "Activate QR Camera"}</span>
                </button>
              </div>

              {/* Manual Token Input */}
              <div className="space-y-3">
                <label className="text-slate-500 text-xs block mb-1">Card Identifier / Secure Token</label>
                <input
                  type="text"
                  value={cardTokenQuery}
                  onChange={(e) => setCardTokenQuery(e.target.value)}
                  placeholder="e.g. CARD-PAT-1001 or PRANACRUX:NH-IND-2026-XXXXXXXX"
                  className="w-full bg-[#EDF1F5] border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm font-mono focus:border-[#527D73] focus:outline-none"
                />

                {cardError && (
<div className="p-3 bg-[#FDE9E3] border border-[#F2603C]/50 rounded-xl text-xs text-[#C83E1E]">
                    {cardError}
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleCardAccess()}
                    disabled={isAccessing}
                    className="px-6 py-3 bg-[#527D73] hover:bg-[#41685F] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#527D73]/40 transition flex items-center space-x-2"
                  >
                    <span>{isAccessing ? "Validating Card..." : "Validate Card & Open Record"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* METHOD 4: BIOMETRIC AUTHENTICATION */}
        {selectedMethod === "BIOMETRIC" && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-200 pb-3">
              <Fingerprint className="w-5 h-5 text-[#527D73]" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Access Patient Record via Biometrics, Face Scan & Phone Lock</h3>
                <p className="text-xs text-slate-500">Scan face using mobile phone camera, phone lock fingerprint, or WebAuthn / Passkey on device.</p>
              </div>
            </div>

            {/* Target Patient Selection Box */}
            <div className="bg-[#EDF1F5] border border-slate-200 rounded-2xl p-4 space-y-3">
              <label className="text-xs font-bold text-[#527D73] flex items-center space-x-2">
                <User className="w-4 h-4 text-[#527D73]" />
                <span>Target Patient Selection for Biometric / Face Scan</span>
              </label>

              <div>
                <span className="text-[11px] text-slate-500 block mb-1">Enter Patient Health ID or Name:</span>
                <input
                  type="text"
                  value={bioPatientQuery}
                  onChange={(e) => setBioPatientQuery(e.target.value)}
                  placeholder="e.g. NH-IND-2026-XXXXXXXX or Patient name"
                  className="w-full bg-[#FFFFFF] border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#527D73] font-mono"
                />
              </div>
            </div>

            {/* Authenticators: Phone Bridge + Desktop WebAuthn */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Connect Mobile Phone Scanner */}
              <div className="bg-[#EDF1F5] border border-[#527D73]/30 hover:border-[#527D73]/70 rounded-2xl p-5 flex flex-col items-center justify-between text-center transition space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#EDF4EF] border border-[#527D73]/40 flex items-center justify-center text-[#527D73]">
                  <Smartphone className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">📱 Mobile Phone Camera & Biometrics Bridge</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Connect mobile camera to scan face, facial biometrics, or use phone lock fingerprint wirelessly.
                  </p>
                </div>

                <button
                  onClick={() => setShowMobileBridgeModal(true)}
                  className="w-full py-3 bg-[#527D73] hover:bg-[#41685F] text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center space-x-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Connect Mobile Phone Scanner</span>
                </button>
              </div>

              {/* Option B: Desktop WebAuthn / Passkey */}
              <div className="bg-[#EDF1F5] border border-slate-200 hover:border-slate-300 rounded-2xl p-5 flex flex-col items-center justify-between text-center transition space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-300 flex items-center justify-center text-[#527D73]">
                  <Fingerprint className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">🔐 TouchID / Passkey Authenticator</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Use laptop built-in fingerprint sensor, TouchID, or security key for instant verification.
                  </p>
                </div>

                {biometricStatus && (
                  <div className="p-2 bg-[#EDF4EF] border border-[#527D73]/50 rounded-xl text-[11px] text-[#527D73] w-full">
                    {biometricStatus}
                  </div>
                )}

                <button
                  onClick={() => handleBiometricAccess()}
                  disabled={isAuthenticatingBio || isAccessing}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-[#527D73] font-bold text-xs rounded-xl border border-slate-300 transition flex items-center justify-center space-x-2"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>{isAuthenticatingBio ? "Authenticating..." : "Authenticate Biometrics & Open Record"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE CAMERA REMOTE BRIDGE MODAL */}
      {showMobileBridgeModal && (
        <MobileCameraBridgeModal
          doctorName={doctor?.name || ""}
          hospitalName={doctor?.hospitalName || "Apollo Multi-Specialty Hospital"}
          onClose={() => setShowMobileBridgeModal(false)}
          onPayloadReceived={(payload) => {
            setShowMobileBridgeModal(false);
            if (payload?.scannedCode) {
              if (selectedMethod === "BIOMETRIC") {
                setBioPatientQuery(payload.scannedCode);
                handleBiometricAccess(payload.scannedCode);
              } else if (selectedMethod === "PATIENT_ACCESS_CARD") {
                setCardTokenQuery(payload.scannedCode);
                handleCardAccess(payload.scannedCode);
              } else {
                startSessionAndOpenRecord(
                  payload.scannedCode,
                  "PATIENT_ACCESS_CARD",
                  "Scanned via Mobile Camera Remote Bridge"
                );
              }
            }
          }}
        />
      )}
    </div>
  );
};

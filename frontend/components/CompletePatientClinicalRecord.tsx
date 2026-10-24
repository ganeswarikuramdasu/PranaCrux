import { EmergencyReportContent } from './EmergencyReportPanel';
import React from "react";
import { PatientProfile, DoctorProfile, MedicalRecord, AccessSession, RecordAccessMethod } from "../types";
import { PatientRecordsTable } from "./PatientRecordsTable";
import { ArrowLeft, ShieldCheck, AlertTriangle, Heart, Phone, LogOut } from "lucide-react";

interface CompletePatientClinicalRecordProps {
  patient: PatientProfile | any;
  doctor: DoctorProfile | any;
  accessMethod: RecordAccessMethod | string;
  accessSession?: AccessSession | any;
  records?: MedicalRecord[];
  onBack?: () => void;
  onRefreshRecords?: () => void;
  onEndEmergencySession?: (sessionId: string) => void;
}

export const CompletePatientClinicalRecord: React.FC<CompletePatientClinicalRecordProps> = ({
  patient, doctor, accessMethod, accessSession, records = [], onBack, onEndEmergencySession,
}) => {
  const reportDetails = accessSession?.emergencyReport?.emergencyDetails;
  const primaryContact = accessSession?.emergencyReport?.contacts?.[0];
  const displayedPatient = { ...patient,
    ...(reportDetails ? { bloodGroup: reportDetails.bloodGroup, allergies: reportDetails.allergies, chronicConditions: reportDetails.criticalConditions } : {}),
    ...(primaryContact ? { emergencyContactName: primaryContact.name, emergencyContactPhone: primaryContact.phone } : {}),
  };
  const latestVitals = [...records].sort((a, b) => (b.date || '').localeCompare(a.date || '')).find(r => r.vitals);
  const emergency = String(accessMethod).includes('EMERGENCY');
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-3">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={18} />Back to patient access</button>
      {emergency && accessSession?.id && onEndEmergencySession && <button
        onClick={() => onEndEmergencySession(accessSession.id)} className="inline-flex items-center gap-2 text-red-700 text-sm"><LogOut size={18} />End emergency session</button>}
    </div>
    <section className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><h2 className="text-2xl font-bold text-slate-900">{patient.name || 'Patient'}</h2>
          <p className="font-mono text-sm text-emerald-700 mt-1">{patient.globalHealthId || patient.patientHealthId}</p></div>
        <span className="rounded-full bg-emerald-50 text-emerald-800 px-4 py-2 text-xs font-semibold inline-flex gap-2 items-center"><ShieldCheck size={16} />Authorized read-only access</span>
      </div>
      <p className="text-sm text-slate-600">Medical records are added and managed by the patient. Access method: {String(accessMethod).replace(/_/g, ' ').toLowerCase()}.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Info icon={<Heart size={18} />} label="Blood group" value={displayedPatient.bloodGroup} />
        <Info icon={<AlertTriangle size={18} />} label="Allergies" value={displayedPatient.allergies?.join(', ')} />
        <Info icon={<Heart size={18} />} label="Conditions" value={displayedPatient.chronicConditions?.join(', ')} />
        <Info icon={<Phone size={18} />} label="Emergency contact" value={[displayedPatient.emergencyContactName, displayedPatient.emergencyContactPhone].filter(Boolean).join(' · ')} />
      </div>
      {latestVitals?.vitals && <div className="rounded-2xl bg-slate-50 p-4"><h3 className="font-semibold text-sm mb-3">Latest patient-recorded vitals · {latestVitals.date}</h3>
        <div className="flex flex-wrap gap-5 text-sm">{Object.entries(latestVitals.vitals).filter(([, v]) => v != null && v !== '').map(([key, value]) =>
          <span key={key}><span className="text-slate-500">{key}: </span>{String(value)}</span>)}</div></div>}
    </section>
    {accessSession?.emergencyReport && <EmergencyReportContent report={accessSession.emergencyReport} />}
    <section className="bg-white border border-slate-200 rounded-3xl p-6">
      <PatientRecordsTable records={records} patients={[patient]} doctorName={doctor?.name || ''} />
      {records.length === 0 && <p className="py-8 text-center text-slate-500">The patient has not added any medical records.</p>}
    </section>
  </div>;
};

const Info = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) =>
  <div className="bg-slate-50 rounded-2xl p-4"><div className="text-slate-500 text-xs flex items-center gap-2">{icon}{label}</div><p className="text-sm font-semibold mt-2">{value || 'Not provided'}</p></div>;

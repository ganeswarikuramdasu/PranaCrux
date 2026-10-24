import React, { useEffect, useState } from 'react';
import { FileHeart, RefreshCw, ArrowUpRight, Phone, ClipboardList } from 'lucide-react';
import { parseResponseSafe } from '../utils/api';
import { CARE_CATEGORIES, CareResult } from './ProactiveCarePanel';

export const EmergencyReportContent = ({ report }: { report: any }) => {
  const details = report.emergencyDetails || {};
  const display = (value: any) => Array.isArray(value) ? value.join(', ') || 'Not provided' : value || 'Not provided';
  return <div className="space-y-5">
    <section className="care-panel space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4"><div><span className="care-eyebrow">Emergency health summary</span><h2>{report.patient?.name || 'Patient'}</h2><p className="text-xs text-slate-500 mt-1">{report.patient?.globalHealthId} · Generated {new Date(report.generatedAt).toLocaleString()}</p></div><span className="care-tag">Patient-managed information</span></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ['Blood group', details.bloodGroup], ['Allergies', details.allergies], ['Existing conditions', details.criticalConditions], ['Primary physician', details.primaryPhysician],
      ].map(([label, value]) => <div key={String(label)} className="care-summary-tile"><span>{String(label)}</span><strong>{display(value)}</strong></div>)}</div>
      <div><h3 className="text-sm font-semibold mb-2">Emergency instructions</h3><p className="whitespace-pre-wrap text-sm text-slate-600 leading-6">{display(details.emergencyNotes)}</p></div>
      {!!details.additionalMedications?.length && <p className="text-sm text-slate-600"><strong>Other medication notes: </strong>{display(details.additionalMedications)}</p>}
      <div><h3 className="text-sm font-semibold mb-3 flex gap-2 items-center"><Phone size={17} />Emergency contacts</h3>
        {!report.contacts?.length ? <p className="text-sm text-slate-500">No emergency contacts saved.</p> : <div className="grid sm:grid-cols-2 gap-3">{report.contacts.map((contact: any, index: number) => <div key={index} className="rounded-xl bg-slate-50 p-3"><p className="font-semibold text-sm">{contact.name}</p><p className="text-xs text-slate-500">{contact.relationship} · {contact.phone}</p></div>)}</div>}</div>
      <div><h3 className="text-sm font-semibold mb-2">Active medications entered by the patient</h3>
        {!report.medications?.length ? <p className="text-sm text-slate-500">No active medications recorded.</p> : <div className="divide-y divide-slate-100">{report.medications.map((med: any, index: number) => <div key={index} className="py-3 text-sm"><strong>{med.name}</strong> · {med.dosage} · {med.frequency}{med.instructions && <p className="text-slate-500 text-xs mt-1">{med.instructions}</p>}</div>)}</div>}</div>
    </section>
    <section className="space-y-4"><div className="flex gap-2 items-center"><ClipboardList size={19} className="text-teal-700" /><h2 className="font-semibold">Combined care-check results</h2></div>
      {(report.analysisSections || []).map((section: any) => <article className="care-panel space-y-4" key={section.category}>
        <div className="flex items-center justify-between flex-wrap gap-2"><h2>{CARE_CATEGORIES.find(c => c.id === section.category)?.label || section.category}</h2>
          <span className="care-tag">{section.state === 'NO_DATA' ? 'No records' : section.state === 'NOT_CHECKED' ? 'Check not run' : section.state === 'OUTDATED' ? 'Source changed — run again' : 'Saved check'}</span></div>
        {section.unreviewedCount > 0 && <p className="text-sm text-amber-800 rounded-xl bg-amber-50 p-3">{section.unreviewedCount} current record(s) were not included in this check.</p>}
        {section.state === 'OUTDATED' && <p className="text-sm text-amber-800">The results below are historical. A reviewed record has changed or been removed.</p>}
        {section.check ? <CareResult check={section.check} /> : <p className="text-sm text-slate-500">{section.state === 'NO_DATA' ? 'No records are available for this category.' : 'Run a check in Proactive AI Care Analysis to include this category.'}</p>}
      </article>)}
    </section>
    <p className="text-xs text-slate-500 leading-5">{report.notice}</p>
  </div>;
};

export const EmergencyReportPanel = ({ patientId, onEditDetails, onRunChecks }: { patientId: string; onEditDetails: () => void; onRunChecks: () => void }) => {
  const [report, setReport] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/patient/care/${encodeURIComponent(patientId)}/emergency-report`);
      const data = await parseResponseSafe<any>(response, null);
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Unable to form the emergency report.'); setReport(data.report);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load report.'); } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [patientId]);
  return <div className="space-y-6">
    <header className="care-section-heading"><div><span className="care-eyebrow">Ready when it matters</span><h1>Emergency report</h1><p>Your Account & Profile emergency details, medications and saved checks, together in one view.</p></div><span className="care-heading-icon"><FileHeart /></span></header>
    <div className="flex flex-wrap gap-3"><button className="care-button-secondary" onClick={onEditDetails}>Edit emergency details<ArrowUpRight size={16} /></button><button className="care-button-secondary" onClick={onRunChecks}>Run care checks<ArrowUpRight size={16} /></button><button className="care-button-secondary" disabled={loading} onClick={refresh}><RefreshCw size={16} />{loading ? 'Refreshing…' : 'Refresh report'}</button></div>
    {error && <p className="care-error" role="alert">{error}</p>}
    {loading ? <p className="care-empty">Forming your report from saved information…</p> : report && <EmergencyReportContent report={report} />}
  </div>;
};

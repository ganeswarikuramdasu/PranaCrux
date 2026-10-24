import React, { useEffect, useState } from 'react';
import { FileText, Plus, Save, X, Pencil, Trash2 } from 'lucide-react';
import { parseResponseSafe } from '../utils/api';
import { recordCategory } from './ProactiveCarePanel';
import { PatientRecordsTable } from './PatientRecordsTable';
const blank = () => ({ title: '', recordType: 'DIAGNOSIS', date: new Date().toLocaleDateString('en-CA'), diagnosis: '', doctorNotes: '' });
export const PatientMedicalRecordsPanel = ({ profile, onChanged }: { profile: any; onChanged?: () => void }) => {
  const [records, setRecords] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null); const [form, setForm] = useState(blank);
  const [attachment, setAttachment] = useState<{ name: string; data: string } | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const patientId = profile.userId || profile.id;
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/patient/records/${encodeURIComponent(patientId)}`); const data = await parseResponseSafe<any>(response, null);
      if (!response.ok || !Array.isArray(data)) throw new Error(data?.message || 'Unable to load medical reports.');
      setRecords(data.filter(record => recordCategory(record) === 'MEDICAL_REPORTS'));
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load records.'); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [patientId]);
  return <div className="space-y-6">
    <header className="care-section-heading"><div><span className="care-eyebrow">Your health story</span><h1>Medical reports</h1><p>Add general health reports, prescriptions and other medical records. These can be selected for a medical-report care check.</p></div><span className="care-heading-icon"><FileText /></span></header>
    <button className="care-button" onClick={() => { setEditing(null); setForm(blank()); setAttachment(null); setShowForm(true); }}><Plus size={17} />Add medical report</button>
    {showForm && <form className="care-panel space-y-4" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(''); setMessage('');
      try {
        const body = { ...form, patientId, recordId: editing?.id, clinicalNotes: form.doctorNotes,
          ...(attachment ? { attachmentDataUrl: attachment.data, fileName: attachment.name } : {}) };
        const response = await fetch(editing ? '/api/medical-records/update' : '/api/patient/add-manual-record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await parseResponseSafe<any>(response, null); if (!response.ok || !data?.success) throw new Error(data?.message || 'Unable to save the medical report.');
        setShowForm(false); setMessage('Medical report saved. You can include it in a care check.'); await load(); onChanged?.();
      } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save report.'); } finally { setBusy(false); }
    }}>
      <div className="flex items-center justify-between"><h2>{editing ? 'Edit your report' : 'Add a report'}</h2><button type="button" aria-label="Close report form" onClick={() => setShowForm(false)}><X size={19} /></button></div>
      <div className="grid md:grid-cols-2 gap-4"><label className="care-field">Title<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
        <label className="care-field">Record type<select aria-label="Record type" value={form.recordType} onChange={event => setForm({ ...form, recordType: event.target.value })}><option value="DIAGNOSIS">General health report</option><option value="PRESCRIPTION">Prescription</option><option value="SURGERY_NOTE">Surgery / discharge note</option><option value="VACCINATION">Vaccination record</option><option value="MANUAL_RECORD">Other medical record</option></select></label>
        <label className="care-field">Report date<input type="date" required value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></label>
        <label className="care-field md:col-span-2">Report findings / summary<textarea required rows={3} value={form.diagnosis} onChange={event => setForm({ ...form, diagnosis: event.target.value })} placeholder="Include the report's findings so care analysis can review them." /></label>
        <label className="care-field md:col-span-2">Additional notes<textarea rows={2} value={form.doctorNotes} onChange={event => setForm({ ...form, doctorNotes: event.target.value })} /></label>
        <label className="care-field md:col-span-2">Attach the report (optional, PDF or image, up to 5 MB)<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={async event => {
          const file = event.target.files?.[0]; setAttachment(null); if (!file) return;
          if (file.size > 5 * 1024 * 1024 || !['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type)) { setError('Choose a PDF or image up to 5 MB.'); event.target.value = ''; return; }
          setReadingFile(true);
          try { const data = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(Error('Unable to read the attachment.')); reader.readAsDataURL(file); }); setAttachment({ name: file.name, data }); setError(''); }
          catch (err) { setError(err instanceof Error ? err.message : 'Unable to read attachment.'); } finally { setReadingFile(false); }
        }} /></label>
      </div><button disabled={busy || readingFile} className="care-button"><Save size={17} />{busy ? 'Saving…' : 'Save medical report'}</button>
    </form>}
    {error && <p className="care-error" role="alert">{error}</p>}{message && <p role="status" className="text-sm text-teal-700">{message}</p>}
    {loading ? <p className="care-empty">Loading your medical reports…</p> : <section className="care-panel space-y-5">
      <PatientRecordsTable records={records} patients={[profile]} doctorName="" />
      {!!records.length && <div className="space-y-2 border-t border-slate-100 pt-4"><h3 className="text-sm font-semibold">Manage your reports</h3>{records.map(record => <div key={record.id} className="flex justify-between gap-3 items-center py-2"><span className="text-sm text-slate-600">{record.title || record.recordType}</span><div className="flex gap-2"><button className="care-button-secondary" onClick={() => { setEditing(record); setForm({ title: record.title || '', recordType: record.recordType, date: record.date || '', diagnosis: record.diagnosis || '', doctorNotes: record.clinicalNotes || record.doctorNotes || '' }); setAttachment(null); setShowForm(true); }}><Pencil size={15} />Edit</button><button disabled={busy} className="care-button-secondary" onClick={async () => {
        if (!window.confirm(`Delete ${record.title || 'this report'}?`)) return; setBusy(true); setError('');
        try { const response = await fetch('/api/medical-records/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId: record.id }) }); const data = await parseResponseSafe<any>(response, null); if (!response.ok || !data?.success) throw new Error(data?.message || 'Unable to delete report.'); await load(); onChanged?.(); }
        catch (err) { setError(err instanceof Error ? err.message : 'Unable to delete report.'); } finally { setBusy(false); }
      }}><Trash2 size={15} />Delete</button></div></div>)}</div>}
    </section>}
  </div>;
};

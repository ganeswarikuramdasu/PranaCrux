import React, { useEffect, useState } from 'react';
import { Pill, Plus, Pencil, Check, X, Save, RefreshCw } from 'lucide-react';
import { parseResponseSafe } from '../utils/api';
const initial = () => ({ medicationName: '', dosage: '', frequency: '', timing: '', route: 'Oral', startDate: new Date().toLocaleDateString('en-CA'), endDate: '', instructions: '' });
export const PatientMedicationsPanel = ({ patientId }: { patientId: string }) => {
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(initial); const [editing, setEditing] = useState<any>(null); const [showForm, setShowForm] = useState(false);
  const [stopping, setStopping] = useState<string | null>(null); const [reason, setReason] = useState('');
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/medications/patient/${encodeURIComponent(patientId)}`); const result = await parseResponseSafe<any>(response, null);
      if (!response.ok || !result?.success) throw new Error(result?.message || 'Unable to load medications.'); setData(result);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load medications.'); } finally { setLoading(false); }
  };
  useEffect(() => { setData(null); void load(); }, [patientId]);
  const mutate = async (url: string, method: string, body: any) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await parseResponseSafe<any>(response, null); if (!response.ok || !result?.success) throw new Error(result?.message || 'Unable to save medication details.');
      setShowForm(false); setEditing(null); setStopping(null); setMessage('Medication details saved. Your emergency report will use the current list.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save medication details.'); } finally { setBusy(false); }
  };
  return <div className="space-y-6">
    <header className="care-section-heading"><div><span className="care-eyebrow">Your daily routine</span><h1>Medications</h1><p>Record medications from your prescription and track your doses. Only you can change this list.</p></div><span className="care-heading-icon"><Pill /></span></header>
    <div className="flex flex-wrap gap-3"><button className="care-button" onClick={() => { setEditing(null); setForm(initial()); setShowForm(true); }}><Plus size={17} />Add medication</button><button className="care-button-secondary" disabled={loading || busy} onClick={load}><RefreshCw size={16} />Refresh list</button></div>
    {error && <p className="care-error" role="alert">{error}</p>}{message && <p className="text-sm text-teal-700" role="status">{message}</p>}
    {showForm && <form className="care-panel space-y-4" onSubmit={event => { event.preventDefault(); void mutate(editing ? `/api/medications/${editing.id}` : '/api/medications', editing ? 'PUT' : 'POST', { ...form, endDate: editing ? form.endDate : form.endDate || null, patientId }); }}>
      <div className="flex items-center justify-between"><h2>{editing ? 'Edit medication details' : 'Add a medication you take'}</h2><button type="button" aria-label="Close medication form" onClick={() => setShowForm(false)}><X size={20} /></button></div>
      <div className="grid md:grid-cols-2 gap-4">{([
        ['medicationName', 'Medication name', 'text'], ['dosage', 'Dose (as prescribed)', 'text'], ['frequency', 'Frequency (as prescribed)', 'text'], ['timing', 'Timing / meals', 'text'], ['startDate', 'Start date', 'date'], ['endDate', 'End date (optional)', 'date'],
      ] as const).map(([key, label, type]) => <label className="care-field" key={key}>{label}<input type={type} required={['medicationName', 'dosage', 'frequency', 'startDate'].includes(key)} readOnly={!!editing && ['medicationName', 'startDate'].includes(key)} value={form[key]} min={key === 'endDate' ? form.startDate : undefined} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
        <label className="care-field md:col-span-2">Instructions<textarea rows={2} value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} /></label>
      </div><button disabled={busy} className="care-button"><Save size={17} />{busy ? 'Saving…' : 'Save medication'}</button>
    </form>}
    {loading ? <p className="care-empty">Loading your medications…</p> : <>
      <div className="grid gap-4 md:grid-cols-3"><div className="care-summary-tile"><span>Active medications</span><strong>{data?.activeMedications?.length || 0}</strong></div><div className="care-summary-tile"><span>Doses logged as taken today</span><strong>{data?.adherenceSummary?.todayTaken || 0}</strong></div><div className="care-summary-tile"><span>History entries</span><strong>{data?.medicationHistory?.length || 0}</strong></div></div>
      {!data?.activeMedications?.length && <div className="care-panel care-empty">No active medications recorded. Add details from your prescription when you are ready.</div>}
      {(data?.activeMedications || []).map((med: any) => <article className="care-panel space-y-4" key={med.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2>{med.medicationName}</h2><p className="text-sm text-slate-500 mt-1">{med.dosage} · {med.frequency}{med.timing ? ` · ${med.timing}` : ''}</p><p className="text-xs text-slate-500 mt-2">{med.startDate}{med.endDate ? ` to ${med.endDate}` : ' · ongoing'}</p></div><span className="care-tag">Patient recorded</span></div>
        {med.instructions && <p className="text-sm text-slate-600">{med.instructions}</p>}
        <div className="flex flex-wrap gap-2">{(['TAKEN', 'MISSED', 'SKIPPED'] as const).map(status => <button disabled={busy} className="care-button-secondary" key={status} onClick={() => mutate('/api/medications/doses/log', 'POST', { patientId, medicationId: med.id, status })}>{status === 'TAKEN' && <Check size={15} />}{status.charAt(0) + status.slice(1).toLowerCase()}</button>)}
          <button disabled={busy} className="care-button-secondary" onClick={() => { setEditing(med); setForm({ ...initial(), ...med, endDate: med.endDate || '' }); setShowForm(true); }}><Pencil size={15} />Edit details</button>
          <button disabled={busy} className="care-button-secondary" onClick={() => { setStopping(med.id); setReason(''); }}>Mark as no longer taking</button>
        </div>
        {stopping === med.id && <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); void mutate(`/api/medications/${med.id}/discontinue`, 'POST', { discontinuationReason: reason }); }}><label className="care-field flex-1">Reason<input required value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for updating your record" /></label><button disabled={busy} className="care-button self-end">Save to history</button><button type="button" className="care-button-secondary self-end" onClick={() => setStopping(null)}>Cancel</button></form>}
      </article>)}
      {!!data?.medicationHistory?.length && <section className="care-panel space-y-3"><h2>Medication history</h2>{data.medicationHistory.map((med: any) => <div key={med.id} className="border-t border-slate-100 pt-3 text-sm"><strong>{med.medicationName}</strong><span className="text-slate-500"> · {med.dosage} · {med.status?.toLowerCase()}</span>{med.discontinuationReason && <p className="text-xs text-slate-500 mt-1">{med.discontinuationReason}</p>}</div>)}</section>}
    </>}
  </div>;
};

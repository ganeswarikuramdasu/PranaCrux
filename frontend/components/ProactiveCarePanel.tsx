import React, { useEffect, useState } from 'react';
import { Activity, FlaskConical, FileText, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';
import { parseResponseSafe } from '../utils/api';

export const CARE_CATEGORIES = [
  { id: 'VITALS', label: 'Vitals', description: 'Your saved readings', icon: Activity, tone: 'sage' },
  { id: 'LAB_REPORTS', label: 'Lab reports', description: 'Tests and diagnostic scans', icon: FlaskConical, tone: 'lavender' },
  { id: 'MEDICAL_REPORTS', label: 'Medical reports', description: 'General health records', icon: FileText, tone: 'sand' },
] as const;
export type CareCategory = typeof CARE_CATEGORIES[number]['id'];
export interface SavedCareCheck { id: string; category: CareCategory; checkedAt: string; recordIds: string[]; result: any; }
export function recordCategory(record: any): CareCategory {
  if (record.recordType === 'VITALS') return 'VITALS';
  return ['LAB_REPORT', 'IMAGING_SCAN'].includes(record.recordType) ? 'LAB_REPORTS' : 'MEDICAL_REPORTS';
}

export const CareResult = ({ check }: { check: SavedCareCheck }) => <div className="care-result space-y-4">
  <div className="flex flex-wrap items-center gap-2 text-xs">
    <span className="care-tag">{check.result.status === 'STABLE' ? 'Screening completed' : check.result.status === 'RECORDED' ? 'Report summary' : check.result.status === 'URGENT' ? 'Priority review suggested' : 'Review suggested'}</span>
    <span className="text-slate-500">{new Date(check.checkedAt).toLocaleString()} · {check.recordIds.length} selected record(s)</span>
    <span className="text-slate-500">{check.result.source === 'GEMINI' ? 'AI-assisted review' : 'Data-based summary'}</span>
  </div>
  {check.result.scope && <p className="text-xs text-slate-500">{check.result.scope}</p>}
  <p className="text-sm leading-7 whitespace-pre-wrap text-slate-700">{String(check.result.assessment || '').replace(/\*\*/g, '').replace(/^#+\s*/gm, '')}</p>
  {(check.result.abnormalities?.length > 0 || check.result.recordsRedFlags?.length > 0) && <div className="rounded-2xl bg-amber-50/70 border border-amber-200/60 p-4 space-y-2">
    <h4 className="font-semibold text-sm text-amber-900">Findings to review</h4>
    {(check.result.abnormalities || []).map((item: any, index: number) => <p className="text-sm text-amber-900" key={index}>{item.name}: {item.value} · {item.advice}</p>)}
    {(check.result.recordsRedFlags || []).map((item: any, index: number) => <p className="text-sm break-words text-amber-900" key={index}>{String(item)}</p>)}
  </div>}
  <p className="text-xs leading-5 text-slate-500">{check.result.notice || 'Automated information support, not a clinical diagnosis.'}</p>
</div>;

export const ProactiveCarePanel = ({ patientId }: { patientId: string }) => {
  const [category, setCategory] = useState<CareCategory>('VITALS');
  const [records, setRecords] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [history, setHistory] = useState<SavedCareCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState<SavedCareCheck | null>(null);
  const [success, setSuccess] = useState('');
  useEffect(() => {
    let live = true;
    setLoading(true); setError(''); setRecords([]); setHistory([]); setCurrent(null);
    Promise.all([
      fetch(`/api/patient/records/${encodeURIComponent(patientId)}`).then(async response => {
        const data = await parseResponseSafe<any>(response, null);
        if (!response.ok || !Array.isArray(data)) throw new Error(data?.message || 'Unable to load your records.'); return data;
      }),
      fetch(`/api/patient/care/${encodeURIComponent(patientId)}/checks`).then(async response => {
        const data = await parseResponseSafe<any>(response, null);
        if (!response.ok || !data?.success) throw new Error(data?.message || 'Unable to load saved checks.'); return data.checks;
      }),
    ]).then(([items, checks]) => { if (live) { setRecords(items); setHistory(checks || []); } })
      .catch(err => { if (live) setError(err.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [patientId]);
  const available = records.filter(record => recordCategory(record) === category).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const latest = current?.category === category ? current : history.find(check => check.category === category);
  return <div className="space-y-6">
    <header className="care-section-heading"><div><span className="care-eyebrow">Understand your health</span><h1>Proactive AI Care Analysis</h1>
      <p>Choose one source, select the records to review, and run a check. Saved results become part of your emergency report.</p></div><span className="care-heading-icon"><Sparkles /></span></header>
    <div className="grid gap-4 md:grid-cols-3" role="radiogroup" aria-label="Analysis source">
      {CARE_CATEGORIES.map(item => <button key={item.id} role="radio" aria-checked={category === item.id} disabled={running}
        onClick={() => { setCategory(item.id); setSelected([]); setCurrent(null); setSuccess(''); setError(''); }}
        className={`care-source ${category === item.id ? 'care-source-selected' : ''}`}>
        <span className={`care-source-icon ${item.tone}`}><item.icon size={23} /></span><strong>{item.label}</strong><span>{item.description}</span>
      </button>)}
    </div>
    <section className="care-panel space-y-4">
      <div className="flex items-center justify-between gap-3"><div><h2>Select records</h2><p className="text-sm text-slate-500">Only the selected category is included in this check.</p></div>
        <span className="care-tag">{selected.length} selected</span></div>
      {loading ? <p className="care-empty">Loading your saved records…</p> : available.length === 0 ? <p className="care-empty">No {CARE_CATEGORIES.find(c => c.id === category)?.label.toLowerCase()} saved yet. Add a record in its section first.</p> :
        <div className="space-y-2 max-h-80 overflow-auto">{available.map(record => <label key={record.id} className="care-record-option">
          <input type="checkbox" disabled={running} checked={selected.includes(record.id)} onChange={event => setSelected(event.target.checked ? [...selected, record.id] : selected.filter(id => id !== record.id))} />
          <span><strong>{record.title || record.testName || record.recordType}</strong><span>{record.date || 'No date provided'}{record.diagnosis ? ` · ${record.diagnosis}` : ''}</span></span>
        </label>)}</div>}
      {error && <p role="alert" className="care-error">{error}</p>}
      {success && <p role="status" className="text-sm text-teal-700 flex items-center gap-2"><CheckCircle2 size={17} />{success}</p>}
      <button onClick={async () => {
        if (!selected.length) return;
        const selectedCategory = category; setRunning(true); setError(''); setSuccess('');
        try {
          const response = await fetch('/api/patient/care/run-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId, category: selectedCategory, recordIds: selected }) });
          const data = await parseResponseSafe<any>(response, null);
          if (!response.ok || !data?.success) throw new Error(data?.message || 'Unable to complete the check.');
          setCurrent(data.check); setHistory(items => [data.check, ...items]); setSuccess('Check saved to your emergency report.');
        } catch (err) { setError(err instanceof Error ? err.message : 'Unable to run check.'); }
        finally { setRunning(false); }
      }} disabled={loading || running || !selected.length} className="care-button"><RefreshCw size={17} className={running ? 'animate-spin' : ''} />{running ? 'Reviewing selected records…' : 'Run check'}</button>
    </section>
    {latest && <section className="care-panel space-y-4"><h2>Latest saved {CARE_CATEGORIES.find(c => c.id === category)?.label.toLowerCase()} check</h2><CareResult check={latest} /></section>}
  </div>;
};

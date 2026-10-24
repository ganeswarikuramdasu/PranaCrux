import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save, Heart } from 'lucide-react';
import { parseResponseSafe } from '../utils/api';

export const EmergencyDetailsEditor = ({ patientId }: { patientId: string }) => {
  const [form, setForm] = useState({ bloodGroup: '', allergies: '', criticalConditions: '', currentMedications: '', emergencyNotes: '', primaryPhysician: '' });
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; relationship: string; phone: string; priority: number }>>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setReady(false); setError('');
    try {
      const response = await fetch(`/api/emergency/patient/${encodeURIComponent(patientId)}/profile`);
      const data = await parseResponseSafe<any>(response, null);
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Unable to load emergency details.');
      const p = data.emergencyProfile || {};
      setForm({ bloodGroup: p.bloodGroup || '', allergies: (p.allergies || []).join(', '), criticalConditions: (p.criticalConditions || []).join(', '), currentMedications: (p.currentMedications || []).join(', '), emergencyNotes: p.emergencyNotes || '', primaryPhysician: p.primaryPhysician || '' });
      setContacts(data.emergencyContacts || []); setReady(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load emergency details.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [patientId]);
  return <form className="care-panel space-y-5" onSubmit={async event => {
    event.preventDefault(); setSaving(true); setMessage(''); setError('');
    const list = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);
    try {
      const response = await fetch(`/api/emergency/patient/${encodeURIComponent(patientId)}/profile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form,
        allergies: list(form.allergies), criticalConditions: list(form.criticalConditions), currentMedications: list(form.currentMedications), contacts: contacts.map((contact, index) => ({ ...contact, priority: index + 1 })) }) });
      const data = await parseResponseSafe<any>(response, null);
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Unable to save emergency details.');
      setMessage('Emergency details saved. Your emergency report will use these details.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save details.'); }
    finally { setSaving(false); }
  }}>
    <div className="flex items-center gap-3"><span className="care-source-icon sage"><Heart size={22} /></span><div><h2>Emergency details</h2><p className="text-sm text-slate-500">Your saved details are the source for your emergency report.</p></div></div>
    {loading ? <p className="care-empty">Loading emergency details…</p> : <>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="care-field">Blood group<select aria-label="Blood group" value={form.bloodGroup} onChange={e => setForm({ ...form, bloodGroup: e.target.value })}>
          <option value="">Not provided</option>{['Unknown','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(group => <option key={group}>{group}</option>)}
        </select></label>
        <label className="care-field">Primary physician<input value={form.primaryPhysician} onChange={e => setForm({ ...form, primaryPhysician: e.target.value })} placeholder="Name and contact, if known" /></label>
        <label className="care-field">Allergies<input value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} placeholder="Separate entries with commas" /></label>
        <label className="care-field">Existing conditions<input value={form.criticalConditions} onChange={e => setForm({ ...form, criticalConditions: e.target.value })} placeholder="Separate entries with commas" /></label>
        <label className="care-field md:col-span-2">Other medication notes<input value={form.currentMedications} onChange={e => setForm({ ...form, currentMedications: e.target.value })} placeholder="Optional notes; manage your medication list in Medications" /></label>
        <label className="care-field md:col-span-2">Emergency instructions<textarea rows={3} value={form.emergencyNotes} onChange={e => setForm({ ...form, emergencyNotes: e.target.value })} placeholder="Information a doctor should know during an emergency" /></label>
      </div>
      <div className="flex justify-between items-center"><h3 className="font-semibold text-sm">Emergency contacts</h3><button type="button" className="care-button-secondary" onClick={() => setContacts([...contacts, { id: `contact_${Date.now()}`, name: '', phone: '', relationship: '', priority: contacts.length + 1 }])}><Plus size={16} />Add contact</button></div>
      {!contacts.length && <p className="text-sm text-slate-500">No emergency contacts saved.</p>}
      {contacts.map((contact, index) => <div key={contact.id} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] items-end rounded-2xl bg-slate-50 p-4">
        {(['name', 'relationship', 'phone'] as const).map(field => <label key={field} className="care-field">{field === 'phone' ? 'Phone' : field === 'name' ? 'Name' : 'Relationship'}<input required={field !== 'relationship'} type={field === 'phone' ? 'tel' : 'text'} value={contact[field]}
          onChange={event => setContacts(contacts.map((item, i) => i === index ? { ...item, [field]: event.target.value } : item))} /></label>)}
        <button type="button" aria-label={`Remove contact ${index + 1}`} className="care-button-secondary" onClick={() => setContacts(contacts.filter((_, i) => i !== index))}><Trash2 size={17} /></button>
      </div>)}
    </>}
    {error && <p className="care-error" role="alert">{error}{loading === false && <button type="button" className="underline ml-2" onClick={load}>Reload details</button>}</p>}
    {message && <p className="text-sm text-teal-700" role="status">{message}</p>}
    <button disabled={!ready || loading || saving} className="care-button"><Save size={17} />{saving ? 'Saving…' : 'Save emergency details'}</button>
  </form>;
};

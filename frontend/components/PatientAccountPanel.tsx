import React, { useEffect, useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { EmergencyDetailsEditor } from './EmergencyDetailsEditor';
import { parseResponseSafe } from '../utils/api';
export const PatientAccountPanel = ({ profile }: { profile: any }) => {
  const [form, setForm] = useState({ name: profile.name || '', email: profile.email || '', phone: profile.phone || '', dob: profile.dob || '', gender: profile.gender || '', heightCm: profile.heightCm || '', weightKg: profile.weightKg || '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => {
    let live = true;
    fetch(`/api/patient/profile/${encodeURIComponent(profile.userId || profile.id)}`).then(async response => {
      if (!response.ok) return; const p = await response.json();
      if (live && p?.userId) setForm(f => ({ ...f, name: p.name || '', email: p.email || '', phone: p.phone || '', dob: p.dob || '', gender: p.gender || '', heightCm: p.heightCm ?? '', weightKg: p.weightKg ?? '' }));
    }).catch(() => {});
    return () => { live = false; };
  }, [profile.userId, profile.id]);
  return <div className="space-y-6">
    <header className="care-section-heading"><div><span className="care-eyebrow">A profile that stays current</span><h1>Account & Profile</h1><p>Manage your personal information and the emergency details used in your emergency report.</p></div><span className="care-heading-icon"><Settings /></span></header>
    <form className="care-panel space-y-5" onSubmit={async event => {
      event.preventDefault(); setError(''); setMessage('');
      if (form.newPassword !== form.confirmPassword) { setError('The new passwords do not match.'); return; }
      setBusy(true);
      try {
        const response = await fetch('/api/auth/update-profile-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: profile.userId || profile.id, name: form.name, phone: form.phone, dob: form.dob || undefined, gender: form.gender || undefined,
          heightCm: form.heightCm !== '' ? Number(form.heightCm) : undefined, weightKg: form.weightKg !== '' ? Number(form.weightKg) : undefined,
          currentPassword: form.newPassword ? form.currentPassword : undefined, newPassword: form.newPassword || undefined }) });
        const data = await parseResponseSafe<any>(response, null); if (!response.ok || !data?.success) throw new Error(data?.message || 'Unable to save account details.');
        setForm(f => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' })); setMessage('Personal information saved.');
      } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save account details.'); } finally { setBusy(false); }
    }}>
      <h2>Personal information</h2><div className="grid gap-4 md:grid-cols-2">
        {([['name', 'Full name', 'text'], ['email', 'Email address', 'email'], ['phone', 'Phone number', 'tel'], ['dob', 'Date of birth', 'date'], ['heightCm', 'Height (cm)', 'number'], ['weightKg', 'Weight (kg)', 'number']] as const).map(([key, label, type]) => <label className="care-field" key={key}>{label}<input type={type} readOnly={key === 'email'} required={key === 'name' || key === 'phone'} min={type === 'number' ? 1 : undefined} step={type === 'number' ? '0.1' : undefined} max={key === 'dob' ? new Date().toLocaleDateString('en-CA') : undefined} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} /></label>)}
        <label className="care-field">Gender<select value={form.gender} onChange={event => setForm({ ...form, gender: event.target.value })}><option value="">Not provided</option><option>Female</option><option>Male</option><option>Other</option></select></label>
      </div>
      <details className="border-t border-slate-100 pt-4"><summary className="text-sm font-medium text-slate-600 cursor-pointer">Change password (optional)</summary><div className="grid md:grid-cols-3 gap-4 mt-4">{([['currentPassword', 'Current password'], ['newPassword', 'New password'], ['confirmPassword', 'Confirm new password']] as const).map(([key, label]) => <label className="care-field" key={key}>{label}<input type="password" value={form[key]} autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'} onChange={event => setForm({ ...form, [key]: event.target.value })} /></label>)}</div></details>
      {error && <p role="alert" className="care-error">{error}</p>}{message && <p role="status" className="text-sm text-teal-700">{message}</p>}
      <button disabled={busy} className="care-button"><Save size={17} />{busy ? 'Saving…' : 'Save personal information'}</button>
    </form>
    <EmergencyDetailsEditor patientId={profile.userId || profile.id} />
  </div>;
};

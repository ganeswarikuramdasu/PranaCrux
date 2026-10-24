import React, { useEffect, useState } from "react";
import { DoctorProfile } from "../types";
import { parseResponseSafe } from "../utils/api";
import { Save, ShieldCheck, User } from "lucide-react";

interface DoctorProfileSettingsProps {
  doctor: DoctorProfile;
  onUpdateDoctor: (updated: DoctorProfile) => void;
}

export const DoctorProfileSettings: React.FC<DoctorProfileSettingsProps> = ({ doctor, onUpdateDoctor }) => {
  const [profile, setProfile] = useState(doctor);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => { setProfile(doctor); }, [doctor]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setMessage(""); setError(false);
    try {
      const response = await fetch(`/api/doctors/${doctor.id}/profile`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name, email: profile.email, phone: profile.phone,
          qualification: profile.qualification, experienceYears: profile.experienceYears, bio: profile.bio }),
      });
      const data = await parseResponseSafe<any>(response, { success: false, message: "Unable to save profile." });
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to save profile.");
      onUpdateDoctor(data.doctor); setProfile(data.doctor); setMessage("Profile saved successfully.");
    } catch (err) { setError(true); setMessage(err instanceof Error ? err.message : "Unable to save profile."); }
    finally { setSaving(false); }
  };

  return <form onSubmit={save} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6">
    <h2 className="text-xl font-bold flex items-center gap-2"><User className="text-emerald-600" />Doctor profile</h2>
    <div className="rounded-xl bg-emerald-50 text-emerald-800 p-4 text-sm flex items-center gap-2">
      <ShieldCheck size={20} />Patient medical records are managed by patients. Your authorized access is read-only.
    </div>
    <div className="grid md:grid-cols-2 gap-5">
      {([['name', 'Full name'], ['email', 'Email'], ['phone', 'Phone'], ['qualification', 'Qualification']] as const).map(([key, label]) =>
        <label key={key} className="text-sm font-medium space-y-2">{label}<input required={key === 'name' || key === 'email'}
          type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={profile[key] || ''}
          onChange={e => setProfile({ ...profile, [key]: e.target.value })}
          className="block w-full rounded-xl border border-slate-300 p-3" /></label>)}
      <label className="text-sm font-medium space-y-2">Experience (years)<input type="number" min="0" max="80"
        value={profile.experienceYears ?? 0} onChange={e => setProfile({ ...profile, experienceYears: Number(e.target.value) })}
        className="block w-full rounded-xl border border-slate-300 p-3" /></label>
      <div className="text-sm text-slate-600 p-3">Specialization: {doctor.specialization || 'Not provided'}<br />License: {doctor.licenseNumber || 'Not provided'}</div>
    </div>
    <label className="block text-sm font-medium">Professional bio<textarea value={profile.bio || ''}
      onChange={e => setProfile({ ...profile, bio: e.target.value })} rows={4} className="block w-full mt-2 rounded-xl border border-slate-300 p-3" /></label>
    {message && <p role="status" className={error ? 'text-red-700' : 'text-emerald-700'}>{message}</p>}
    <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold disabled:opacity-50"><Save size={18} />{saving ? 'Saving…' : 'Save profile'}</button>
  </form>;
};

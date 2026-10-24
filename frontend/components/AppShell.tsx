import React, { useEffect, useRef, useState } from 'react';
import { UserRole } from '../types';
import { LogOut, ChevronDown, ChevronRight, HeartPulse, Shield, LayoutDashboard, FolderHeart, Sparkles, ShieldCheck } from 'lucide-react';
export interface NavItem { id: string; label: string; icon: React.ComponentType<{ className?: string }>; count?: number; badge?: string; }
interface AppShellProps {
  user: { id: string; name: string; email: string; role: UserRole; globalHealthId?: string };
  roleLabel?: string; navItems: NavItem[]; active: string; onSelect: (id: string) => void;
  onLogout: () => void; onGoToHome?: () => void; subtitle?: string; children: React.ReactNode; supportAction?: React.ReactNode;
}
const GROUPS = [
  { id: 'records', title: 'Records', icon: FolderHeart, ids: ['RECORDS', 'LAB_REPORTS', 'VITALS_ANALYTICS', 'MEDICATIONS'], description: 'Your health information' },
  { id: 'care', title: 'Care & insights', icon: Sparkles, ids: ['CARE_ANALYSIS', 'AI_ASSISTANT', 'EMERGENCY_PROFILE'], description: 'Checks, guidance and emergency readiness' },
  { id: 'privacy', title: 'Access & privacy', icon: ShieldCheck, ids: ['AUDIT_LOGS'], description: 'Your record access history' },
];
const ROLE_GROUPS: Record<string, typeof GROUPS> = {
  DOCTOR: [
    { id: 'clinical', title: 'Patient care', icon: FolderHeart, ids: ['PATIENT_ACCESS', 'EMERGENCY_ACCESS', 'PATIENT_RECORDS_TABLE'], description: 'Authorized records and emergency access' },
    { id: 'activity', title: 'Activity & support', icon: ShieldCheck, ids: ['ACCESS_HISTORY', 'COMPLAINTS'], description: 'Access history and support' },
  ],
  HOSPITAL_ADMIN: [
    { id: 'operations', title: 'Hospital', icon: FolderHeart, ids: ['ROSTER', 'DEPARTMENTS', 'PATIENT_RECORDS'], description: 'Doctors, departments and records' },
    { id: 'oversight', title: 'Oversight', icon: ShieldCheck, ids: ['AUDIT_LOGS', 'COMPLAINTS'], description: 'Access activity and complaints' },
  ],
  SUPER_ADMIN: [
    { id: 'network', title: 'Network', icon: FolderHeart, ids: ['HOSPITALS', 'DOCTORS', 'PATIENTS', 'RECORDS'], description: 'Registrations and medical records' },
    { id: 'governance', title: 'Governance', icon: ShieldCheck, ids: ['AUDIT_LOGS', 'COMPLAINTS', 'MALPRACTICES'], description: 'Access history, complaints and conduct' },
  ],
};
export const AppShell: React.FC<AppShellProps> = ({ user, roleLabel, navItems, active, onSelect, onLogout, onGoToHome, subtitle, children, supportAction }) => {
  const [menu, setMenu] = useState<string | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const headerRef = useRef<HTMLElement>(null);
  const activeLabel = navItems.find(item => item.id === active)?.label || (active === 'COMPLAINTS' ? 'Complaints' : subtitle);
  const groups = user.role === 'PATIENT' ? GROUPS : (ROLE_GROUPS[user.role] || []);
  const activeGroup = groups.find(group => group.ids.includes(active));
  const select = (id: string) => { onSelect(id); setMenu(null); };
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null); };
    const outside = (event: PointerEvent) => { if (!headerRef.current?.contains(event.target as Node)) setMenu(null); };
    const resize = () => setMenu(null);
    document.addEventListener('keydown', close); document.addEventListener('pointerdown', outside); window.addEventListener('resize', resize);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); };
  }, []);
  const selectedMenu = groups.find(group => group.id === menu);
  return <div className={`care-workspace min-h-screen text-slate-800 ${user.role !== 'PATIENT' ? 'care-professional-workspace' : ''}`}>
    <header className="care-product-header" ref={headerRef}>
      <div className="care-product-topline">
        <button onClick={onGoToHome} className="flex items-center gap-2.5 shrink-0" aria-label="PranaCrux home"><span className="care-brand-mark"><HeartPulse size={21} /></span><span className="text-[18px] font-semibold tracking-tight text-slate-900">PranaCrux</span></button>
        <span className="care-portal-label">{subtitle || 'Health workspace'}</span>
        <div className="care-product-account"><span className="care-topbar-identity hidden md:inline-flex"><Shield size={13} />{user.globalHealthId || roleLabel || 'Health workspace'}</span><span className="care-account-divider hidden sm:block" /><span className="care-avatar">{user.name?.charAt(0) || 'P'}</span><div className="hidden sm:block max-w-36"><strong className="block truncate text-xs font-semibold">{user.name}</strong><span className="block text-[10px] text-slate-500 truncate mt-0.5">{user.email}</span></div>{supportAction && <div className="care-mobile-support">{supportAction}</div>}<button onClick={onLogout} title="Sign out" aria-label="Sign out" className="care-icon-button"><LogOut size={17} /></button></div>
      </div>
      <div className="care-product-navline"><nav className="care-top-navigation" aria-label="Main navigation">
        {<>
          <button aria-label="Dashboard" aria-current={active === 'DASHBOARD' ? 'page' : undefined} className={`care-top-navitem ${active === 'DASHBOARD' ? 'is-active' : ''}`} onClick={() => select('DASHBOARD')}><LayoutDashboard size={16} />Overview</button>
          {groups.map(group => <button key={group.id} className={`care-top-navitem ${group.ids.includes(active) || menu === group.id ? 'is-active' : ''}`} aria-haspopup="menu" aria-expanded={menu === group.id} aria-controls={`navigation-${group.id}`}
            onClick={event => { const box = event.currentTarget.getBoundingClientRect(); setPosition({ left: Math.min(box.left, window.innerWidth - 310), top: box.bottom + 7 }); setMenu(menu === group.id ? null : group.id); }}><group.icon size={16} /><span>{group.title}</span><ChevronDown size={13} /></button>)}
          {navItems.filter(item => !groups.some(group => group.ids.includes(item.id)) && item.id !== 'DASHBOARD').map(item => <button key={item.id} aria-label={item.label} aria-current={active === item.id ? 'page' : undefined} className={`care-top-navitem ${active === item.id ? 'is-active' : ''}`} onClick={() => select(item.id)}><item.icon className="w-4 h-4" /><span>{item.id === 'ACCOUNT' ? 'Account' : item.label}</span></button>)}
        </>}
      </nav><span className="hidden xl:block text-[10px] text-slate-400 whitespace-nowrap">{user.role === 'PATIENT' ? 'Your health, in your hands' : 'PranaCrux workspace'}</span></div>
      {selectedMenu && <div id={`navigation-${selectedMenu.id}`} role="menu" aria-label={selectedMenu.title} className="care-navigation-popover" style={position}><div className="care-navigation-popover-heading"><strong>{selectedMenu.title}</strong><p>{selectedMenu.description}</p></div>{selectedMenu.ids.flatMap(id => navItems.filter(item => item.id === id)).map(item => <button role="menuitem" key={item.id} onClick={() => select(item.id)} className={`care-navigation-menuitem ${active === item.id ? 'is-active' : ''}`}><item.icon className="w-[17px] h-[17px]" /><span>{item.label}</span><ChevronRight size={14} /></button>)}</div>}
    </header>
    <div className="care-workspace-body min-h-screen flex flex-col">
      <main className="care-main flex-1 w-full mx-auto space-y-6 min-w-0"><div className="care-page-location"><span>{activeGroup?.title || subtitle || 'Workspace'}</span><ChevronRight size={12} /><span>{activeLabel}</span></div>{children}</main>
      <footer className="care-workspace-footer">PranaCrux <span>·</span> Personal health records</footer>
    </div>
    {supportAction && <div className="care-support-dock">{supportAction}</div>}
  </div>;
};

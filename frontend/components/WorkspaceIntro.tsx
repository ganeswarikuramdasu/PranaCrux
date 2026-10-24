import React from 'react';
interface WorkspaceIntroProps { eyebrow: string; title: string; description: string; children?: React.ReactNode; }
export function WorkspaceIntro({ eyebrow, title, description, children }: WorkspaceIntroProps) {
  return <section className="care-workspace-intro"><div><p className="care-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="care-workspace-description">{description}</p></div>{children && <div className="care-workspace-actions">{children}</div>}</section>;
}

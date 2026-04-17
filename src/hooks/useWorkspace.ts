import { useEffect, useState } from 'react';
import { getWorkspaceProfile, type WorkspaceProfile } from '../api/workspace';

// Module-level cache so the first mount's fetch is shared across every caller.
let cached: WorkspaceProfile | null = null;
let inflight: Promise<WorkspaceProfile> | null = null;
const listeners = new Set<(p: WorkspaceProfile) => void>();

function applyToDocument(p: WorkspaceProfile) {
  if (typeof document === 'undefined') return;
  document.title = p.title;
  const href = p.logoUrl || '/logo.webp';
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

function load(): Promise<WorkspaceProfile> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = getWorkspaceProfile().then(p => {
    cached = p;
    inflight = null;
    applyToDocument(p);
    listeners.forEach(fn => fn(p));
    return p;
  });
  return inflight;
}

const DEFAULT: WorkspaceProfile = { title: 'Memos' };

export function useWorkspace(): WorkspaceProfile {
  const [profile, setProfile] = useState<WorkspaceProfile>(cached ?? DEFAULT);

  useEffect(() => {
    let alive = true;
    if (!cached) {
      load().then(p => { if (alive) setProfile(p); });
    }
    const listener = (p: WorkspaceProfile) => { if (alive) setProfile(p); };
    listeners.add(listener);
    return () => { alive = false; listeners.delete(listener); };
  }, []);

  return profile;
}

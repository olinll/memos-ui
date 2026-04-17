export interface WorkspaceProfile {
  title: string;
  description?: string;
  logoUrl?: string;
}

type Json = Record<string, unknown>;

async function rpc(service: string, method: string, body: Json = {}): Promise<Json> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`/memos.api.v1.${service}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${service}/${method}: ${res.status}`);
  return res.json();
}

// The server expects the prefix `instance/settings/` (singular, no id).
const SETTING_NAME_CANDIDATES = [
  'instance/settings/GENERAL',
  'instance/settings/general',
];

function extractCustom(data: Json | null | undefined): Partial<WorkspaceProfile> {
  if (!data) return {};
  const general = (data.generalSetting ?? data.general ?? data) as Json;
  const custom = (general?.customProfile ?? general?.custom_profile ?? {}) as Json;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return {
    title: str(custom.title),
    description: str(custom.description),
    logoUrl: str(custom.logoUrl) ?? str(custom.logo_url),
  };
}

export async function getWorkspaceProfile(): Promise<WorkspaceProfile> {
  // InstanceProfile sometimes exposes an instance-level title on its own.
  let profileTitle: string | undefined;
  try {
    const p = await rpc('InstanceService', 'GetInstanceProfile');
    const t = (p.title ?? p.name ?? p.displayName) as unknown;
    if (typeof t === 'string') profileTitle = t;
  } catch {
    // ignore — try setting next
  }

  // Walk through the name variants until one returns something usable.
  for (const name of SETTING_NAME_CANDIDATES) {
    try {
      const s = await rpc('InstanceService', 'GetInstanceSetting', { name });
      const picked = extractCustom(s);
      if (picked.title || picked.logoUrl) {
        return {
          title: picked.title || profileTitle || 'Memos',
          description: picked.description,
          logoUrl: picked.logoUrl,
        };
      }
    } catch {
      // try next
    }
  }

  return { title: profileTitle || 'Memos' };
}

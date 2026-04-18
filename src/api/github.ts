// Thin wrapper over the GitHub REST API covering only what the diary feature
// needs: read a file, list a directory, and commit multiple files atomically
// via the Git Data API (blobs → tree → commit → ref).

import { DIARY_CONFIG, getGithubToken } from '../config/diary';

const API_BASE = 'https://api.github.com';

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  const token = getGithubToken();
  if (!token) throw new Error('未配置 VITE_GITHUB_TOKEN');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
}

async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // Surface GitHub's human message when present: `{"message":"...","status":"..."}`
    let msg = text;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j && typeof j.message === 'string') msg = j.message;
    } catch { /* keep raw text */ }
    throw new Error(`GitHub ${init.method ?? 'GET'} ${path} → ${res.status} ${msg}`);
  }
  return res.json() as Promise<T>;
}

function repoPath(): string {
  return `/repos/${DIARY_CONFIG.repo}`;
}

// ---------- reads ----------

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  size: number;
}

export async function getFileText(path: string, ref = DIARY_CONFIG.branch): Promise<string> {
  // raw media type returns the file body directly — avoids base64 round-trip.
  const res = await fetch(`${API_BASE}${repoPath()}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`, {
    headers: authHeaders({ Accept: 'application/vnd.github.raw' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`读取 ${path} 失败: ${res.status} ${text}`);
  }
  return res.text();
}

export async function listDir(path: string, ref = DIARY_CONFIG.branch): Promise<FileEntry[]> {
  try {
    const res = await gh<FileEntry[] | FileEntry>(`${repoPath()}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`);
    return Array.isArray(res) ? res : [res];
  } catch (e) {
    // 404 on an empty/non-existent directory is expected on first run.
    if (e instanceof Error && /\b404\b/.test(e.message)) return [];
    throw e;
  }
}

// ---------- atomic commit ----------

export interface CommitFile {
  path: string; // repo-relative
  // Exactly one of `text`, `base64`, or `delete: true` must be set.
  text?: string;
  base64?: string;
  delete?: boolean; // tree entry with sha: null removes the file
}

interface RefResponse { object: { sha: string; type: string } }
interface CommitResponse { sha: string; tree: { sha: string } }
interface BlobResponse { sha: string }
interface TreeResponse { sha: string }

export interface CommitResult {
  sha: string;    // branch tip sha after the call (new commit sha, or current tip if no-op)
  changed: boolean;
}

// Commits multiple files in a single atomic commit on DIARY_CONFIG.branch.
// Normally the ref update is a clean fast-forward. If GitHub keeps rejecting
// with 422 even when the ref hasn't moved (observed on edits that produce a
// no-op-ish tree), fall back to force=true — safe for a single-writer repo.
export async function commitFiles(files: CommitFile[], message: string): Promise<CommitResult> {
  const delays = [0, 300, 800, 1800, 3500];
  let lastErr: unknown;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
    const force = i >= 2;
    try {
      return await commitOnce(files, message, i, force);
    } catch (e) {
      lastErr = e;
      if (!(e instanceof Error) || !/\b422\b/.test(e.message)) throw e;
      console.warn(`[github] commit attempt ${i + 1} (force=${force}) hit 422, retrying`);
    }
  }
  throw lastErr;
}

async function commitOnce(files: CommitFile[], message: string, attempt = 0, force = false): Promise<CommitResult> {
  const branch = DIARY_CONFIG.branch;
  const refPath = `${repoPath()}/git/ref/heads/${encodeURIComponent(branch)}`;
  const ref = await gh<RefResponse>(refPath);
  const parentSha = ref.object.sha;

  const parentCommit = await gh<CommitResponse>(`${repoPath()}/git/commits/${parentSha}`);
  const baseTreeSha = parentCommit.tree.sha;

  // Deletes go in as tree entries with sha: null — no blob upload needed.
  const treeEntries = await Promise.all(files.map(async (f): Promise<{
    path: string; mode: '100644'; type: 'blob'; sha: string | null;
  }> => {
    if (f.delete) {
      return { path: f.path, mode: '100644', type: 'blob', sha: null };
    }
    const blob = await createBlob(f);
    return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
  }));

  const tree = await gh<TreeResponse>(`${repoPath()}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });

  const isNoop = tree.sha === baseTreeSha;
  console.log(
    `[github] attempt ${attempt + 1}: parent=${parentSha.slice(0, 7)} parentTree=${baseTreeSha.slice(0, 7)} newTree=${tree.sha.slice(0, 7)} force=${force} noop=${isNoop}`
  );
  if (isNoop) {
    console.warn('[github] skipping commit: tree matches parent (no changes)');
    return { sha: parentSha, changed: false };
  }

  const commit = await gh<CommitResponse>(`${repoPath()}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
  });

  await gh<RefResponse>(`${repoPath()}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha, force }),
  });

  return { sha: commit.sha, changed: true };
}

async function createBlob(file: CommitFile): Promise<BlobResponse> {
  const body = file.base64 !== undefined
    ? { content: file.base64, encoding: 'base64' }
    : { content: file.text ?? '', encoding: 'utf-8' };
  return gh<BlobResponse>(`${repoPath()}/git/blobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

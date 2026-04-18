// Diary CRUD — the glue between the parser, the image converter, and GitHub.
// Every mutation goes through a single atomic commit so data/diary.ts and
// the image files land together.

import { DIARY_CONFIG, resolveImageUrl } from '../config/diary';
import {
  parseDiary, serializeDiary, nextId,
  type DiaryFile, type DiaryItem,
} from '../lib/diaryParser';
import { convertToWebp, blobToBase64 } from '../lib/imageToWebp';
import { commitFiles, getFileText, type CommitFile } from './github';
import { createMemo, updateMemo, listMemos, uploadAttachment, deleteAttachment } from './memos';
import type { Attachment, Memo } from '../types';

export type { DiaryItem };

export interface DiaryState {
  file: DiaryFile;
  items: DiaryItem[]; // sorted date desc, then id desc
}

export interface SaveResult {
  state: DiaryState;
  changed: boolean;
}

export interface DiaryInput {
  id?: number; // omit for new
  content: string;
  date: string;
  location?: string;
  mood?: string;
  tags?: string[];
  existingImages: string[]; // URLs kept from the current entry
  newImages: File[]; // to convert → upload
}

export async function loadDiary(): Promise<DiaryState> {
  // After a write, GitHub's contents CDN may return stale bytes for the branch
  // tip for a few seconds. Pin reads to the commit sha we know we produced —
  // that endpoint is by immutable ref, so it's guaranteed fresh.
  const ref = getPinnedRef() ?? DIARY_CONFIG.branch;
  const source = await getFileText(DIARY_CONFIG.dataPath, ref);
  const file = parseDiary(source);
  return { file, items: sortItems(file.items) };
}

const PIN_KEY = 'diary:pinnedRef';

function getPinnedRef(): string | undefined {
  try { return sessionStorage.getItem(PIN_KEY) || undefined; } catch { return undefined; }
}

function setPinnedRef(sha: string): void {
  try { sessionStorage.setItem(PIN_KEY, sha); } catch { /* ignore */ }
}

export async function saveEntry(state: DiaryState, input: DiaryInput): Promise<SaveResult> {
  const isNew = input.id === undefined;
  const id = isNew ? nextId(state.file.items) : input.id!;

  // Convert new images client-side and mint unique filenames scoped to this entry.
  const datePart = dateSlug(input.date);
  let seq = maxSeqFor(input.existingImages, datePart, id);
  const imageFiles: CommitFile[] = [];
  const newImageUrls: string[] = [];
  for (const f of input.newImages) {
    seq++;
    const filename = `${datePart}-${id}-${seq}.webp`;
    const webp = await convertToWebp(f);
    const base64 = await blobToBase64(webp);
    imageFiles.push({
      path: `${DIARY_CONFIG.imageDir}/${filename}`,
      base64,
    });
    newImageUrls.push(`${DIARY_CONFIG.imageUrlPrefix}/${filename}`);
  }

  const images = [...input.existingImages, ...newImageUrls];

  // Images that were in the previous version but the user dropped get deleted
  // from the repo in the same commit.
  const original = isNew ? undefined : state.file.items.find(it => it.id === id);
  const removedImageUrls = (original?.images ?? []).filter(u => !input.existingImages.includes(u));
  const deleteFiles: CommitFile[] = removedImageUrls
    .map(urlToRepoPath)
    .filter((p): p is string => p !== null)
    .map(path => ({ path, delete: true }));

  const nextItem: DiaryItem = {
    id,
    content: input.content,
    date: input.date,
    ...(images.length > 0 ? { images } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.mood ? { mood: input.mood } : {}),
    ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
  };

  const merged = isNew
    ? [...state.file.items, nextItem]
    : state.file.items.map(it => it.id === id ? nextItem : it);

  // Renumber so IDs follow chronological order (earliest = 1). Image filenames
  // still carry the old ID — that's fine, they're just historical file names.
  const nextItems = renumberByDate(merged);

  const nextSource = serializeDiary(state.file, nextItems);

  const dataFile: CommitFile = { path: DIARY_CONFIG.dataPath, text: nextSource };
  const message = `日记：${isNew ? '新增' : '更新'}第 ${id} 篇`;
  const allFiles = [dataFile, ...imageFiles, ...deleteFiles];
  console.log('[diary] committing', {
    message,
    files: allFiles.map(f => (f.delete ? `- ${f.path}` : f.path)),
  });
  const result = await commitFiles(allFiles, message);
  console.log('[diary] committed', result);
  setPinnedRef(result.sha);

  // Reparse from the new source so offsets stay consistent for the next edit.
  const file = parseDiary(nextSource);
  return { state: { file, items: sortItems(file.items) }, changed: result.changed };
}

export async function deleteEntry(state: DiaryState, id: number): Promise<DiaryState> {
  const target = state.file.items.find(it => it.id === id);
  const filtered = state.file.items.filter(it => it.id !== id);
  const nextItems = renumberByDate(filtered);
  const nextSource = serializeDiary(state.file, nextItems);

  const deleteFiles: CommitFile[] = (target?.images ?? [])
    .map(urlToRepoPath)
    .filter((p): p is string => p !== null)
    .map(path => ({ path, delete: true }));

  // Put the deleted entry's full content in the commit body so the commit log
  // doubles as an audit trail — you can recover the text from `git log` alone.
  const title = `日记：删除第 ${id} 篇`;
  const message = target?.content
    ? `${title}\n\n${target.content}`
    : title;
  const result = await commitFiles(
    [{ path: DIARY_CONFIG.dataPath, text: nextSource }, ...deleteFiles],
    message,
  );
  setPinnedRef(result.sha);
  const file = parseDiary(nextSource);
  return { file, items: sortItems(file.items) };
}

// ---------- sync to memos ----------

export interface SyncProgress {
  done: number;
  total: number;
  currentDate?: string;
}

// First line of a synced memo is `#日记 id:<N>` — the `id:<N>` part is our
// stable handle, used to find-or-create on subsequent syncs so the op is
// idempotent.
const DIARY_ID_MARKER = /^#日记\s+id:(\d+)/;

function extractDiaryId(content: string): number | null {
  const m = DIARY_ID_MARKER.exec(content);
  return m ? Number(m[1]) : null;
}

async function listAllDiaryMemos(): Promise<Memo[]> {
  const result: Memo[] = [];
  let pageToken: string | undefined;
  do {
    const res = await listMemos(200, pageToken);
    for (const m of res.memos ?? []) {
      if (extractDiaryId(m.content) !== null) result.push(m);
    }
    pageToken = res.nextPageToken || undefined;
  } while (pageToken);
  return result;
}

// Build memo content per spec, separated by blank lines so markdown
// renders each as its own paragraph:
//   `#日记 id:<N>`  (stable marker for find-or-create)
//   `位置：... 心情：... 标签：#a #b`  (omitted if all empty)
//   original diary content
function buildMemoContent(item: DiaryItem): string {
  const meta: string[] = [];
  if (item.location) meta.push(`位置：${item.location}`);
  if (item.mood) meta.push(`心情：${item.mood}`);
  if (item.tags?.length) meta.push(`标签：${item.tags.map(t => `#${t}`).join(' ')}`);

  // Single `\n` in markdown collapses into a space, so promote each to a
  // blank-line paragraph break.
  const body = item.content.replace(/\n/g, '\n\n');

  const parts = [`#日记 id:${item.id}`];
  if (meta.length > 0) parts.push(meta.join('  '));
  parts.push('---', body);
  return parts.join('\n\n');
}

// Push every diary entry to the memos backend. Each memo's first line is
// `#日记 id:<N>`, which lets us find-or-create on re-runs — re-syncing
// updates the existing memos instead of duplicating. Images are
// re-uploaded as attachments, deduped by filename against the memo's
// existing attachments.
export async function syncDiaryToMemos(
  state: DiaryState,
  opts: { onProgress?: (p: SyncProgress) => void } = {},
): Promise<{ created: number; updated: number }> {
  // Post earliest first so the memos timeline reads chronologically on a
  // fresh sync.
  const ordered = [...state.items].sort((a, b) => {
    if (a.date === b.date) return a.id - b.id;
    return a.date < b.date ? -1 : 1;
  });

  const existingMemos = await listAllDiaryMemos();
  const byId = new Map<number, Memo>();
  for (const m of existingMemos) {
    const id = extractDiaryId(m.content);
    if (id !== null) byId.set(id, m);
  }

  let created = 0;
  let updated = 0;
  let done = 0;
  opts.onProgress?.({ done, total: ordered.length });

  for (const item of ordered) {
    opts.onProgress?.({ done, total: ordered.length, currentDate: item.date });
    const content = buildMemoContent(item);
    const existingMemo = byId.get(item.id);

    // Reconcile attachments: reuse any with a matching filename; upload
    // fresh ones for the rest.
    const existingByFilename = new Map<string, Attachment>();
    for (const a of existingMemo?.attachments ?? []) {
      existingByFilename.set(a.filename, a);
    }

    const attachmentRefs: { name: string }[] = [];
    for (const imgUrl of item.images ?? []) {
      const filename = imgUrl.split('/').pop() || 'image.webp';
      const reused = existingByFilename.get(filename);
      if (reused) {
        attachmentRefs.push({ name: reused.name });
        continue;
      }

      const src = resolveImageUrl(imgUrl);
      const res = await fetch(src);
      if (!res.ok) throw new Error(`下载图片失败：${src} (${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || 'image/webp' });
      // For new memos we have no memoName yet — upload as orphan and let
      // the subsequent createMemo({attachments}) link them, same as
      // Write.tsx's new-memo flow. For existing memos we pass memoName so
      // the link happens at upload time.
      const att = await uploadAttachment(file, existingMemo?.name);
      attachmentRefs.push({ name: att.name });
    }

    // Trim attachments the user dropped from the diary entry.
    const wantedNames = new Set(attachmentRefs.map(r => r.name));
    for (const att of existingMemo?.attachments ?? []) {
      if (!wantedNames.has(att.name)) {
        await deleteAttachment(att.name).catch(() => {
          /* ignore — memos will still show stale, but sync won't fail over it */
        });
      }
    }

    // Single create/update with content + attachments in one shot — this
    // is what populates memo.attachments on the backend, which `/file/*`
    // needs for auth to pass.
    if (existingMemo) {
      await updateMemo(existingMemo.name, { content, attachments: attachmentRefs });
      updated++;
    } else {
      await createMemo({ content, visibility: 'PRIVATE', attachments: attachmentRefs });
      created++;
    }

    done++;
    opts.onProgress?.({ done, total: ordered.length, currentDate: item.date });
  }

  return { created, updated };
}

// ---------- helpers ----------

// Reassigns ids 1..N in chronological (date asc) order. Stable on ties by
// original id so edits don't shuffle same-day entries.
function renumberByDate(items: DiaryItem[]): DiaryItem[] {
  const ordered = [...items].sort((a, b) => {
    if (a.date === b.date) return a.id - b.id;
    return a.date < b.date ? -1 : 1;
  });
  return ordered.map((it, i) => ({ ...it, id: i + 1 }));
}

function sortItems(items: DiaryItem[]): DiaryItem[] {
  return [...items].sort((a, b) => {
    if (a.date === b.date) return b.id - a.id;
    return a.date < b.date ? 1 : -1;
  });
}

function dateSlug(date: string): string {
  // Accepts "2026-04-18", "2026-04-18 12:00", "2026-04-18T12:00:00Z", etc.
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // Fallback — today in local time.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Stored image URLs look like `/images/diary/foo.webp`. The repo path is
// `images/diary/foo.webp`. Anything that doesn't sit under our image dir
// (e.g. a legacy external URL) is ignored — we won't touch files we don't own.
function urlToRepoPath(url: string): string | null {
  const prefix = DIARY_CONFIG.imageUrlPrefix + '/';
  if (!url.startsWith(prefix)) return null;
  return DIARY_CONFIG.imageDir + '/' + url.slice(prefix.length);
}

// Given URLs like /images/diary/2026-04-18-7-3.webp, find the current max seq
// for `${date}-${id}-`. Returns 0 if none match — caller increments before use.
function maxSeqFor(urls: string[], datePart: string, id: number): number {
  const prefix = `${datePart}-${id}-`;
  let max = 0;
  for (const u of urls) {
    const name = u.split('/').pop() ?? '';
    if (!name.startsWith(prefix)) continue;
    const rest = name.slice(prefix.length);
    const m = /^(\d+)\.webp$/.exec(rest);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  }
  return max;
}

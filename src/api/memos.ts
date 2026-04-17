import client from './client';
import type {
  Attachment, Memo, ListMemosResponse, CreateMemoRequest, UpdateMemoRequest, UserStats,
} from '../types';

export async function getUserStats(userName: string): Promise<UserStats> {
  const { data } = await client.get(`/${userName}/stats`);
  return data;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function listAttachments(): Promise<Attachment[]> {
  const { data } = await client.get('/attachments');
  return data.attachments ?? [];
}

export async function getAttachment(name: string): Promise<Attachment> {
  const { data } = await client.get(`/${name}`);
  return data;
}

export async function uploadAttachment(file: File, memoName?: string): Promise<Attachment> {
  const content = await fileToBase64(file);
  const body: Record<string, string> = {
    filename: file.name,
    content,
    type: file.type || 'application/octet-stream',
    size: String(file.size),
  };
  if (memoName) body.memo = memoName;
  const { data } = await client.post('/attachments', body);
  return data;
}

export async function deleteAttachment(name: string): Promise<void> {
  await client.delete(`/${name}`);
}

export async function updateAttachmentMemo(attachmentName: string, memoName: string): Promise<Attachment> {
  const { data } = await client.patch(`/${attachmentName}`, { memo: memoName }, {
    params: { updateMask: 'memo' },
  });
  return data;
}


export async function listMemos(
  pageSize = 20,
  pageToken?: string,
  filter?: string,
  state?: 'NORMAL' | 'ARCHIVED',
): Promise<ListMemosResponse> {
  const params: Record<string, string | number> = { pageSize };
  if (pageToken) params.pageToken = pageToken;
  if (filter) params.filter = filter;
  if (state) params.state = state;
  const { data } = await client.get('/memos', { params });
  return data;
}

export async function listMemoComments(name: string): Promise<Memo[]> {
  const { data } = await client.get(`/${name}/comments`);
  return data.memos ?? [];
}

export async function createMemoComment(
  name: string,
  content: string,
  visibility: 'PUBLIC' | 'PROTECTED' | 'PRIVATE' = 'PUBLIC',
): Promise<Memo> {
  const { data } = await client.post(`/${name}/comments`, { content, visibility });
  return data;
}

export async function getMemo(name: string): Promise<Memo> {
  const { data } = await client.get(`/${name}`);
  return data;
}

export async function createMemo(req: CreateMemoRequest): Promise<Memo> {
  const { data } = await client.post('/memos', req);
  return data;
}

export async function updateMemo(
  name: string,
  req: UpdateMemoRequest,
): Promise<Memo> {
  const updateMask = Object.keys(req).join(',');
  const { data } = await client.patch(`/${name}`, req, {
    params: { updateMask },
  });
  return data;
}

export async function deleteMemo(name: string): Promise<void> {
  await client.delete(`/${name}`);
}

export function getAttachmentUrl(name: string, filename: string): string {
  return `/file/${name}/${filename}`;
}

export function getAvatarUrl(avatarPath: string): string {
  return avatarPath;
}

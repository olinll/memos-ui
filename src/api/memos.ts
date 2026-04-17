import client from './client';
import type { Memo, ListMemosResponse, CreateMemoRequest, UpdateMemoRequest } from '../types';


export async function listMemos(
  pageSize = 20,
  pageToken?: string,
  filter?: string,
): Promise<ListMemosResponse> {
  const params: Record<string, string | number> = { pageSize };
  if (pageToken) params.pageToken = pageToken;
  if (filter) params.filter = filter;
  const { data } = await client.get('/memos', { params });
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

export interface User {
  name: string;
  role: 'HOST' | 'ADMIN' | 'USER';
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  description: string;
  state: string;
  createTime: string;
  updateTime: string;
}

export interface Attachment {
  name: string;
  createTime: string;
  filename: string;
  content: string;
  externalLink: string;
  type: string;
  size: string;
  memo: string;
}

export interface MemoProperty {
  hasLink: boolean;
  hasTaskList: boolean;
  hasCode: boolean;
  hasIncompleteTasks: boolean;
}

export interface Memo {
  name: string;
  state: 'NORMAL' | 'ARCHIVED';
  creator: string;
  createTime: string;
  updateTime: string;
  displayTime: string;
  content: string;
  visibility: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  tags: string[];
  pinned: boolean;
  attachments: Attachment[];
  relations: MemoRelation[];
  reactions: MemoReaction[];
  property: MemoProperty;
  snippet: string;
}

export interface MemoRelation {
  memo: string;
  relatedMemo: string;
  type: string;
}

export interface MemoReaction {
  id: string;
  creator: string;
  contentId: string;
  reactionType: string;
}

export interface ListMemosResponse {
  memos: Memo[];
  nextPageToken: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  accessTokenExpiresAt: string;
}

export interface CreateMemoRequest {
  content: string;
  visibility: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  attachments?: Array<{ name: string }>;
}

export interface UpdateMemoRequest {
  content?: string;
  visibility?: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  pinned?: boolean;
  attachments?: Array<{ name: string }>;
}

export interface UserStats {
  name: string;
  memoDisplayTimestamps: string[];
  memoTypeStats: Record<string, number>;
  tagCount: Record<string, number>;
}

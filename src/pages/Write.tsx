import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Send, Globe, Lock, Users, ChevronDown, MapPin, Smile,
  Loader2, Trash2, X, Paperclip, FileIcon,
} from 'lucide-react';
import LiveEditor, { type UploadedFileRef } from '../components/MilkdownEditor';
import {
  createMemo, getMemo, updateMemo,
  uploadAttachment, deleteAttachment,
  getAttachmentUrl,
} from '../api/memos';
import type { Attachment } from '../types';
import AuthedImage from '../components/AuthedImage';

const DRAFT_KEY = 'memos-draft';

interface Draft {
  content: string;
  location: string;
  mood: string;
  visibility: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  updatedAt: number;
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { content: '', location: '', mood: '', visibility: 'PUBLIC', updatedAt: 0 };
}

function saveDraft(draft: Draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, updatedAt: Date.now() }));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function parseMeta(raw: string): { content: string; location: string; mood: string } {
  const nl = raw.indexOf('\n');
  const firstLine = nl === -1 ? raw : raw.slice(0, nl);
  if (!/^\s*(位置:|心情:)/.test(firstLine)) {
    return { content: raw, location: '', mood: '' };
  }
  const locMatch = firstLine.match(/位置:\s*(.*?)(?=\s+心情:|$)/);
  const moodMatch = firstLine.match(/心情:\s*(.*)$/);
  let rest = nl === -1 ? '' : raw.slice(nl + 1);
  if (rest.startsWith('\n')) rest = rest.slice(1);
  return {
    content: rest,
    location: locMatch?.[1]?.trim() || '',
    mood: moodMatch?.[1]?.trim() || '',
  };
}

const visibilityOptions = [
  { value: 'PUBLIC' as const, label: '公开', icon: Globe },
  { value: 'PROTECTED' as const, label: '登录可见', icon: Users },
  { value: 'PRIVATE' as const, label: '私密', icon: Lock },
];

export default function Write() {
  const navigate = useNavigate();
  const params = useParams();
  const memoName = params['*'];
  const isEdit = !!memoName;

  const initialDraft = isEdit
    ? { content: '', location: '', mood: '', visibility: 'PUBLIC' as const, updatedAt: 0 }
    : loadDraft();

  const [content, setContent] = useState(initialDraft.content);
  const [location, setLocation] = useState(initialDraft.location);
  const [mood, setMood] = useState(initialDraft.mood);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PROTECTED' | 'PRIVATE'>(initialDraft.visibility);
  const [showVisMenu, setShowVisMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState(initialDraft.updatedAt);
  const [loadingMemo, setLoadingMemo] = useState(isEdit);
  type PendingAttachment = Attachment & { _blobUrl?: string; _origName?: string };
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load memo in edit mode
  useEffect(() => {
    if (!isEdit || !memoName) return;
    let cancelled = false;
    getMemo(memoName).then(memo => {
      if (cancelled) return;
      const parsed = parseMeta(memo.content);
      setContent(parsed.content);
      setLocation(parsed.location);
      setMood(parsed.mood);
      setVisibility(memo.visibility);
      setAttachments(memo.attachments || []);
      setLoadingMemo(false);
    });
    return () => { cancelled = true; };
  }, [isEdit, memoName]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (f): Promise<PendingAttachment> => {
          const att = await uploadAttachment(f, isEdit ? memoName : undefined);
          return { ...att, _blobUrl: URL.createObjectURL(f), _origName: f.name };
        })
      );
      setAttachments(prev => [...prev, ...uploaded]);
    } catch (e) {
      toast.error(`上传失败：${(e as Error).message || e}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Used by the editor's paste/drop handler: upload the files and return
  // the URL refs so the editor can splice markdown into the cursor position.
  const handleFilesFromEditor = useCallback(async (files: File[]): Promise<UploadedFileRef[]> => {
    if (files.length === 0) return [];
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (f): Promise<PendingAttachment> => {
          const att = await uploadAttachment(f, isEdit ? memoName : undefined);
          return { ...att, _blobUrl: URL.createObjectURL(f), _origName: f.name };
        })
      );
      setAttachments(prev => [...prev, ...uploaded]);
      return uploaded.map(att => ({
        filename: att._origName || att.filename,
        url: getAttachmentUrl(att.name, att.filename),
        isImage: (att.type || '').startsWith('image/'),
      }));
    } catch (e) {
      toast.error(`上传失败：${(e as Error).message || e}`);
      return [];
    } finally {
      setUploading(false);
    }
  }, [isEdit, memoName]);

  const handleRemoveAttachment = async (att: Attachment) => {
    if (!confirm(`删除附件 ${att.filename}？`)) return;
    try {
      await deleteAttachment(att.name);
      setAttachments(prev => prev.filter(a => a.name !== att.name));
    } catch (e) {
      toast.error(`删除失败：${(e as Error).message || e}`);
    }
  };

  // Auto-save draft (create mode only)
  useEffect(() => {
    if (isEdit) return;
    const timer = setTimeout(() => {
      saveDraft({ content, location, mood, visibility, updatedAt: Date.now() });
      setLastSaved(Date.now());
    }, 500);
    return () => clearTimeout(timer);
  }, [content, location, mood, visibility, isEdit]);

  const handleContentChange = useCallback((markdown: string) => {
    setContent(markdown);
  }, []);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const metaParts: string[] = [];
      if (location.trim()) metaParts.push(`位置: ${location.trim()}`);
      if (mood.trim()) metaParts.push(`心情: ${mood.trim()}`);
      const metaLine = metaParts.length > 0 ? metaParts.join(' ') + '\n\n' : '';
      const fullContent = metaLine + content;

      const attachmentRefs = attachments.map(a => ({ name: a.name }));
      if (isEdit && memoName) {
        await updateMemo(memoName, {
          content: fullContent,
          visibility,
          attachments: attachmentRefs,
        });
      } else {
        await createMemo({
          content: fullContent,
          visibility,
          attachments: attachmentRefs,
        });
        clearDraft();
      }
      navigate('/');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearOrCancel = () => {
    if (isEdit) {
      navigate('/');
      return;
    }
    if (!content.trim() || confirm('确定要清空草稿吗？')) {
      clearDraft();
      setContent('');
      setLocation('');
      setMood('');
    }
  };

  const currentVis = visibilityOptions.find(v => v.value === visibility)!;

  const savedTimeAgo = !isEdit && lastSaved
    ? `已自动保存 ${new Date(lastSaved).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">{isEdit ? '编辑 Memo' : '写 Memo'}</h2>
        {savedTimeAgo && (
          <span className="text-xs text-text-secondary/60">{savedTimeAgo}</span>
        )}
      </div>

      {loadingMemo ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
        </div>
      ) : (
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
        <LiveEditor
          content={content}
          onChange={handleContentChange}
          location={location}
          mood={mood}
          onFilesPaste={handleFilesFromEditor}
        />

        {/* Location & Mood */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border shrink-0">
          <div className="flex items-center gap-1.5 text-text-secondary">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="位置"
              className="w-24 bg-transparent text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
            />
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5 text-text-secondary">
            <Smile className="w-3.5 h-3.5 shrink-0" />
            <input
              type="text"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="心情"
              className="w-24 bg-transparent text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="border-t-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3 shrink-0">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-primary">
              <Paperclip className="w-3.5 h-3.5" />
              <span>附件 ({attachments.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {attachments.map(att => {
                const isImage = att.type.startsWith('image/');
                return (
                  <div key={att.name} className="relative group/att flex items-center gap-2 px-2 py-1 rounded-lg bg-surface border border-border text-xs text-text-secondary shadow-sm">
                    {isImage ? (
                      <AuthedImage
                        src={att._blobUrl ?? getAttachmentUrl(att.name, att.filename)}
                        alt={att._origName ?? att.filename}
                        className="w-8 h-8 rounded object-cover"
                      />
                    ) : (
                      <FileIcon className="w-4 h-4" />
                    )}
                    <span className="max-w-[160px] truncate">{att._origName ?? att.filename}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att)}
                      className="p-0.5 rounded hover:bg-red-100 hover:text-red-500 transition"
                      title="移除"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border shrink-0">
          <div className="flex items-center gap-2">
            {/* Visibility */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowVisMenu(!showVisMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-surface-secondary transition"
              >
                <currentVis.icon className="w-3.5 h-3.5" />
                <span>{currentVis.label}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showVisMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowVisMenu(false)} />
                  <div className="absolute bottom-full left-0 mb-1 bg-surface rounded-lg border border-border shadow-lg py-1 z-20 min-w-[130px] menu-pop">
                    {visibilityOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setVisibility(opt.value); setShowVisMenu(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition ${
                          visibility === opt.value ? 'text-primary bg-tag' : 'text-text-secondary hover:bg-surface-secondary'
                        }`}
                      >
                        <opt.icon className="w-3.5 h-3.5" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Upload */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => handleUpload(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-text-secondary hover:text-primary hover:bg-surface-secondary transition disabled:opacity-40"
              title="添加附件"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
              附件
            </button>

            {/* Clear / Cancel */}
            <button
              type="button"
              onClick={handleClearOrCancel}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-text-secondary hover:text-red-500 hover:bg-red-50 transition"
            >
              {isEdit ? <X className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
              {isEdit ? '取消' : '清空'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {isEdit ? '保存' : '发布'}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

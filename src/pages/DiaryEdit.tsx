import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BookOpen, Loader2, Save, X, MapPin, Smile, Tag, Paperclip, ArrowLeft,
} from 'lucide-react';
import {
  loadDiary, saveEntry,
  type DiaryItem, type DiaryState,
} from '../api/diary';
import { resolveImageUrl, isDiaryEnabled } from '../config/diary';

function nowLocalDateString(): string {
  // "YYYY-MM-DD HH:mm" — matches what our serializer will json-stringify.
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm". Convert both ways.
function toInputValue(date: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(date);
  if (m) return `${m[1]}T${m[2]}`;
  const d = /^(\d{4}-\d{2}-\d{2})$/.exec(date);
  if (d) return `${d[1]}T00:00`;
  return '';
}

function fromInputValue(v: string): string {
  // Store as "YYYY-MM-DD HH:mm" to stay close to the existing format.
  return v.replace('T', ' ');
}

interface NewImage {
  file: File;
  previewUrl: string; // object URL, revoked on unmount
}

// Count-and-sort: unique non-empty values, most frequent first.
function rank(values: (string | undefined)[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    const t = v.trim();
    if (!t) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([v]) => v);
}

export default function DiaryEdit() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const editingId = params.id ? Number(params.id) : undefined;
  const isEdit = editingId !== undefined;

  const [state, setState] = useState<DiaryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [mood, setMood] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<NewImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Suggestions from historical entries. Ordered by frequency desc so the
  // most-used values surface first in the datalist.
  const suggestions = useMemo(() => {
    const items = state?.items ?? [];
    return {
      locations: rank(items.map(it => it.location)),
      moods: rank(items.map(it => it.mood)),
      tags: rank(items.flatMap(it => it.tags ?? [])),
    };
  }, [state]);

  useEffect(() => {
    if (!isDiaryEnabled()) {
      setLoadError('未配置 VITE_GITHUB_TOKEN');
      setLoading(false);
      return;
    }
    let cancelled = false;
    loadDiary()
      .then(s => {
        if (cancelled) return;
        setState(s);
        if (isEdit) {
          const item = s.items.find(it => it.id === editingId);
          if (!item) {
            setLoadError(`未找到 id=${editingId} 的日记`);
            setLoading(false);
            return;
          }
          setContent(item.content);
          setDate(item.date || nowLocalDateString());
          setLocation(item.location ?? '');
          setMood(item.mood ?? '');
          setTags(item.tags ? [...item.tags] : []);
          setExistingImages(item.images ? [...item.images] : []);
        } else {
          setDate(nowLocalDateString());
        }
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setLoadError((e as Error).message || String(e));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isEdit, editingId]);

  // Revoke object URLs so we don't leak memory across edits.
  useEffect(() => {
    return () => {
      newImages.forEach(n => URL.revokeObjectURL(n.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const picked: NewImage[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      picked.push({ file: f, previewUrl: URL.createObjectURL(f) });
    }
    if (picked.length === 0) return;
    setNewImages(prev => [...prev, ...picked]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Page-level paste: accept images from the clipboard as long as the user
  // isn't typing into a textarea/input (so Ctrl+V text-paste still works).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const files: File[] = [];
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f && f.type.startsWith('image/')) files.push(f);
        }
      }
      if (files.length === 0) return;
      e.preventDefault();
      addFiles(files);
      toast.success(`已添加 ${files.length} 张剪贴板图片`);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const removeExisting = (url: string) => {
    setExistingImages(prev => prev.filter(u => u !== url));
  };

  const removeNew = (n: NewImage) => {
    URL.revokeObjectURL(n.previewUrl);
    setNewImages(prev => prev.filter(x => x !== n));
  };

  const tagInputRef = useRef<HTMLInputElement>(null);

  const addTagValue = (raw: string) => {
    const t = raw.trim();
    if (!t) { setTagInput(''); return; }
    setTags(prev => prev.includes(t) ? prev : [...prev, t]);
    setTagInput('');
  };

  const addTag = () => addTagValue(tagInput);

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  // Picking a datalist option auto-fills the full suggestion value — no
  // keypress, just a change event. Treat that as a commit so the user doesn't
  // have to press Enter a second time.
  const handleTagInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (suggestions.tags.includes(v) && !tags.includes(v)) {
      addTagValue(v);
      return;
    }
    setTagInput(v);
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
      return;
    }
    if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      // Pop last chip back into the input for quick re-editing.
      e.preventDefault();
      const last = tags[tags.length - 1];
      setTags(prev => prev.slice(0, -1));
      setTagInput(last);
    }
  };

  const handleSubmit = async () => {
    if (!state) return;
    if (!content.trim()) { toast.error('内容不能为空'); return; }
    if (!date) { toast.error('日期不能为空'); return; }
    setSubmitting(true);
    try {
      console.log('[diary] saveEntry start', {
        isEdit, editingId,
        newImageCount: newImages.length,
        existingImageCount: existingImages.length,
      });
      const result = await saveEntry(state, {
        id: editingId,
        content,
        date,
        location: location.trim() || undefined,
        mood: mood.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        existingImages,
        newImages: newImages.map(n => n.file),
      });
      console.log('[diary] saveEntry done, changed:', result.changed, 'new items:', result.state.items.length);
      setState(result.state);
      if (!result.changed) {
        toast('未更改');
      } else if (isEdit) {
        toast.success('已修改并上传');
      } else {
        toast.success('上传成功');
      }
      navigate('/diary', { state: { fresh: result.state } });
    } catch (e) {
      console.error('[diary] saveEntry failed', e);
      toast.error(`保存失败：${(e as Error).message || e}`, { duration: 8000 });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <p className="text-lg">加载失败</p>
        <p className="text-sm mt-1 text-red-500 break-all">{loadError}</p>
        <button
          onClick={() => navigate('/diary')}
          className="mt-4 inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          返回日记列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/diary')}
          className="p-1.5 rounded-md text-text-secondary hover:text-primary hover:bg-surface-secondary transition"
          title="返回"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          {isEdit ? `编辑日记 #${editingId}` : '新日记'}
        </h2>
      </div>

      <div className="bg-surface rounded-2xl border border-border shadow-sm p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">日期时间</label>
          <input
            type="datetime-local"
            value={toInputValue(date)}
            onChange={e => setDate(fromInputValue(e.target.value))}
            className="px-3 py-2 rounded-lg border border-border bg-surface-secondary text-sm text-text-primary focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">内容</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={8}
            placeholder="今天发生了什么…"
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-primary resize-y"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-text-secondary mb-1">
              <MapPin className="w-3 h-3" />
              位置
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              list="diary-location-suggestions"
              placeholder="可选"
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-primary"
            />
            <datalist id="diary-location-suggestions">
              {suggestions.locations.map(v => <option key={v} value={v} />)}
            </datalist>
          </div>
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-text-secondary mb-1">
              <Smile className="w-3 h-3" />
              心情
            </label>
            <input
              type="text"
              value={mood}
              onChange={e => setMood(e.target.value)}
              list="diary-mood-suggestions"
              placeholder="可选"
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-primary"
            />
            <datalist id="diary-mood-suggestions">
              {suggestions.moods.map(v => <option key={v} value={v} />)}
            </datalist>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-text-secondary mb-1">
            <Tag className="w-3 h-3" />
            标签
          </label>
          <div
            onClick={() => tagInputRef.current?.focus()}
            className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border bg-surface-secondary cursor-text focus-within:border-primary transition"
          >
            {tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tag text-primary text-xs">
                {t}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); removeTag(t); }}
                  className="p-0.5 rounded-full hover:bg-primary/20"
                  title="移除"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              ref={tagInputRef}
              type="text"
              value={tagInput}
              onChange={handleTagInputChange}
              onKeyDown={handleTagKeyDown}
              onBlur={addTag}
              list="diary-tag-suggestions"
              placeholder={tags.length === 0 ? '输入回车添加' : ''}
              className="flex-1 min-w-[6rem] px-1 py-0.5 bg-transparent text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
            />
            <datalist id="diary-tag-suggestions">
              {suggestions.tags.filter(t => !tags.includes(t)).map(v => <option key={v} value={v} />)}
            </datalist>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-1 text-xs font-medium text-text-secondary">
              <Paperclip className="w-3 h-3" />
              图片
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-text-secondary hover:text-primary hover:bg-surface-secondary transition"
            >
              <Paperclip className="w-3 h-3" />
              添加
            </button>
          </div>

          <div
            onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
            onDragOver={e => {
              e.preventDefault();
              if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
              if (!dragOver) setDragOver(true);
            }}
            onDragLeave={e => {
              // Only clear when leaving the drop zone itself, not a child.
              if (e.currentTarget === e.target) setDragOver(false);
            }}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
            }}
            className={`rounded-lg border-2 border-dashed transition p-2 ${
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-border/60 bg-transparent hover:border-border'
            }`}
          >
            {existingImages.length + newImages.length === 0 ? (
              <div className="text-xs text-text-secondary/60 py-4 text-center">
                拖拽图片到此处，或直接粘贴剪贴板图片
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {existingImages.map(url => (
                <div key={url} className="relative group rounded-lg overflow-hidden border border-border bg-surface-secondary">
                  <img src={resolveImageUrl(url)} alt="" className="w-full h-28 object-cover" loading="lazy" />
                  <button
                    type="button"
                    onClick={() => removeExisting(url)}
                    className="absolute top-1 right-1 p-1 rounded-md bg-surface/90 text-text-secondary opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition"
                    title="移除"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-surface/80 text-[10px] text-text-secondary">
                    已保存
                  </span>
                </div>
              ))}
              {newImages.map(n => (
                <div key={n.previewUrl} className="relative group rounded-lg overflow-hidden border border-primary/40 bg-primary/5">
                  <img src={n.previewUrl} alt="" className="w-full h-28 object-cover" />
                  <button
                    type="button"
                    onClick={() => removeNew(n)}
                    className="absolute top-1 right-1 p-1 rounded-md bg-surface/90 text-text-secondary opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition"
                    title="移除"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-primary/90 text-[10px] text-white">
                    待上传
                  </span>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => navigate('/diary')}
            className="px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-surface-secondary transition"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isEdit ? '保存' : '发布'}
          </button>
        </div>
      </div>
    </div>
  );
}

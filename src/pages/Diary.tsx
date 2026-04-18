import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BookOpen, Loader2, Plus, Pencil, Trash2, ExternalLink, MapPin, Smile, Tag, Upload } from 'lucide-react';
import { loadDiary, deleteEntry, syncDiaryToMemos, type DiaryItem } from '../api/diary';
import { DIARY_CONFIG, resolveImageUrl, isDiaryEnabled } from '../config/diary';
import ImageLightbox from '../components/ImageLightbox';

interface PageState {
  loading: boolean;
  error: string | null;
  items: DiaryItem[];
  // `state` here is the full DiaryState, but kept opaque to the view.
  raw: Awaited<ReturnType<typeof loadDiary>> | null;
}

export default function Diary() {
  const navigate = useNavigate();
  const location = useLocation();
  // When DiaryEdit navigates back right after a save, it hands over the fresh
  // state via router state — render from that and skip the GitHub fetch to
  // sidestep the contents CDN's post-write staleness window.
  const fresh = (location.state as { fresh?: Awaited<ReturnType<typeof loadDiary>> } | null)?.fresh;
  const [page, setPage] = useState<PageState>(() => fresh
    ? { loading: false, error: null, items: fresh.items, raw: fresh }
    : { loading: true, error: null, items: [], raw: null });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: { src: string; alt: string }[]; index: number } | null>(null);

  useEffect(() => {
    if (fresh) {
      // Clear router state so a subsequent refresh goes through the normal
      // fetch path instead of reusing an old snapshot.
      window.history.replaceState({}, '');
      return;
    }
    if (!isDiaryEnabled()) {
      setPage({ loading: false, error: '未配置 VITE_GITHUB_TOKEN', items: [], raw: null });
      return;
    }
    let cancelled = false;
    loadDiary()
      .then(state => {
        if (cancelled) return;
        setPage({ loading: false, error: null, items: state.items, raw: state });
      })
      .catch(e => {
        if (cancelled) return;
        setPage({ loading: false, error: (e as Error).message || String(e), items: [], raw: null });
      });
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (item: DiaryItem) => {
    if (!page.raw) return;
    if (!confirm(`删除日记 #${item.id}？此操作会推送一次 git 提交。`)) return;
    setDeletingId(item.id);
    try {
      const next = await deleteEntry(page.raw, item.id);
      setPage({ loading: false, error: null, items: next.items, raw: next });
      toast.success('已删除');
    } catch (e) {
      toast.error(`删除失败：${(e as Error).message || e}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSync = async () => {
    if (!page.raw) return;
    if (page.items.length === 0) { toast('没有可同步的日记'); return; }
    if (!confirm(
      `将 ${page.items.length} 条日记同步到 memos？\n`
      + '每条 memo 开头会写入 #日记 id:<编号>，后续再同步会按 id 更新对应的 memo，不会重复创建。',
    )) return;

    setSyncing(true);
    const toastId = toast.loading(`同步中 0/${page.items.length}...`);
    try {
      const result = await syncDiaryToMemos(page.raw, {
        onProgress: ({ done, total, currentDate }) => {
          toast.loading(
            `同步中 ${done}/${total}${currentDate ? ` · ${currentDate}` : ''}`,
            { id: toastId },
          );
        },
      });
      toast.success(`同步完成：新增 ${result.created}，更新 ${result.updated}`, { id: toastId });
    } catch (e) {
      toast.error(`同步失败：${(e as Error).message || e}`, { id: toastId, duration: 8000 });
    } finally {
      setSyncing(false);
    }
  };

  const openLightbox = (images: string[], startIdx: number) => {
    setLightbox({
      images: images.map(u => ({ src: resolveImageUrl(u), alt: '' })),
      index: startIdx,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          日记
          <a
            href={DIARY_CONFIG.blogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            查看博客
          </a>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing || page.loading || page.items.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:text-primary hover:border-primary transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="把日记全部同步到 memos（会加 #日记 标签）"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            同步到 memos
          </button>
          <button
            onClick={() => navigate('/diary/new')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新日记
          </button>
        </div>
      </div>

      {page.loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
        </div>
      ) : page.error ? (
        <div className="text-center py-12 text-text-secondary">
          <p className="text-lg">加载失败</p>
          <p className="text-sm mt-1 text-red-500 break-all">{page.error}</p>
        </div>
      ) : page.items.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <p className="text-lg">还没有日记</p>
          <p className="text-sm mt-1">点击右上角「新日记」开始写作</p>
        </div>
      ) : (
        <div className="space-y-4">
          {page.items.map(item => (
            <article
              key={item.id}
              className="bg-surface rounded-xl border border-border shadow-sm p-4 fade-in-up"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-text-secondary">
                  <span>#{item.id}</span>
                  <span className="mx-1.5">·</span>
                  <span>{item.date}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    to={`/diary/edit/${item.id}`}
                    className="p-1.5 rounded-md text-text-secondary hover:text-primary hover:bg-surface-secondary transition"
                    title="编辑"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    className="p-1.5 rounded-md text-text-secondary hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                    title="删除"
                  >
                    {deletingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-text-primary leading-relaxed">
                {item.content}
              </p>

              {item.images && item.images.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {item.images.map((src, i) => (
                    <button
                      key={src}
                      onClick={() => openLightbox(item.images!, i)}
                      className="block overflow-hidden rounded-lg bg-surface-secondary cursor-zoom-in"
                    >
                      <img
                        src={resolveImageUrl(src)}
                        alt=""
                        className="w-full h-32 object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                {item.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {item.location}
                  </span>
                )}
                {item.mood && (
                  <span className="inline-flex items-center gap-1">
                    <Smile className="w-3 h-3" />
                    {item.mood}
                  </span>
                )}
                {item.tags && item.tags.length > 0 && (
                  <span className="inline-flex items-center gap-1 flex-wrap">
                    <Tag className="w-3 h-3" />
                    {item.tags.map(t => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-tag text-primary">
                        {t}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          currentIndex={lightbox.index}
          onClose={() => setLightbox(null)}
          onChangeIndex={i => setLightbox(lb => lb ? { ...lb, index: i } : lb)}
        />
      )}
    </div>
  );
}

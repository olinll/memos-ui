import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format, isToday, isYesterday } from 'date-fns';
import { Loader2, FileIcon, Paperclip, Trash2, ExternalLink } from 'lucide-react';
import type { Attachment } from '../types';
import { listAttachments, deleteAttachment, getAttachment, getAttachmentUrl } from '../api/memos';
import ImageLightbox from '../components/ImageLightbox';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function dayHeading(d: Date): string {
  if (isToday(d)) return '今天';
  if (isYesterday(d)) return '昨天';
  return format(d, 'yyyy-MM-dd');
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Attachments() {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<{ images: Array<{ src: string; alt: string }>; index: number } | null>(null);
  // Orphan attachments (no linked memo) 401 via /file/*; fetch their content via API instead.
  const [orphanSrc, setOrphanSrc] = useState<Record<string, string | 'loading' | 'failed'>>({});

  useEffect(() => {
    listAttachments()
      .then(setItems)
      .catch((e) => toast.error(`加载失败：${e.message || e}`))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    for (const att of items) {
      if (att.memo) continue;
      if (!att.type.startsWith('image/')) continue;
      if (orphanSrc[att.name]) continue;
      setOrphanSrc(prev => ({ ...prev, [att.name]: 'loading' }));
      getAttachment(att.name)
        .then(full => {
          if (full.content) {
            setOrphanSrc(prev => ({ ...prev, [att.name]: `data:${att.type};base64,${full.content}` }));
          } else {
            setOrphanSrc(prev => ({ ...prev, [att.name]: 'failed' }));
          }
        })
        .catch(() => setOrphanSrc(prev => ({ ...prev, [att.name]: 'failed' })));
    }
  }, [items, orphanSrc]);

  const grouped = useMemo(() => {
    const map = new Map<string, { date: Date; items: Attachment[] }>();
    for (const a of items) {
      const d = new Date(a.createTime);
      const key = dayKey(d);
      if (!map.has(key)) map.set(key, { date: d, items: [] });
      map.get(key)!.items.push(a);
    }
    return Array.from(map.entries())
      .sort((x, y) => (x[0] < y[0] ? 1 : -1))
      .map(([, v]) => v);
  }, [items]);

  const handleDelete = async (att: Attachment) => {
    if (!confirm(`删除附件 ${att.filename}？`)) return;
    try {
      await deleteAttachment(att.name);
      setItems(prev => prev.filter(a => a.name !== att.name));
      toast.success('已删除');
    } catch (e) {
      toast.error(`删除失败：${(e as Error).message || e}`);
    }
  };

  const resolveSrc = (a: Attachment): string | null => {
    if (!a.memo) {
      const v = orphanSrc[a.name];
      return typeof v === 'string' && v !== 'loading' && v !== 'failed' ? v : null;
    }
    return getAttachmentUrl(a.name, a.filename);
  };

  const openLightbox = (dayItems: Attachment[], att: Attachment) => {
    const withSrc = dayItems
      .filter(a => a.type.startsWith('image/'))
      .map(a => ({ name: a.name, src: resolveSrc(a), alt: a.filename }))
      .filter((x): x is { name: string; src: string; alt: string } => !!x.src);
    if (withSrc.length === 0) return;
    const index = Math.max(0, withSrc.findIndex(x => x.name === att.name));
    setLightbox({
      images: withSrc.map(({ src, alt }) => ({ src, alt })),
      index,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Paperclip className="w-5 h-5" />
          附件
        </h2>
        <span className="text-xs text-text-secondary">共 {items.length} 个</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <p className="text-lg">还没有附件</p>
          <p className="text-sm mt-1">在写 Memo 时上传的附件会显示在这里</p>
        </div>
      ) : (
        <div className="relative pl-8">
          {/* Vertical timeline line */}
          <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

          <div className="space-y-8">
            {grouped.map(group => (
              <div key={dayKey(group.date)} className="relative fade-in-up">
                {/* Dot + date */}
                <div className="relative mb-3">
                  <div className="absolute -left-[26px] top-1.5 w-3 h-3 rounded-full bg-primary ring-4 ring-surface-secondary" />
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-text-primary">{dayHeading(group.date)}</span>
                    <span className="text-xs text-text-secondary">{group.items.length} 个</span>
                  </div>
                </div>

                {/* Items */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {group.items.map(att => {
                    const isImage = att.type.startsWith('image/');
                    const isOrphan = !att.memo;
                    const src = resolveSrc(att);
                    const orphanState = isOrphan ? orphanSrc[att.name] : undefined;
                    return (
                      <div
                        key={att.name}
                        className={`group relative bg-surface rounded-xl border shadow-sm overflow-hidden card-hover ${
                          isOrphan ? 'border-amber-300' : 'border-border'
                        }`}
                      >
                        {isImage ? (
                          src ? (
                            <button
                              onClick={() => openLightbox(group.items, att)}
                              className="block w-full h-32 bg-surface-secondary cursor-zoom-in"
                            >
                              <img
                                src={src}
                                alt={att.filename}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </button>
                          ) : orphanState === 'loading' ? (
                            <div className="flex items-center justify-center w-full h-32 bg-amber-50 text-amber-600 text-xs">
                              <Loader2 className="w-5 h-5 animate-spin" />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center w-full h-32 bg-amber-50 text-amber-600 text-xs">
                              <FileIcon className="w-8 h-8 mb-1 opacity-60" />
                              <span>加载失败</span>
                            </div>
                          )
                        ) : (
                          <a
                            href={isOrphan ? '#' : getAttachmentUrl(att.name, att.filename)}
                            target={isOrphan ? undefined : '_blank'}
                            rel="noopener noreferrer"
                            onClick={e => { if (isOrphan) e.preventDefault(); }}
                            className="flex items-center justify-center w-full h-32 bg-surface-secondary"
                          >
                            <FileIcon className="w-10 h-10 text-text-secondary" />
                          </a>
                        )}
                        <div className="p-2 text-xs">
                          <div className="truncate font-medium text-text-primary" title={att.filename}>
                            {att.filename}
                          </div>
                          <div className="flex items-center justify-between mt-1 text-text-secondary">
                            <span>{formatSize(Number(att.size) || 0)}</span>
                            <span>{format(new Date(att.createTime), 'HH:mm')}</span>
                          </div>
                          {att.memo ? (
                            <Link
                              to={`/memo/${att.memo}`}
                              className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              查看关联 Memo
                            </Link>
                          ) : (
                            <span className="mt-1 inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px]">
                              孤立附件
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleDelete(att)}
                          className={`absolute top-1.5 right-1.5 p-1 rounded-md bg-surface/90 transition ${
                            isOrphan
                              ? 'text-red-500 opacity-100 hover:bg-red-50'
                              : 'text-text-secondary opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50'
                          }`}
                          title={isOrphan ? '清理孤立附件' : '删除'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          currentIndex={lightbox.index}
          onClose={() => setLightbox(null)}
          onChangeIndex={(i) => setLightbox(lb => (lb ? { ...lb, index: i } : lb))}
        />
      )}
    </div>
  );
}

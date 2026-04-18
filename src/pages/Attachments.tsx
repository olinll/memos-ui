import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format, isToday, isYesterday } from 'date-fns';
import { Loader2, FileIcon, Paperclip, Trash2, ExternalLink } from 'lucide-react';
import type { Attachment } from '../types';
import { listAttachments, deleteAttachment, getAttachmentUrl } from '../api/memos';
import ImageLightbox from '../components/ImageLightbox';
import AuthedImage from '../components/AuthedImage';

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

  useEffect(() => {
    listAttachments()
      .then(setItems)
      .catch((e) => toast.error(`加载失败：${e.message || e}`))
      .finally(() => setLoading(false));
  }, []);

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

  const openLightbox = (dayItems: Attachment[], att: Attachment) => {
    const imgs = dayItems
      .filter(a => a.type.startsWith('image/'))
      .map(a => ({ name: a.name, src: getAttachmentUrl(a.name, a.filename), alt: a.filename }));
    if (imgs.length === 0) return;
    const index = Math.max(0, imgs.findIndex(x => x.name === att.name));
    setLightbox({
      images: imgs.map(({ src, alt }) => ({ src, alt })),
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
                    return (
                      <div
                        key={att.name}
                        className={`group relative bg-surface rounded-xl border shadow-sm overflow-hidden card-hover ${
                          isOrphan ? 'border-amber-300' : 'border-border'
                        }`}
                      >
                        {isImage ? (
                          <button
                            onClick={() => openLightbox(group.items, att)}
                            className="block w-full h-32 bg-surface-secondary cursor-zoom-in"
                          >
                            <AuthedImage
                              src={getAttachmentUrl(att.name, att.filename)}
                              alt={att.filename}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </button>
                        ) : (
                          <a
                            href={getAttachmentUrl(att.name, att.filename)}
                            target="_blank"
                            rel="noopener noreferrer"
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

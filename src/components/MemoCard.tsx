import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Pin, MoreHorizontal, Edit3, Trash2, Archive, Globe, Lock, Users,
  MapPin, Smile,
} from 'lucide-react';
import type { Memo } from '../types';
import { getAttachmentUrl } from '../api/memos';
import ImageLightbox from './ImageLightbox';

const visIcons = {
  PUBLIC: Globe,
  PROTECTED: Users,
  PRIVATE: Lock,
};

interface MemoCardProps {
  memo: Memo;
  onEdit?: (memo: Memo) => void;
  onDelete?: (memo: Memo) => void;
  onArchive?: (memo: Memo) => void;
  onPin?: (memo: Memo) => void;
  onTagClick?: (tag: string) => void;
  activeTags?: string[];
}

export default function MemoCard({ memo, onEdit, onDelete, onArchive, onPin, onTagClick, activeTags = [] }: MemoCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const VisIcon = visIcons[memo.visibility];
  const timeAgo = formatDistanceToNow(new Date(memo.displayTime), {
    addSuffix: true,
    locale: zhCN,
  });

  // Extract location and mood from content
  const locationMatch = memo.content.match(/(?:📍|位置)\s*[:：]?\s*([^\n💭心情]*)/);
  const location = locationMatch?.[1]?.trim();

  const moodMatch = memo.content.match(/(?:💭|心情)\s*[:：]?\s*([^\n]*)/);
  const mood = moodMatch?.[1]?.trim();

  // Remove location/mood line and standalone tags from display content
  const displayContent = memo.content
    .replace(/^#\S+\s*/gm, '')
    .replace(/(?:📍|位置)[^\n]*/g, '')
    .trim();


  const images = memo.attachments.filter(a => a.type.startsWith('image/'));
  const otherFiles = memo.attachments.filter(a => !a.type.startsWith('image/'));

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm hover:shadow-md transition p-4 group">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span>{timeAgo}</span>
          <VisIcon className="w-3.5 h-3.5" />
          {memo.pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
          {location && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {location}
            </span>
          )}
          {mood && (
            <span className="flex items-center gap-0.5">
              <Smile className="w-3 h-3" />
              {mood}
            </span>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-lg text-text-secondary opacity-0 group-hover:opacity-100 hover:bg-surface-secondary transition"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-surface rounded-lg border border-border shadow-lg py-1 z-20 min-w-[120px]">
                {onPin && (
                  <button
                    onClick={() => { onPin(memo); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary"
                  >
                    <Pin className="w-3.5 h-3.5" />
                    {memo.pinned ? '取消置顶' : '置顶'}
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={() => { onEdit(memo); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    编辑
                  </button>
                )}
                {onArchive && (
                  <button
                    onClick={() => { onArchive(memo); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    归档
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => { onDelete(memo); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="markdown-body text-[15px]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
      </div>

      {/* Images grid */}
      {images.length > 0 && (
        <>
          <div className={`mt-3 gap-2 ${
            images.length === 1 ? 'flex' :
            images.length === 2 ? 'grid grid-cols-2' :
            'grid grid-cols-3'
          }`}>
            {images.map((img, i) => (
              <button
                key={img.name}
                onClick={() => setLightboxIndex(i)}
                className="block overflow-hidden rounded-lg cursor-zoom-in"
              >
                <img
                  src={getAttachmentUrl(img.name, img.filename)}
                  alt={img.filename}
                  className="w-full max-h-80 object-contain rounded-lg"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
          {lightboxIndex !== null && (
            <ImageLightbox
              images={images.map(img => ({ src: getAttachmentUrl(img.name, img.filename), alt: img.filename }))}
              currentIndex={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
              onChangeIndex={setLightboxIndex}
            />
          )}
        </>
      )}

      {/* Other attachments */}
      {otherFiles.length > 0 && (
        <div className="mt-3 space-y-1">
          {otherFiles.map((file) => (
            <a
              key={file.name}
              href={getAttachmentUrl(file.name, file.filename)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-secondary text-sm text-text-secondary hover:text-primary transition"
            >
              📎 {file.filename}
              <span className="text-xs">({(Number(file.size) / 1024).toFixed(1)} KB)</span>
            </a>
          ))}
        </div>
      )}

      {/* Tags */}
      {memo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {memo.tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagClick?.(tag)}
              className={`px-2 py-0.5 rounded-md text-xs font-medium transition cursor-pointer ${
                activeTags.includes(tag)
                  ? 'bg-primary text-white'
                  : 'bg-tag text-tag-text hover:bg-primary/15'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Pin, MoreHorizontal, Edit3, Trash2, Archive, Globe, Lock, Users,
  MapPin, Smile, ExternalLink, Link2, ClipboardCopy, Copy, ChevronRight, Paperclip,
} from 'lucide-react';
import type { Memo } from '../types';
import { getAttachmentUrl } from '../api/memos';
import AuthedImage from './AuthedImage';
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
  absoluteTime?: boolean;
  onToggleTime?: () => void;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
}

export default function MemoCard({ memo, onEdit, onDelete, onArchive, onPin, onTagClick, activeTags = [], absoluteTime = false, onToggleTime, menuOpen, onMenuOpenChange }: MemoCardProps) {
  const [internalShowMenu, setInternalShowMenu] = useState(false);
  const showMenu = menuOpen ?? internalShowMenu;
  const setShowMenu = (v: boolean) => {
    if (onMenuOpenChange) onMenuOpenChange(v);
    else setInternalShowMenu(v);
  };
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const copyCloseTimer = useRef<number | null>(null);

  const openCopy = () => {
    if (copyCloseTimer.current != null) {
      window.clearTimeout(copyCloseTimer.current);
      copyCloseTimer.current = null;
    }
    setCopyOpen(true);
  };
  const scheduleCloseCopy = () => {
    if (copyCloseTimer.current != null) window.clearTimeout(copyCloseTimer.current);
    copyCloseTimer.current = window.setTimeout(() => setCopyOpen(false), 150);
  };

  useEffect(() => {
    if (!showMenu) setCopyOpen(false);
  }, [showMenu]);

  useEffect(() => () => {
    if (copyCloseTimer.current != null) window.clearTimeout(copyCloseTimer.current);
  }, []);

  const VisIcon = visIcons[memo.visibility];

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label}已复制`);
    } catch {
      toast.error('复制失败');
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/memo/${memo.name}`;
    copyToClipboard(url, '链接');
    setShowMenu(false);
  };

  const handleCopyContent = () => {
    copyToClipboard(memo.content, '内容');
    setShowMenu(false);
  };

  const displayDate = new Date(memo.displayTime);
  const timeLabel = absoluteTime
    ? format(displayDate, 'yyyy-MM-dd HH:mm')
    : formatDistanceToNowStrict(displayDate, { addSuffix: true, locale: zhCN });

  // Extract location and mood from content
  const locationMatch = memo.content.match(/(?:📍|位置)\s*[:：]?\s*([^\n💭心情]*)/);
  const location = locationMatch?.[1]?.trim();

  const moodMatch = memo.content.match(/(?:💭|心情)\s*[:：]?\s*([^\n]*)/);
  const mood = moodMatch?.[1]?.trim();

  // Memoize derived lists so ReactMarkdown's `components` prop stays
  // referentially stable across unrelated re-renders (e.g. menu toggle).
  // Otherwise the custom `img` renderer is a fresh function each render,
  // which React treats as a new element type → unmount/remount of the
  // entire <AuthedImage> subtree, which in turn refetches every image.
  const { displayContent, standaloneAttachments, images, otherFiles, allImages, inlineImageCount } = useMemo(() => {
    const displayContent = memo.content
      .replace(/(?:📍|位置)[^\n]*/g, '')
      .trim();
    const isInlineReferenced = (att: typeof memo.attachments[number]) => {
      const url = getAttachmentUrl(att.name, att.filename);
      return memo.content.includes(url) || memo.content.includes(att.name);
    };
    const standaloneAttachments = memo.attachments.filter(a => !isInlineReferenced(a));
    const images = standaloneAttachments.filter(a => a.type.startsWith('image/'));
    const otherFiles = standaloneAttachments.filter(a => !a.type.startsWith('image/'));
    const inlineImages = [...displayContent.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)]
      .map(m => ({ src: m[2], alt: m[1] || '' }));
    const standaloneImageSrcs = images.map(img => ({
      src: getAttachmentUrl(img.name, img.filename),
      alt: img.filename,
    }));
    const allImages = [...inlineImages, ...standaloneImageSrcs];
    return { displayContent, standaloneAttachments, images, otherFiles, allImages, inlineImageCount: inlineImages.length };
  }, [memo.content, memo.attachments]);

  const markdownComponents = useMemo(() => ({
    img: ({ src, alt }: { src?: string; alt?: string }) => {
      const idx = allImages.findIndex(im => im.src === src);
      return (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (idx >= 0) setLightboxIndex(idx); }}
          className="inline-block overflow-hidden rounded-lg cursor-zoom-in max-w-full bg-surface-secondary align-middle"
        >
          <AuthedImage
            src={src || ''}
            alt={alt || ''}
            className="block max-h-64 max-w-full w-auto h-auto"
            loading="lazy"
          />
        </button>
      );
    },
  }), [allImages]);

  return (
    <div className={`relative isolate bg-surface rounded-2xl border border-border shadow-sm hover:shadow-md p-4 group fade-in-up card-hover ${showMenu ? 'z-40' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <button
            type="button"
            onClick={onToggleTime}
            className="hover:text-primary transition cursor-pointer"
            title={absoluteTime ? '切换为相对时间' : '切换为具体时间'}
          >
            {timeLabel}
          </button>
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

        <div className="flex items-center gap-0.5">
          <Link
            to={`/memo/${memo.name}`}
            className="p-1 rounded-lg text-text-secondary opacity-0 group-hover:opacity-100 hover:bg-surface-secondary hover:text-primary transition"
            title="查看详情"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
          <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1 rounded-lg text-text-secondary opacity-0 group-hover:opacity-100 hover:bg-surface-secondary transition"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMenu && (
            <div
              data-memo-menu
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 bg-surface rounded-lg border border-border shadow-lg py-1 z-50 min-w-[120px] menu-pop"
            >
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
                <div
                  className="relative"
                  onMouseEnter={openCopy}
                  onMouseLeave={scheduleCloseCopy}
                >
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="flex-1 text-left">复制</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                  {copyOpen && (
                    <div
                      onMouseEnter={openCopy}
                      onMouseLeave={scheduleCloseCopy}
                      className="absolute left-full top-0 pl-1 min-w-[120px] menu-pop"
                    >
                      <div className="bg-surface rounded-lg border border-border shadow-lg py-1">
                        <button
                          onClick={handleCopyLink}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          复制链接
                        </button>
                        <button
                          onClick={handleCopyContent}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary"
                        >
                          <ClipboardCopy className="w-3.5 h-3.5" />
                          复制内容
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
          )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="markdown-body text-[15px]">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {displayContent}
        </ReactMarkdown>
      </div>

      {/* Attachments (only the ones not already inlined in the content) */}
      {standaloneAttachments.length > 0 && (
        <div className="mt-3 rounded-xl border-l-4 border-primary/50 bg-primary/5 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-primary">
            <Paperclip className="w-3.5 h-3.5" />
            <span>附件 ({standaloneAttachments.length})</span>
          </div>

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <button
                  key={img.name}
                  onClick={() => setLightboxIndex(inlineImageCount + i)}
                  className="inline-block overflow-hidden rounded-lg cursor-zoom-in max-w-full bg-surface-secondary"
                >
                  <AuthedImage
                    src={getAttachmentUrl(img.name, img.filename)}
                    alt={img.filename}
                    className="block max-h-64 max-w-full w-auto h-auto"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}

          {otherFiles.length > 0 && (
            <div className={`${images.length > 0 ? 'mt-2' : ''} space-y-1`}>
              {otherFiles.map((file) => (
                <a
                  key={file.name}
                  href={getAttachmentUrl(file.name, file.filename)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-secondary hover:text-primary hover:border-primary/40 transition"
                >
                  📎 {file.filename}
                  <span className="text-xs">({(Number(file.size) / 1024).toFixed(1)} KB)</span>
                </a>
              ))}
            </div>
          )}

        </div>
      )}

      {lightboxIndex !== null && allImages.length > 0 && (
        <ImageLightbox
          images={allImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
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

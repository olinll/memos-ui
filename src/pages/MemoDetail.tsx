import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ArrowLeft, Edit3, Loader2, Pin, MapPin, Smile,
  Globe, Lock, Users, Send, MessageCircle,
} from 'lucide-react';
import type { Memo, User } from '../types';
import {
  getMemo, getAttachmentUrl, listMemoComments, createMemoComment,
} from '../api/memos';
import { getUser } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import ImageLightbox from '../components/ImageLightbox';

const visIcons = {
  PUBLIC: Globe,
  PROTECTED: Users,
  PRIVATE: Lock,
};

const visLabels = {
  PUBLIC: '公开',
  PROTECTED: '登录可见',
  PRIVATE: '私密',
};

export default function MemoDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const memoName = params['*'];
  const { user } = useAuth();
  const [memo, setMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [comments, setComments] = useState<Memo[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [author, setAuthor] = useState<User | null>(null);
  const [userMap, setUserMap] = useState<Record<string, User>>({});

  useEffect(() => {
    if (!memoName) return;
    let cancelled = false;
    getMemo(memoName)
      .then(m => { if (!cancelled) setMemo(m); })
      .catch(() => { /* stay on null — renders the not-available state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    listMemoComments(memoName)
      .then(list => { if (!cancelled) setComments(list); })
      .catch(() => { /* comments optional */ })
      .finally(() => { if (!cancelled) setCommentsLoading(false); });
    return () => { cancelled = true; };
  }, [memoName]);

  useEffect(() => {
    if (!memo?.creator) return;
    let cancelled = false;
    getUser(memo.creator)
      .then(u => { if (!cancelled) setAuthor(u); })
      .catch(() => { /* author optional — fall back to raw creator id */ });
    return () => { cancelled = true; };
  }, [memo?.creator]);

  useEffect(() => {
    const unique = [...new Set(comments.map(c => c.creator).filter(Boolean))];
    const missing = unique.filter(u => !userMap[u]);
    if (missing.length === 0) return;
    Promise.all(missing.map(u => getUser(u).catch(() => null))).then(users => {
      setUserMap(prev => {
        const next = { ...prev };
        users.forEach((u, i) => { if (u) next[missing[i]] = u; });
        return next;
      });
    });
  }, [comments, userMap]);

  const handlePostComment = async () => {
    if (!memoName || !newComment.trim() || posting) return;
    setPosting(true);
    try {
      const created = await createMemoComment(memoName, newComment.trim());
      setComments(prev => [...prev, created]);
      setNewComment('');
      toast.success('评论已发布');
    } catch (e) {
      toast.error(`发布失败：${(e as Error).message || e}`);
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
      </div>
    );
  }

  if (!memo) {
    return (
      <div className="text-center py-12 text-text-secondary space-y-2">
        <p>无法查看该 Memo</p>
        <p className="text-xs">可能已被删除，或仅对登录用户可见。</p>
        {!user && (
          <button
            onClick={() => navigate('/login')}
            className="text-primary text-sm hover:underline"
          >
            去登录
          </button>
        )}
      </div>
    );
  }

  const VisIcon = visIcons[memo.visibility];
  const locationMatch = memo.content.match(/(?:📍|位置)\s*[:：]?\s*([^\n💭心情]*)/);
  const location = locationMatch?.[1]?.trim();
  const moodMatch = memo.content.match(/(?:💭|心情)\s*[:：]?\s*([^\n]*)/);
  const mood = moodMatch?.[1]?.trim();
  const displayContent = memo.content.replace(/(?:📍|位置)[^\n]*/g, '').trim();

  const images = memo.attachments.filter(a => a.type.startsWith('image/'));
  const otherFiles = memo.attachments.filter(a => !a.type.startsWith('image/'));

  // Inline markdown images should also be clickable and share the lightbox.
  const inlineImages = [...displayContent.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)]
    .map(m => ({ src: m[2], alt: m[1] || '' }));
  const attachmentImageSrcs = images.map(img => ({
    src: getAttachmentUrl(img.name, img.filename),
    alt: img.filename,
  }));
  const allImages = [...inlineImages, ...attachmentImageSrcs];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        {user && user.name === memo.creator && (
          <button
            onClick={() => navigate(`/edit/${memo.name}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-primary hover:bg-tag transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
            编辑
          </button>
        )}
      </div>

      <article className="bg-surface rounded-2xl border border-border shadow-sm p-6 space-y-4">
        <header className="flex items-start gap-3 pb-3 border-b border-border">
          {author?.avatarUrl ? (
            <img
              src={author.avatarUrl}
              alt={author.displayName || author.username}
              className="w-10 h-10 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">
              {(author?.displayName || author?.username || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-medium text-text-primary truncate">
                {author?.displayName || author?.username || '…'}
              </span>
              <time className="text-xs text-text-secondary">
                {format(new Date(memo.displayTime), 'yyyy-MM-dd HH:mm:ss')}
              </time>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              <span className="flex items-center gap-1">
                <VisIcon className="w-3.5 h-3.5" />
                {visLabels[memo.visibility]}
              </span>
              {memo.pinned && (
                <span className="flex items-center gap-1 text-primary">
                  <Pin className="w-3.5 h-3.5" />
                  置顶
                </span>
              )}
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {location}
                </span>
              )}
              {mood && (
                <span className="flex items-center gap-1">
                  <Smile className="w-3.5 h-3.5" />
                  {mood}
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="markdown-body text-[15px]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              img: ({ src, alt }) => {
                const idx = allImages.findIndex(im => im.src === src);
                return (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (idx >= 0) setLightboxIndex(idx); }}
                    className="inline-block overflow-hidden rounded-lg cursor-zoom-in max-w-full align-middle"
                  >
                    <img
                      src={src}
                      alt={alt || ''}
                      className="block max-h-[60vh] max-w-full w-auto h-auto"
                      loading="lazy"
                    />
                  </button>
                );
              },
            }}
          >
            {displayContent}
          </ReactMarkdown>
        </div>

        {images.length > 0 && (
          <div className={`gap-2 ${
            images.length === 1 ? 'flex' :
            images.length === 2 ? 'grid grid-cols-2' :
            'grid grid-cols-3'
          }`}>
            {images.map((img, i) => (
              <button
                key={img.name}
                onClick={() => setLightboxIndex(inlineImages.length + i)}
                className="block overflow-hidden rounded-lg cursor-zoom-in"
              >
                <img
                  src={getAttachmentUrl(img.name, img.filename)}
                  alt={img.filename}
                  className="w-full max-h-[60vh] object-contain rounded-lg"
                  loading="lazy"
                />
              </button>
            ))}
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

        {otherFiles.length > 0 && (
          <div className="space-y-1">
            {otherFiles.map(file => (
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

        {memo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border">
            {memo.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-tag text-tag-text text-xs font-medium">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </article>

      {/* Comments */}
      <section className="bg-surface rounded-2xl border border-border shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <MessageCircle className="w-4 h-4" />
          <span>评论</span>
          <span className="text-text-secondary">({comments.length})</span>
        </div>

        {commentsLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-text-secondary py-2">还没有评论，来写下第一条吧</p>
        ) : (
          <ul className="space-y-3">
            {comments.map(c => {
              const u = userMap[c.creator];
              const displayName = u?.displayName || u?.username || '…';
              const initial = (u?.displayName || u?.username || '?').slice(0, 1).toUpperCase();
              return (
                <li key={c.name} className="flex gap-3">
                  {u?.avatarUrl ? (
                    <img
                      src={u.avatarUrl}
                      alt={displayName}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                      {initial}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 text-xs text-text-secondary mb-0.5">
                      <span className="font-medium text-text-primary">{displayName}</span>
                      <span>{formatDistanceToNowStrict(new Date(c.displayTime || c.createTime), { addSuffix: true, locale: zhCN })}</span>
                    </div>
                    <div className="markdown-body text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.content}</ReactMarkdown>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {user ? (
          <div className="pt-3 border-t border-border space-y-2">
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handlePostComment();
                }
              }}
              placeholder="写下你的评论...（Ctrl+Enter 发布）"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary placeholder:text-text-secondary/50 resize-none focus:outline-none focus:border-primary/50 transition"
            />
            <div className="flex justify-end">
              <button
                onClick={handlePostComment}
                disabled={!newComment.trim() || posting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                发布评论
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-3 border-t border-border text-sm text-text-secondary text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-primary hover:underline"
            >
              登录
            </button>
            {' '}后即可发布评论
          </div>
        )}
      </section>
    </div>
  );
}

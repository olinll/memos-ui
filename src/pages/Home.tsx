import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X, PenSquare } from 'lucide-react';
import MemoCard from '../components/MemoCard';
import type { Memo } from '../types';
import { listMemos, updateMemo, deleteMemo } from '../api/memos';

export default function Home() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextPageToken, setNextPageToken] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const navigate = useNavigate();

  const fetchMemos = useCallback(async (pageToken?: string) => {
    const isLoadMore = !!pageToken;
    if (isLoadMore) setLoadingMore(true); else setLoading(true);

    try {
      const res = await listMemos(20, pageToken);
      if (isLoadMore) {
        setMemos(prev => [...prev, ...res.memos]);
      } else {
        setMemos(res.memos);
      }
      setNextPageToken(res.nextPageToken);
    } finally {
      if (isLoadMore) setLoadingMore(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMemos(); }, [fetchMemos]);

  const handleDelete = async (memo: Memo) => {
    if (!confirm('确定要删除这条 Memo 吗？')) return;
    await deleteMemo(memo.name);
    setMemos(prev => prev.filter(m => m.name !== memo.name));
  };

  const handlePin = async (memo: Memo) => {
    const updated = await updateMemo(memo.name, { pinned: !memo.pinned });
    setMemos(prev => prev.map(m => m.name === updated.name ? updated : m));
  };

  const handleArchive = async (memo: Memo) => {
    const updated = await updateMemo(memo.name, { state: 'ARCHIVED' } as never);
    setMemos(prev => prev.filter(m => m.name !== updated.name));
  };

  const handleTagClick = useCallback((tag: string) => {
    setFilterTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Filter by tags (memo must contain ALL selected tags), then separate pinned and unpinned
  const filtered = filterTags.length > 0
    ? memos.filter(m => filterTags.every(t => m.tags.includes(t)))
    : memos;
  const pinnedMemos = filtered.filter(m => m.pinned);
  const normalMemos = filtered.filter(m => !m.pinned);

  return (
    <div className="space-y-6">
      {/* Quick input */}
      <button
        onClick={() => navigate('/write')}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface rounded-2xl border border-border shadow-sm text-text-secondary/50 hover:border-primary/30 hover:shadow-md transition cursor-text text-left"
      >
        <PenSquare className="w-4 h-4 shrink-0" />
        <span className="text-[15px]">记录此刻的想法...</span>
      </button>

      {/* Tag filter */}
      {filterTags.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-tag/50 rounded-lg text-sm flex-wrap">
          <span className="text-text-secondary">标签筛选:</span>
          {filterTags.map(tag => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary-hover transition"
            >
              #{tag}
              <X className="w-3 h-3" />
            </button>
          ))}
          <button
            onClick={() => setFilterTags([])}
            className="ml-auto text-xs text-text-secondary hover:text-text-primary transition"
          >
            清除全部
          </button>
        </div>
      )}

      {/* Memo list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pinned */}
          {pinnedMemos.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">置顶</h3>
              {pinnedMemos.map(memo => (
                <MemoCard
                  key={memo.name}
                  memo={memo}
                  onDelete={handleDelete}
                  onPin={handlePin}
                  onArchive={handleArchive}
                  onTagClick={handleTagClick}
                  activeTags={filterTags}
                />
              ))}
            </>
          )}

          {/* Normal */}
          {normalMemos.map(memo => (
            <MemoCard
              key={memo.name}
              memo={memo}
              onDelete={handleDelete}
              onPin={handlePin}
              onArchive={handleArchive}
              onTagClick={handleTagClick}
            />
          ))}

          {memos.length === 0 && (
            <div className="text-center py-12 text-text-secondary">
              <p className="text-lg">还没有 Memo</p>
              <p className="text-sm mt-1">写下你的第一条想法吧</p>
            </div>
          )}

          {/* Load more */}
          {nextPageToken && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => fetchMemos(nextPageToken)}
                disabled={loadingMore}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                加载更多
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Loader2, X, PenSquare, Rows3, Columns2 } from 'lucide-react';
import MemoCard from '../components/MemoCard';
import ActivityHeatmap from '../components/ActivityHeatmap';
import { useAuth } from '../contexts/AuthContext';
import type { Memo } from '../types';
import { listMemos, updateMemo, deleteMemo, getUserStats } from '../api/memos';

export default function Home() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextPageToken, setNextPageToken] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [absoluteTime, setAbsoluteTime] = useState(false);
  const [activity, setActivity] = useState<Record<string, number>>({});
  const [menuOpenName, setMenuOpenName] = useState<string | null>(null);
  const [layout, setLayout] = useState<'single' | 'double'>(
    () => (localStorage.getItem('memos-layout') as 'single' | 'double') || 'double'
  );

  useEffect(() => {
    localStorage.setItem('memos-layout', layout);
  }, [layout]);

  const changeLayout = useCallback((next: 'single' | 'double') => {
    if (next === layout) return;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition) {
      doc.startViewTransition(() => flushSync(() => setLayout(next)));
    } else {
      setLayout(next);
    }
  }, [layout]);

  useEffect(() => {
    if (!menuOpenName) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-memo-menu]')) setMenuOpenName(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [menuOpenName]);
  const navigate = useNavigate();
  const { user } = useAuth();

  const toLocalDateKey = (ts: string | Date): string => {
    const d = typeof ts === 'string' ? new Date(ts) : ts;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!user) return;
    getUserStats(user.name)
      .then(stats => {
        const counts: Record<string, number> = {};
        for (const ts of stats.memoDisplayTimestamps || []) {
          const key = toLocalDateKey(ts);
          counts[key] = (counts[key] || 0) + 1;
        }
        if (Object.keys(counts).length > 0) setActivity(counts);
      })
      .catch((e) => console.warn('getUserStats failed:', e));
  }, [user]);

  // Fallback / merge: count loaded memos by displayTime so the heatmap is never empty
  useEffect(() => {
    if (memos.length === 0) return;
    setActivity(prev => {
      if (Object.keys(prev).length > 0) return prev;
      const counts: Record<string, number> = {};
      for (const m of memos) {
        const key = toLocalDateKey(m.displayTime);
        counts[key] = (counts[key] || 0) + 1;
      }
      return counts;
    });
  }, [memos]);

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

  const handleEdit = (memo: Memo) => {
    navigate(`/edit/${memo.name}`);
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
      {/* Activity heatmap — only meaningful when viewing as the signed-in user */}
      {user && <ActivityHeatmap counts={activity} />}

      {/* Quick input + layout toggle */}
      <div className="flex items-stretch gap-3 fade-in">
        <button
          onClick={() => navigate(user ? '/write' : '/login')}
          className="flex-1 flex items-center gap-3 px-4 py-3 bg-surface rounded-2xl border border-border shadow-sm text-text-secondary/50 hover:border-primary/30 hover:shadow-md cursor-text text-left card-hover"
        >
          <PenSquare className="w-4 h-4 shrink-0" />
          <span className="text-[15px]">
            {user ? '记录此刻的想法...' : '登录后开始记录'}
          </span>
        </button>
        <div className="inline-flex items-center bg-surface border border-border rounded-2xl p-1 shadow-sm shrink-0">
          <button
            onClick={() => changeLayout('single')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition ${
              layout === 'single' ? 'bg-tag text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
            title="单栏"
          >
            <Rows3 className="w-3.5 h-3.5" />
            单栏
          </button>
          <button
            onClick={() => changeLayout('double')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition ${
              layout === 'double' ? 'bg-tag text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
            title="双栏"
          >
            <Columns2 className="w-3.5 h-3.5" />
            双栏
          </button>
        </div>
      </div>

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
        <div className="space-y-4" style={{ viewTransitionName: 'memo-list' }}>
          {/* Pinned */}
          {pinnedMemos.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">置顶</h3>
              <div className={layout === 'double' ? 'columns-2 gap-4 [column-fill:balance]' : 'space-y-4'}>
                {pinnedMemos.map(memo => {
                  const canManage = !!user && user.name === memo.creator;
                  return (
                    <div key={memo.name} className={layout === 'double' ? 'mb-4 break-inside-avoid' : ''}>
                      <MemoCard
                        memo={memo}
                        onEdit={canManage ? handleEdit : undefined}
                        onDelete={canManage ? handleDelete : undefined}
                        onPin={canManage ? handlePin : undefined}
                        onArchive={canManage ? handleArchive : undefined}
                        onTagClick={handleTagClick}
                        activeTags={filterTags}
                        absoluteTime={absoluteTime}
                        onToggleTime={() => setAbsoluteTime(v => !v)}
                        menuOpen={menuOpenName === memo.name}
                        onMenuOpenChange={(open) => setMenuOpenName(open ? memo.name : null)}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Normal */}
          <div className={layout === 'double' ? 'columns-2 gap-4 [column-fill:balance]' : 'space-y-4'}>
            {normalMemos.map(memo => {
              const canManage = !!user && user.name === memo.creator;
              return (
                <div key={memo.name} className={layout === 'double' ? 'mb-4 break-inside-avoid' : ''}>
                  <MemoCard
                    memo={memo}
                    onEdit={canManage ? handleEdit : undefined}
                    onDelete={canManage ? handleDelete : undefined}
                    onPin={canManage ? handlePin : undefined}
                    onArchive={canManage ? handleArchive : undefined}
                    onTagClick={handleTagClick}
                    activeTags={filterTags}
                    absoluteTime={absoluteTime}
                    onToggleTime={() => setAbsoluteTime(v => !v)}
                    menuOpen={menuOpenName === memo.name}
                    onMenuOpenChange={(open) => setMenuOpenName(open ? memo.name : null)}
                  />
                </div>
              );
            })}
          </div>

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

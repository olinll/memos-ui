import { useState, useEffect } from 'react';
import { Loader2, Archive, RotateCcw } from 'lucide-react';
import MemoCard from '../components/MemoCard';
import type { Memo } from '../types';
import { listMemos, updateMemo, deleteMemo } from '../api/memos';

export default function Archived() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMemos(100, undefined, 'state == "ARCHIVED"').then(res => {
      setMemos(res.memos);
      setLoading(false);
    });
  }, []);

  const handleRestore = async (memo: Memo) => {
    const updated = await updateMemo(memo.name, { state: 'NORMAL' } as never);
    setMemos(prev => prev.filter(m => m.name !== updated.name));
  };

  const handleDelete = async (memo: Memo) => {
    if (!confirm('确定要永久删除这条 Memo 吗？此操作不可恢复。')) return;
    await deleteMemo(memo.name);
    setMemos(prev => prev.filter(m => m.name !== memo.name));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Archive className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-text-primary">归档</h2>
      </div>

      {memos.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <p>没有归档的 Memo</p>
        </div>
      ) : (
        <div className="space-y-4">
          {memos.map(memo => (
            <div key={memo.name} className="relative">
              <MemoCard memo={memo} onDelete={handleDelete} />
              <button
                onClick={() => handleRestore(memo)}
                className="absolute top-4 right-12 flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-primary bg-tag hover:bg-primary/10 transition"
              >
                <RotateCcw className="w-3 h-3" />
                恢复
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

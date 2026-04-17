import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Globe, Lock, Users, ChevronDown, MapPin, Smile,
  Loader2, Trash2,
} from 'lucide-react';
import LiveEditor from '../components/MilkdownEditor';
import { createMemo } from '../api/memos';

const DRAFT_KEY = 'memos-draft';

interface Draft {
  content: string;
  location: string;
  mood: string;
  visibility: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  updatedAt: number;
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { content: '', location: '', mood: '', visibility: 'PUBLIC', updatedAt: 0 };
}

function saveDraft(draft: Draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, updatedAt: Date.now() }));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

const visibilityOptions = [
  { value: 'PUBLIC' as const, label: '公开', icon: Globe },
  { value: 'PROTECTED' as const, label: '登录可见', icon: Users },
  { value: 'PRIVATE' as const, label: '私密', icon: Lock },
];

export default function Write() {
  const navigate = useNavigate();
  const [draft] = useState<Draft>(loadDraft);
  const [content, setContent] = useState(draft.content);
  const [location, setLocation] = useState(draft.location);
  const [mood, setMood] = useState(draft.mood);
  const [visibility, setVisibility] = useState(draft.visibility);
  const [showVisMenu, setShowVisMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState(draft.updatedAt);

  // Auto-save draft
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft({ content, location, mood, visibility, updatedAt: Date.now() });
      setLastSaved(Date.now());
    }, 500);
    return () => clearTimeout(timer);
  }, [content, location, mood, visibility]);

  const handleContentChange = useCallback((markdown: string) => {
    setContent(markdown);
  }, []);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const metaParts: string[] = [];
      if (location.trim()) metaParts.push(`位置: ${location.trim()}`);
      if (mood.trim()) metaParts.push(`心情: ${mood.trim()}`);
      const metaLine = metaParts.length > 0 ? metaParts.join(' ') + '\n\n' : '';

      await createMemo({ content: metaLine + content, visibility });
      clearDraft();
      navigate('/');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearDraft = () => {
    if (!content.trim() || confirm('确定要清空草稿吗？')) {
      clearDraft();
      setContent('');
      setLocation('');
      setMood('');
    }
  };

  const currentVis = visibilityOptions.find(v => v.value === visibility)!;

  const savedTimeAgo = lastSaved
    ? `已自动保存 ${new Date(lastSaved).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">写 Memo</h2>
        {savedTimeAgo && (
          <span className="text-xs text-text-secondary/60">{savedTimeAgo}</span>
        )}
      </div>

      {/* Editor */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
        <LiveEditor content={content} onChange={handleContentChange} location={location} mood={mood} />

        {/* Location & Mood */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border shrink-0">
          <div className="flex items-center gap-1.5 text-text-secondary">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="位置"
              className="w-24 bg-transparent text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
            />
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5 text-text-secondary">
            <Smile className="w-3.5 h-3.5 shrink-0" />
            <input
              type="text"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="心情"
              className="w-24 bg-transparent text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border shrink-0">
          <div className="flex items-center gap-2">
            {/* Visibility */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowVisMenu(!showVisMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-surface-secondary transition"
              >
                <currentVis.icon className="w-3.5 h-3.5" />
                <span>{currentVis.label}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showVisMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowVisMenu(false)} />
                  <div className="absolute bottom-full left-0 mb-1 bg-surface rounded-lg border border-border shadow-lg py-1 z-20 min-w-[130px]">
                    {visibilityOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setVisibility(opt.value); setShowVisMenu(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition ${
                          visibility === opt.value ? 'text-primary bg-tag' : 'text-text-secondary hover:bg-surface-secondary'
                        }`}
                      >
                        <opt.icon className="w-3.5 h-3.5" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Clear */}
            <button
              type="button"
              onClick={handleClearDraft}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-text-secondary hover:text-red-500 hover:bg-red-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空
            </button>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            发布
          </button>
        </div>
      </div>
    </div>
  );
}

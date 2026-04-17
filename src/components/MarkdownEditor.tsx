import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote, Link,
  Image, Heading1, Heading2, Heading3, CheckSquare, Minus, Eye, EyeOff,
  Send, Globe, Lock, Users, ChevronDown, MapPin, Smile,
} from 'lucide-react';

interface ToolbarAction {
  icon: React.FC<{ className?: string }>;
  label: string;
  prefix: string;
  suffix?: string;
  block?: boolean;
}

const toolbarActions: (ToolbarAction | 'divider')[] = [
  { icon: Heading1, label: 'H1', prefix: '# ', block: true },
  { icon: Heading2, label: 'H2', prefix: '## ', block: true },
  { icon: Heading3, label: 'H3', prefix: '### ', block: true },
  'divider',
  { icon: Bold, label: '粗体', prefix: '**', suffix: '**' },
  { icon: Italic, label: '斜体', prefix: '*', suffix: '*' },
  { icon: Strikethrough, label: '删除线', prefix: '~~', suffix: '~~' },
  { icon: Code, label: '代码', prefix: '`', suffix: '`' },
  'divider',
  { icon: List, label: '无序列表', prefix: '- ', block: true },
  { icon: ListOrdered, label: '有序列表', prefix: '1. ', block: true },
  { icon: CheckSquare, label: '任务列表', prefix: '- [ ] ', block: true },
  { icon: Quote, label: '引用', prefix: '> ', block: true },
  { icon: Minus, label: '分割线', prefix: '\n---\n', block: true },
  'divider',
  { icon: Link, label: '链接', prefix: '[', suffix: '](url)' },
  { icon: Image, label: '图片', prefix: '![', suffix: '](url)' },
];

const visibilityOptions = [
  { value: 'PUBLIC' as const, label: '公开', icon: Globe },
  { value: 'PROTECTED' as const, label: '登录可见', icon: Users },
  { value: 'PRIVATE' as const, label: '私密', icon: Lock },
];

interface MarkdownEditorProps {
  initialContent?: string;
  initialVisibility?: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  onSubmit: (content: string, visibility: 'PUBLIC' | 'PROTECTED' | 'PRIVATE') => Promise<void>;
  submitLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
  minRows?: number;
}

export default function MarkdownEditor({
  initialContent = '',
  initialVisibility = 'PUBLIC',
  onSubmit,
  submitLabel = '发布',
  placeholder = '记录此刻的想法...',
  autoFocus = false,
  minRows = 4,
}: MarkdownEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [location, setLocation] = useState('');
  const [mood, setMood] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showVisMenu, setShowVisMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = useCallback((action: ToolbarAction) => {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.substring(start, end);
    const before = content.substring(0, start);
    const after = content.substring(end);

    let newContent: string;
    let cursorPos: number;

    if (action.block) {
      const lineStart = before.lastIndexOf('\n') + 1;
      const prefix = action.prefix;
      newContent = before.substring(0, lineStart) + prefix + before.substring(lineStart) + selected + after;
      cursorPos = start + prefix.length + selected.length;
    } else {
      const suffix = action.suffix || '';
      newContent = before + action.prefix + (selected || action.label) + suffix + after;
      if (selected) {
        cursorPos = start + action.prefix.length + selected.length + suffix.length;
      } else {
        cursorPos = start + action.prefix.length;
      }
    }

    setContent(newContent);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursorPos, cursorPos);
    });
  }, [content]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
      return;
    }
    // Ctrl+B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      insertMarkdown({ icon: Bold, label: '粗体', prefix: '**', suffix: '**' });
      return;
    }
    // Ctrl+I for italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      insertMarkdown({ icon: Italic, label: '斜体', prefix: '*', suffix: '*' });
      return;
    }
    // Tab for indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const newContent = content.substring(0, start) + '  ' + content.substring(ta.selectionEnd);
      setContent(newContent);
      requestAnimationFrame(() => {
        ta.setSelectionRange(start + 2, start + 2);
      });
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      // Build metadata line: 位置: xxx 心情: xxx
      const metaParts: string[] = [];
      if (location.trim()) metaParts.push(`位置: ${location.trim()}`);
      if (mood.trim()) metaParts.push(`心情: ${mood.trim()}`);
      const metaLine = metaParts.length > 0 ? metaParts.join(' ') + '\n\n' : '';

      await onSubmit(metaLine + content, visibility);
      setContent('');
      setLocation('');
      setMood('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Auto-resize
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  };

  const currentVis = visibilityOptions.find(v => v.value === visibility)!;

  // Strip tag syntax for display in content (tags starting with #)
  const displayContent = content.replace(/#(\S+)/g, '`#$1`');

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="editor-toolbar flex items-center gap-0.5 px-3 py-1.5 border-b border-border overflow-x-auto">
        {toolbarActions.map((action, i) =>
          action === 'divider' ? (
            <div key={i} className="w-px h-5 bg-border mx-1" />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => insertMarkdown(action)}
              className="p-1.5 rounded-md text-text-secondary hover:text-text-primary"
              title={action.label}
            >
              <action.icon className="w-4 h-4" />
            </button>
          )
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className={`p-1.5 rounded-md transition ${showPreview ? 'text-primary bg-tag' : 'text-text-secondary hover:text-text-primary'}`}
          title={showPreview ? '编辑' : '预览'}
        >
          {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* Content area */}
      {showPreview ? (
        <div className="markdown-body px-4 py-3 min-h-[120px]">
          {content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
          ) : (
            <p className="text-text-secondary italic">暂无内容</p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={minRows}
          className="w-full px-4 py-3 resize-none bg-transparent text-text-primary placeholder:text-text-secondary/50 focus:outline-none text-[15px] leading-relaxed"
        />
      )}

      {/* Location & Mood */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border">
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
      <div className="flex items-center justify-between px-3 py-2 border-t border-border">
        <div className="flex items-center gap-2">
          {/* Visibility selector */}
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
          <span className="text-xs text-text-secondary/50">Ctrl+Enter 发布</span>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!content.trim() || submitting}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

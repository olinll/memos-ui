import { useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote, Link,
  Image, Heading1, Heading2, Heading3, CheckSquare, Minus,
  MapPin, Smile,
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

interface LiveEditorProps {
  content: string;
  onChange: (content: string) => void;
  location?: string;
  mood?: string;
}

export default function LiveEditor({ content, onChange, location, mood }: LiveEditorProps) {
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
      cursorPos = selected
        ? start + action.prefix.length + selected.length + suffix.length
        : start + action.prefix.length;
    }

    onChange(newContent);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursorPos, cursorPos);
    });
  }, [content, onChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      insertMarkdown({ icon: Bold, label: '粗体', prefix: '**', suffix: '**' });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      insertMarkdown({ icon: Italic, label: '斜体', prefix: '*', suffix: '*' });
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const newContent = content.substring(0, start) + '  ' + content.substring(ta.selectionEnd);
      onChange(newContent);
      requestAnimationFrame(() => ta.setSelectionRange(start + 2, start + 2));
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border overflow-x-auto shrink-0">
        {toolbarActions.map((action, i) =>
          action === 'divider' ? (
            <div key={i} className="w-px h-5 bg-border mx-1" />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => insertMarkdown(action)}
              className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition"
              title={action.label}
            >
              <action.icon className="w-4 h-4" />
            </button>
          )
        )}
      </div>

      {/* Split pane: editor + preview */}
      <div className="flex flex-1 min-h-0">
        {/* Editor */}
        <div className="w-1/2 border-r border-border">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="输入 Markdown..."
            autoFocus
            className="w-full h-full px-4 py-3 resize-none bg-transparent text-text-primary placeholder:text-text-secondary/50 focus:outline-none text-[15px] leading-relaxed font-mono"
          />
        </div>

        {/* Live preview */}
        <div className="w-1/2 overflow-y-auto px-4 py-3 flex flex-col">
          {/* Meta: location & mood */}
          {(location || mood) && (
            <div className="flex items-center gap-2 text-sm text-text-secondary mb-2">
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
          )}

          {/* Content */}
          <div className="markdown-body text-[15px] flex-1">
            {content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content.replace(/(?:^|\n)#(?!#)\S+\s*/g, '\n').trim()}
              </ReactMarkdown>
            ) : (
              <p className="text-text-secondary/40 italic">预览区域</p>
            )}
          </div>

          {/* Tags - pinned to bottom */}
          {(() => {
            const tags = [...content.matchAll(/(?:^|\s)#([^\s#]+)/g)].map(m => m[1]);
            if (tags.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1.5 pt-3 mt-auto border-t border-border">
                {tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-tag text-tag-text text-xs font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

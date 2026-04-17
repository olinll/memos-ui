import { useMemo, useState, useRef, useEffect, type CSSProperties } from 'react';
import { format, startOfDay, subDays, addDays, getDay, isSameDay } from 'date-fns';

interface Props {
  counts: Record<string, number>;
}

const LEVEL_CLASSES = [
  'bg-surface-secondary border border-border',
  'bg-primary/20',
  'bg-primary/45',
  'bg-primary/70',
  'bg-primary',
];

const WEEKS = 53;
const LABEL_COL = '32px';
const GAP = '3px';
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const SNAKE_LEN = 4;
const TOTAL_STEPS = WEEKS * 7;

function level(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

// GitHub-style path: week-by-week (column), alternating top→bottom / bottom→top
function pathToCell(step: number): { col: number; row: number } {
  const s = ((step % TOTAL_STEPS) + TOTAL_STEPS) % TOTAL_STEPS;
  const col = Math.floor(s / 7);
  const rowInCol = s % 7;
  const row = col % 2 === 0 ? rowInCol : (6 - rowInCol);
  return { col, row };
}

export default function ActivityHeatmap({ counts }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [snakeOn, setSnakeOn] = useState(false);
  const [snakeIdx, setSnakeIdx] = useState(0);
  const [eaten, setEaten] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!snakeOn) return;
    let cancelled = false;
    let last = performance.now();
    const STEP_MS = 110;
    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      if (now - last >= STEP_MS) {
        setSnakeIdx(i => {
          const next = (i + 1) % TOTAL_STEPS;
          if (next === 0) setEaten(new Set());
          return next;
        });
        last = now;
      }
      requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [snakeOn]);

  useEffect(() => {
    if (!snakeOn) return;
    const head = pathToCell(snakeIdx);
    const key = `${head.col}-${head.row}`;
    setEaten(prev => {
      if (prev.has(key)) return prev;
      const n = new Set(prev);
      n.add(key);
      return n;
    });
  }, [snakeIdx, snakeOn]);

  // Reset state when snake is turned off
  useEffect(() => {
    if (!snakeOn) {
      setSnakeIdx(0);
      setEaten(new Set());
    }
  }, [snakeOn]);

  const snakeCells = snakeOn
    ? Array.from({ length: SNAKE_LEN }, (_, i) => pathToCell(snakeIdx - i))
    : [];
  const isSnake = (col: number, row: number) =>
    snakeOn ? snakeCells.findIndex(c => c.col === col && c.row === row) : -1;
  const isEaten = (col: number, row: number) => snakeOn && eaten.has(`${col}-${row}`);

  const { weeks, monthMarkers, totalCount, activeDays, maxStreak } = useMemo(() => {
    const today = startOfDay(new Date());
    const todayDow = getDay(today);
    const start = subDays(today, (WEEKS - 1) * 7 + todayDow);

    const weeks: Array<Array<{ date: Date; count: number } | null>> = [];
    const monthMarkers: Array<{ col: number; label: string }> = [];
    let prevMonth = -1;
    let cursor = start;
    let total = 0;
    let active = 0;
    let streak = 0;
    let maxS = 0;

    for (let w = 0; w < WEEKS; w++) {
      const week: Array<{ date: Date; count: number } | null> = [];
      for (let d = 0; d < 7; d++) {
        if (cursor > today) {
          week.push(null);
        } else {
          const key = format(cursor, 'yyyy-MM-dd');
          const count = counts[key] || 0;
          week.push({ date: new Date(cursor), count });
          if (count > 0) { total += count; active++; streak++; maxS = Math.max(maxS, streak); }
          else streak = 0;
          if (d === 0) {
            const m = cursor.getMonth();
            if (m !== prevMonth) { monthMarkers.push({ col: w, label: MONTH_LABELS[m] }); prevMonth = m; }
          }
        }
        cursor = addDays(cursor, 1);
      }
      weeks.push(week);
    }
    return { weeks, monthMarkers, totalCount: total, activeDays: active, maxStreak: maxS };
  }, [counts]);

  const today = startOfDay(new Date());
  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `${LABEL_COL} repeat(${WEEKS}, minmax(0, 1fr))`,
    gap: GAP,
  };

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-4 fade-in">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">活跃度</h3>
          <button
            type="button"
            onClick={() => setSnakeOn(v => !v)}
            title={snakeOn ? '关闭贪吃蛇动画' : '点我召唤贪吃蛇吃掉你的活跃度 🐍'}
            className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition ${
              snakeOn
                ? 'bg-primary/15 text-primary border-primary/40 shadow-sm'
                : 'bg-tag/60 text-text-secondary border-border hover:bg-primary/10 hover:text-primary hover:border-primary/40 animate-pulse'
            }`}
          >
            <span className={`text-sm leading-none transition-transform ${snakeOn ? '' : 'group-hover:translate-x-0.5'}`}>
              🐍
            </span>
            <span>{snakeOn ? '贪吃蛇进行中' : '贪吃蛇'}</span>
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <span>过去一年 · <span className="text-text-primary font-medium">{totalCount}</span> 条</span>
          <span>活跃 <span className="text-text-primary font-medium">{activeDays}</span> 天</span>
          <span>最长连续 <span className="text-text-primary font-medium">{maxStreak}</span> 天</span>
        </div>
      </div>

      <div className="relative" ref={rootRef}>
        {/* Month labels */}
        <div style={{ ...gridStyle, marginBottom: '4px' }}>
          <div />
          {weeks.map((_, wi) => (
            <div key={wi} className="text-[10px] text-text-secondary whitespace-nowrap overflow-visible">
              {monthMarkers.find(m => m.col === wi)?.label ?? ''}
            </div>
          ))}
        </div>

        {/* Grid cells + weekday labels */}
        <div style={{ ...gridStyle, gridTemplateRows: 'repeat(7, auto)' }}>
          <span style={{ gridColumn: 1, gridRow: 2 }} className="text-[10px] text-text-secondary self-center">周一</span>
          <span style={{ gridColumn: 1, gridRow: 4 }} className="text-[10px] text-text-secondary self-center">周三</span>
          <span style={{ gridColumn: 1, gridRow: 6 }} className="text-[10px] text-text-secondary self-center">周五</span>

          {weeks.map((week, wi) =>
            week.map((cell, di) => {
              if (!cell) {
                return <div key={`${wi}-${di}`} style={{ gridColumn: wi + 2, gridRow: di + 1 }} className="aspect-square" />;
              }
              const eatenHere = isEaten(wi, di);
              const effectiveCount = eatenHere ? 0 : cell.count;
              const lvl = level(effectiveCount);
              const isTodayCell = isSameDay(cell.date, today);
              const snakePos = isSnake(wi, di);
              const snakeClass = snakePos === 0
                ? 'snake-head'
                : snakePos > 0 ? `snake-body snake-body-${Math.min(snakePos, 3)}` : '';
              return (
                <div
                  key={`${wi}-${di}`}
                  style={{ gridColumn: wi + 2, gridRow: di + 1 }}
                  className={`heatmap-cell ${isTodayCell ? 'heatmap-today' : ''} ${snakeClass} ${eatenHere ? 'heatmap-eaten' : ''} aspect-square rounded-sm ${LEVEL_CLASSES[lvl]}`}
                  onMouseEnter={e => {
                    const parent = rootRef.current;
                    if (!parent) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const prect = parent.getBoundingClientRect();
                    setHover({
                      x: rect.left - prect.left + rect.width / 2,
                      y: rect.top - prect.top,
                      text: `${format(cell.date, 'yyyy-MM-dd')} · ${cell.count} 条 memo`,
                    });
                  }}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })
          )}
        </div>

        {hover && (
          <div
            className="pointer-events-none absolute z-20 px-2 py-1 rounded bg-text-primary text-white text-xs whitespace-nowrap shadow-lg"
            style={{ left: hover.x, top: hover.y - 6, transform: 'translate(-50%, -100%)' }}
          >
            {hover.text}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-3 text-[11px] text-text-secondary">
        <span>少</span>
        {LEVEL_CLASSES.map((c, i) => (
          <span key={i} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}

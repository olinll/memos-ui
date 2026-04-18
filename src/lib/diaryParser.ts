// Parser & serializer for data/diary.ts.
//
// Strategy: surgically edit only the `const diaryData: DiaryItem[] = [ ... ];`
// region. Everything else (interface definition, helper functions,
// commented-out `/* ... */` historical entries) is preserved verbatim. Active
// object literals are evaluated via `new Function` — safe here because the
// source is our own repo, running in our own browser.

export interface DiaryItem {
  id: number;
  content: string;
  date: string;
  images?: string[];
  location?: string;
  mood?: string;
  tags?: string[];
}

export interface DiaryFile {
  items: DiaryItem[];
  // Raw text of the file, kept so we can slot items back in without rewriting
  // anything outside the array region.
  source: string;
  // Byte offsets inside `source` that bracket the array literal body.
  arrayStart: number; // index just after `[`
  arrayEnd: number; // index of `]`
  // Commented-out `/* ... */` blocks that lived inside the array — we pass
  // them through to the tail so nothing gets dropped silently.
  preservedComments: string[];
}

const ARRAY_MARKER = /const\s+diaryData\s*:\s*DiaryItem\s*\[\s*\]\s*=\s*\[/;

export function parseDiary(source: string): DiaryFile {
  const match = ARRAY_MARKER.exec(source);
  if (!match) throw new Error('未在 diary.ts 中找到 `const diaryData: DiaryItem[] = [`');
  const arrayStart = match.index + match[0].length;
  const arrayEnd = findMatchingBracket(source, arrayStart - 1);
  if (arrayEnd < 0) throw new Error('diary.ts 数组括号不匹配');

  const body = source.slice(arrayStart, arrayEnd);
  const { items, preservedComments } = splitArrayBody(body);

  return { items, source, arrayStart, arrayEnd, preservedComments };
}

export function serializeDiary(file: DiaryFile, nextItems: DiaryItem[]): string {
  const parts: string[] = nextItems.map(formatItem);
  // Preserve commented-out historical entries at the end, original text intact.
  for (const c of file.preservedComments) parts.push('\t' + c);

  const body = parts.length > 0 ? '\n' + parts.join(',\n') + ',\n' : '\n';
  const head = file.source.slice(0, file.arrayStart);
  const tail = file.source.slice(file.arrayEnd);
  return head + body + tail;
}

export function nextId(items: DiaryItem[]): number {
  const max = items.reduce((m, it) => (it.id > m ? it.id : m), 0);
  return max + 1;
}

// ---------- internals ----------

// Given an index pointing at `[`, return the index of the matching `]`.
// Handles nested brackets, strings ('/"/`), and // or /* comments.
function findMatchingBracket(src: string, openIdx: number): number {
  let depth = 0;
  let i = openIdx;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return i; }
    else if (ch === '"' || ch === "'" || ch === '`') i = skipString(src, i);
    else if (ch === '/' && src[i + 1] === '/') i = src.indexOf('\n', i); // line comment
    else if (ch === '/' && src[i + 1] === '*') i = src.indexOf('*/', i + 2) + 1;
    if (i < 0) return -1;
    i++;
  }
  return -1;
}

// i points at the opening quote; return index of the closing quote.
function skipString(src: string, i: number): number {
  const quote = src[i];
  let j = i + 1;
  while (j < src.length) {
    const ch = src[j];
    if (ch === '\\') { j += 2; continue; }
    if (ch === quote) return j;
    j++;
  }
  return src.length;
}

interface SplitResult { items: DiaryItem[]; preservedComments: string[]; }

// Walk the array body, pulling out top-level `{...}` blocks and `/* ... */`
// comments in order. `{}` inside commented regions are ignored.
function splitArrayBody(body: string): SplitResult {
  const items: DiaryItem[] = [];
  const preservedComments: string[] = [];

  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === undefined) break;

    // Whitespace and stray commas
    if (/\s/.test(ch) || ch === ',') { i++; continue; }

    // Line comment — usually leading doc comments or notes between entries.
    if (ch === '/' && body[i + 1] === '/') {
      const nl = body.indexOf('\n', i);
      i = nl < 0 ? body.length : nl + 1;
      continue;
    }

    // Block comment — may be a commented-out entry we want to preserve.
    if (ch === '/' && body[i + 1] === '*') {
      const end = body.indexOf('*/', i + 2);
      if (end < 0) { i = body.length; break; }
      const raw = body.slice(i, end + 2);
      preservedComments.push(raw);
      i = end + 2;
      continue;
    }

    // Object literal
    if (ch === '{') {
      const end = findMatchingBrace(body, i);
      if (end < 0) throw new Error('diary.ts 对象括号不匹配');
      const objSrc = body.slice(i, end + 1);
      const obj = evalObjectLiteral(objSrc);
      items.push(obj);
      i = end + 1;
      continue;
    }

    // Unknown token — skip to next comma to stay resilient.
    const next = body.indexOf(',', i);
    i = next < 0 ? body.length : next + 1;
  }

  return { items, preservedComments };
}

function findMatchingBrace(src: string, openIdx: number): number {
  let depth = 0;
  let i = openIdx;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
    else if (ch === '"' || ch === "'" || ch === '`') i = skipString(src, i);
    else if (ch === '/' && src[i + 1] === '/') i = src.indexOf('\n', i);
    else if (ch === '/' && src[i + 1] === '*') i = src.indexOf('*/', i + 2) + 1;
    if (i < 0) return -1;
    i++;
  }
  return -1;
}

function evalObjectLiteral(src: string): DiaryItem {
  // `new Function('return ' + src)()` — accepts JS object literal syntax
  // including unquoted keys, trailing commas, single-line comments. No
  // interpolation because our own repo controls this input.
  const fn = new Function(`return (${src});`);
  const raw = fn() as Record<string, unknown>;
  return normalizeItem(raw);
}

function normalizeItem(raw: Record<string, unknown>): DiaryItem {
  const item: DiaryItem = {
    id: Number(raw.id),
    content: String(raw.content ?? ''),
    date: String(raw.date ?? ''),
  };
  if (Array.isArray(raw.images) && raw.images.length > 0) {
    item.images = raw.images.map(String);
  }
  if (typeof raw.location === 'string' && raw.location) item.location = raw.location;
  if (typeof raw.mood === 'string' && raw.mood) item.mood = raw.mood;
  if (Array.isArray(raw.tags) && raw.tags.length > 0) item.tags = raw.tags.map(String);
  return item;
}

function formatItem(item: DiaryItem): string {
  // images and tags are always emitted (even empty) because the Mizuki blog
  // build indexes them unconditionally and crashes on `undefined`.
  const images = item.images ?? [];
  const tags = item.tags ?? [];
  const fields: string[] = [
    `\t\tid: ${item.id}`,
    `\t\tcontent: ${JSON.stringify(item.content)}`,
    `\t\tdate: ${JSON.stringify(item.date)}`,
    `\t\timages: [${images.map(s => JSON.stringify(s)).join(', ')}]`,
  ];
  if (item.location) fields.push(`\t\tlocation: ${JSON.stringify(item.location)}`);
  if (item.mood) fields.push(`\t\tmood: ${JSON.stringify(item.mood)}`);
  fields.push(`\t\ttags: [${tags.map(s => JSON.stringify(s)).join(', ')}]`);
  return `\t{\n${fields.join(',\n')}\n\t}`;
}

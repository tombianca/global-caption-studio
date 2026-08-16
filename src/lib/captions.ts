// Caption formatting and generation (pure functions — unit-tested).
import type { CaptionStyle } from './types';
import { DEFAULT_CAPTION_STYLE } from './types';
import { isRtl } from './languages';

export const DEFAULT_MAX_LINE_CHARS = 42;
const MAX_LINES = 2;

export interface CaptionInput {
  startTime: number;
  endTime: number;
  text: string;
}

// ---- Timestamp formatting -------------------------------------------------

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

export function formatSrtTimestamp(seconds: number): string {
  const s = Math.max(0, seconds);
  const total = Math.floor(s);
  const ms = Math.round((s - total) * 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms, 3)}`;
}

export function formatVttTimestamp(seconds: number): string {
  const s = Math.max(0, seconds);
  const total = Math.floor(s);
  const ms = Math.round((s - total) * 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}.${pad(ms, 3)}`;
}

export function formatAssTimestamp(seconds: number): string {
  // ASS uses centiseconds: H:MM:SS.CC
  const s = Math.max(0, seconds);
  const cs = Math.round(s * 100);
  const total = Math.floor(cs / 100);
  const cc = cs % 100;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h}:${pad(m)}:${pad(sec)}.${pad(cc, 2)}`;
}

// ---- Line wrapping --------------------------------------------------------

function chunkLongToken(token: string, maxChars: number): string[] {
  const out: string[] = [];
  const chars = Array.from(token); // code points → keeps surrogate pairs intact
  for (let i = 0; i < chars.length; i += maxChars) {
    out.push(chars.slice(i, i + maxChars).join(''));
  }
  return out;
}

/** Word-aware wrap that never splits words and handles CJK/long tokens. */
export function wordWrap(text: string, maxChars = DEFAULT_MAX_LINE_CHARS): string[] {
  const paragraphs = text.split(/\r?\n+/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const tokens = para.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    let current = '';
    for (const token of tokens) {
      if (Array.from(token).length > maxChars) {
        if (current) {
          lines.push(current);
          current = '';
        }
        lines.push(...chunkLongToken(token, maxChars));
        continue;
      }
      const candidate = current ? `${current} ${token}` : token;
      if (Array.from(candidate).length <= maxChars) {
        current = candidate;
      } else {
        lines.push(current);
        current = token;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [''];
}

/** Wrap into at most `maxLines` cue lines (with ellipsis on overflow). */
export function wrapToCue(
  text: string,
  maxChars = DEFAULT_MAX_LINE_CHARS,
  maxLines = MAX_LINES,
): string {
  const lines = wordWrap(text, maxChars);
  if (lines.length <= maxLines) return lines.join('\n');
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = kept[maxLines - 1].replace(/\s+$/, '') + '…';
  return kept.join('\n');
}

// ---- Segment normalization (prevents overlap) ------------------------------

export function normalizeSegments(segments: CaptionInput[], minGapMs = 1): CaptionInput[] {
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);
  const out: CaptionInput[] = [];
  for (const seg of sorted) {
    let start = Math.max(0, seg.startTime);
    let end = Math.max(start + 0.001, seg.endTime);
    const prev = out[out.length - 1];
    if (prev && start < prev.endTime) {
      start = prev.endTime + minGapMs / 1000;
      if (end <= start) end = start + 0.001;
    }
    out.push({ startTime: start, endTime: end, text: seg.text });
  }
  return out;
}

// ---- File generators ------------------------------------------------------

export function generateSrt(segments: CaptionInput[], opts?: { maxChars?: number }): string {
  const maxChars = opts?.maxChars ?? DEFAULT_MAX_LINE_CHARS;
  const norm = normalizeSegments(segments);
  const blocks = norm.map((seg, i) => {
    const text = wrapToCue(seg.text, maxChars);
    return `${i + 1}\n${formatSrtTimestamp(seg.startTime)} --> ${formatSrtTimestamp(seg.endTime)}\n${text}`;
  });
  // UTF-8 BOM helps subtitle players detect non-ASCII (CJK/RTL) correctly.
  return '\uFEFF' + blocks.join('\n\n') + (blocks.length ? '\n' : '');
}

export function generateVtt(segments: CaptionInput[], opts?: { maxChars?: number }): string {
  const maxChars = opts?.maxChars ?? DEFAULT_MAX_LINE_CHARS;
  const norm = normalizeSegments(segments);
  const cues = norm.map((seg) => {
    const text = wrapToCue(seg.text, maxChars);
    return `${formatVttTimestamp(seg.startTime)} --> ${formatVttTimestamp(seg.endTime)}\n${text}`;
  });
  return 'WEBVTT\n\n' + cues.join('\n\n') + (cues.length ? '\n' : '');
}

export function generateTxt(segments: CaptionInput[], opts?: { withTimestamps?: boolean }): string {
  const norm = normalizeSegments(segments);
  const lines = norm.map((s) => {
    const text = wrapToCue(s.text).replace(/\n/g, ' ');
    return opts?.withTimestamps
      ? `[${formatSrtTimestamp(s.startTime).replace(',', '.')}] ${text}`
      : text;
  });
  return lines.join('\n') + (lines.length ? '\n' : '');
}

function assColor(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return '&H00FFFFFF';
  const r = m[1].slice(0, 2);
  const g = m[1].slice(2, 4);
  const b = m[1].slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

function assEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

function alignToAss(position: CaptionStyle['position'], textAlign: CaptionStyle['textAlign']): number {
  const row = position === 'top' ? 7 : position === 'center' ? 4 : 1;
  const col = textAlign === 'left' ? 0 : textAlign === 'right' ? 2 : 1;
  return row + col; // 1..9
}

export function generateAss(
  segments: CaptionInput[],
  opts?: {
    style?: Partial<CaptionStyle>;
    languageCode?: string;
    maxChars?: number;
    width?: number;
    height?: number;
  },
): string {
  const style: CaptionStyle = { ...DEFAULT_CAPTION_STYLE, ...(opts?.style ?? {}) };
  const maxChars = opts?.maxChars ?? DEFAULT_MAX_LINE_CHARS;
  const width = opts?.width ?? 1920;
  const height = opts?.height ?? 1080;
  const norm = normalizeSegments(segments);

  const fontname = style.fontFamily.split(',')[0].replace(/["']/g, '').trim() || 'Arial';
  const primaryColour = assColor(style.textColor);
  const backColour = assColor(style.backgroundColor);
  const backAlpha = Math.round((1 - style.backgroundOpacity) * 255);
  const hasBox = style.backgroundOpacity > 0.05;
  const borderStyle = hasBox ? 3 : 1;
  const outline = hasBox ? (style.outline ? 1 : 0) : style.outline ? 2 : 0;
  const shadow = hasBox ? (style.shadow ? 1 : 0) : style.shadow ? 1.5 : 0;
  const alignment = alignToAss(style.position, style.textAlign);
  const verticalOffset = Math.max(0, Math.min(50, style.verticalOffset ?? 8));
  const marginV =
    style.position === 'top' || style.position === 'bottom'
      ? Math.round((height * verticalOffset) / 100)
      : 0;
  const marginH = Math.round(width * 0.06);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontname},${style.fontSize},${primaryColour},${primaryColour},&H00000000,&H${backAlpha
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()}${backColour.slice(3)},0,0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},${alignment},${marginH},${marginH},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = norm.map((seg) => {
    const text = assEscape(wrapToCue(seg.text, maxChars)).replace(/\n/g, '\\N');
    return `Dialogue: 0,${formatAssTimestamp(seg.startTime)},${formatAssTimestamp(seg.endTime)},Default,,0,0,0,,${text}`;
  });

  return header + events.join('\n') + '\n';
}

import { describe, it, expect } from 'vitest';
import {
  formatSrtTimestamp,
  formatVttTimestamp,
  formatAssTimestamp,
  generateSrt,
  generateVtt,
  generateTxt,
  generateAss,
  wordWrap,
  normalizeSegments,
} from '../captions';

describe('timestamp formatting', () => {
  it('formats SRT timestamps as HH:MM:SS,mmm', () => {
    expect(formatSrtTimestamp(0)).toBe('00:00:00,000');
    expect(formatSrtTimestamp(1)).toBe('00:00:01,000');
    expect(formatSrtTimestamp(61.5)).toBe('00:01:01,500');
    expect(formatSrtTimestamp(3661.5)).toBe('01:01:01,500');
  });

  it('formats VTT timestamps as HH:MM:SS.mmm', () => {
    expect(formatVttTimestamp(1)).toBe('00:00:01.000');
    expect(formatVttTimestamp(61.5)).toBe('00:01:01.500');
  });

  it('formats ASS timestamps as H:MM:SS.cc (centiseconds)', () => {
    expect(formatAssTimestamp(1)).toBe('0:00:01.00');
    expect(formatAssTimestamp(3661.5)).toBe('1:01:01.50');
  });

  it('never formats negative values', () => {
    expect(formatSrtTimestamp(-5)).toBe('00:00:00,000');
    expect(formatVttTimestamp(-5)).toBe('00:00:00.000');
  });
});

describe('SRT generation', () => {
  it('produces a valid SRT file with UTF-8 BOM', () => {
    const out = generateSrt([{ startTime: 1, endTime: 4, text: 'Hello, welcome to the video.' }]);
    expect(out).toBe('\uFEFF1\n00:00:01,000 --> 00:00:04,000\nHello, welcome to the video.\n');
  });

  it('numbers segments sequentially', () => {
    const out = generateSrt([
      { startTime: 0, endTime: 2, text: 'First.' },
      { startTime: 2, endTime: 4, text: 'Second.' },
    ]);
    expect(out).toContain('1\n00:00:00,000 --> 00:00:02,000\nFirst.');
    expect(out).toContain('2\n00:00:02,000 --> 00:00:04,000\nSecond.');
  });
});

describe('VTT generation', () => {
  it('produces a valid WebVTT file', () => {
    const out = generateVtt([{ startTime: 1, endTime: 4, text: 'Hello, welcome to the video.' }]);
    expect(out).toBe('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello, welcome to the video.\n');
  });
});

describe('line wrapping', () => {
  it('wraps without splitting words and respects max chars', () => {
    const lines = wordWrap('This is a sentence that will wrap across lines', 20);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
  });

  it('does not produce empty lines for a single short caption', () => {
    expect(wordWrap('hi', 42)).toEqual(['hi']);
  });
});

describe('segment normalization', () => {
  it('sorts segments and prevents overlap', () => {
    const out = normalizeSegments([
      { startTime: 5, endTime: 8, text: 'B' },
      { startTime: 0, endTime: 3, text: 'A' },
      { startTime: 2.5, endTime: 6, text: 'overlap' },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0].startTime).toBe(0);
    // Every segment starts at or after the previous one ends (no overlap).
    for (let i = 1; i < out.length; i++) {
      expect(out[i].startTime).toBeGreaterThanOrEqual(out[i - 1].endTime);
    }
    // The first (sorted) segment is untouched.
    expect(out[0]).toEqual({ startTime: 0, endTime: 3, text: 'A' });
  });
});

describe('TXT + ASS generation', () => {
  it('produces a plain-text transcript', () => {
    const out = generateTxt([{ startTime: 0, endTime: 2, text: 'Hello' }]);
    expect(out).toBe('Hello\n');
  });

  it('produces a valid ASS file with dialogue events', () => {
    const out = generateAss([{ startTime: 1, endTime: 4, text: 'Hello, welcome to the video.' }]);
    expect(out).toContain('[Script Info]');
    expect(out).toContain('[V4+ Styles]');
    expect(out).toContain('[Events]');
    expect(out).toContain('Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello, welcome to the video.');
  });
});

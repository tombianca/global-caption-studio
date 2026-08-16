import { describe, it, expect } from 'vitest';
import { validateVideoFile, sanitizeText, sanitizeTitle } from '../validation';

describe('file validation', () => {
  it('accepts supported extensions with a matching MIME type', () => {
    expect(validateVideoFile({ name: 'a.mp4', type: 'video/mp4', size: 1000 })).toMatchObject({
      ok: true,
      ext: 'mp4',
    });
  });

  it('accepts octet-stream MIME when the extension is supported', () => {
    expect(validateVideoFile({ name: 'a.webm', type: 'application/octet-stream', size: 1000 })).toMatchObject({
      ok: true,
      ext: 'webm',
    });
  });

  it('rejects unsupported extensions', () => {
    const r = validateVideoFile({ name: 'a.exe', type: 'application/x-msdownload', size: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('rejects mismatched MIME types', () => {
    const r = validateVideoFile({ name: 'a.mp4', type: 'text/html', size: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('rejects files larger than the limit', () => {
    const r = validateVideoFile({ name: 'big.mp4', type: 'video/mp4', size: 3 * 1024 * 1024 * 1024 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('FILE_TOO_LARGE');
  });

  it('is case-insensitive on the extension', () => {
    expect(validateVideoFile({ name: 'A.MKV', type: 'video/x-matroska', size: 10 })).toMatchObject({
      ok: true,
      ext: 'mkv',
    });
  });
});

describe('sanitization', () => {
  it('strips control characters and collapses whitespace', () => {
    expect(sanitizeText('a\u0000b   c\n\n\nd')).toBe('ab c\n\nd');
  });

  it('trims and length-limits titles', () => {
    expect(sanitizeTitle('  My Video  ')).toBe('My Video');
    expect(sanitizeTitle('x'.repeat(500)).length).toBeLessThanOrEqual(120);
  });

  it('preserves Unicode (RTL + CJK) text', () => {
    expect(sanitizeText('مرحبا بالعالم')).toBe('مرحبا بالعالم');
    expect(sanitizeText('你好，世界')).toBe('你好，世界');
  });
});

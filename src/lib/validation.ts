import { config } from './config';

export const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
export const ALLOWED_VIDEO_MIMES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
];

export interface FileMeta {
  name: string;
  type: string;
  size: number;
}

export type ValidationResult =
  | { ok: true; ext: string }
  | { ok: false; code: 'UNSUPPORTED_FILE_TYPE' | 'FILE_TOO_LARGE'; message: string };

export function validateVideoFile(file: FileMeta): ValidationResult {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_FILE_TYPE',
      message: `Unsupported file type. Allowed extensions: ${ALLOWED_VIDEO_EXTENSIONS.map(
        (e) => e.toUpperCase(),
      ).join(', ')}.`,
    };
  }

  const mime = (file.type || '').toLowerCase();
  const mimeOk =
    !mime || mime === 'application/octet-stream' || ALLOWED_VIDEO_MIMES.includes(mime);
  if (!mimeOk) {
    return {
      ok: false,
      code: 'UNSUPPORTED_FILE_TYPE',
      message: `Unsupported MIME type "${file.type}".`,
    };
  }

  const maxBytes = config.maxUploadSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${config.maxUploadSizeMb} MB.`,
    };
  }

  return { ok: true, ext };
}

/** Trim, collapse whitespace, strip control characters; preserve Unicode (RTL + CJK). */
export function sanitizeText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeTitle(title: string): string {
  return sanitizeText(title).slice(0, 120);
}

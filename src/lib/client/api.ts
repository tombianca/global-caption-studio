import type { SafeUser, VideoProjectDTO, CaptionSegmentDTO, CaptionStyle } from '@/lib/types';

interface ApiErrorShape {
  error?: string;
  code?: string;
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as T & ApiErrorShape;
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed') as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

export interface UploadOptions {
  file: File;
  title: string;
  originalLanguage: string;
  targetLanguages: string[];
  captionFormat: string;
  onProgress?: (percent: number) => void;
}

export const api = {
  register: (payload: { name: string; email: string; password: string }) =>
    req<{ user: SafeUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),

  login: (payload: { email: string; password: string }) =>
    req<{ user: SafeUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),

  logout: () => req<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  me: () => req<{ user: SafeUser | null }>('/api/auth/me'),

  listVideos: () => req<{ videos: VideoProjectDTO[] }>('/api/videos'),

  getVideo: (id: string) => req<{ video: VideoProjectDTO }>(`/api/videos/${id}`),

  patchVideo: (id: string, payload: { title?: string; captionStyle?: Partial<CaptionStyle> }) =>
    req<{ video: VideoProjectDTO }>(`/api/videos/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteVideo: (id: string) => req<{ ok: boolean }>(`/api/videos/${id}`, { method: 'DELETE' }),

  transcribe: (id: string, payload: { originalLanguage: string; targetLanguages: string[] }) =>
    req<{ jobId: string; status: string }>(`/api/videos/${id}/transcribe`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  translate: (id: string) => req<{ jobId: string }>(`/api/videos/${id}/translate`, { method: 'POST' }),

  exportVideo: (id: string, payload: { burnIn: boolean; language?: string }) =>
    req<{ jobId: string }>(`/api/videos/${id}/export`, { method: 'POST', body: JSON.stringify(payload) }),

  getCaptions: (id: string, language: string) =>
    req<{ language: string; isOriginal: boolean; segments: (CaptionSegmentDTO & { text: string })[] }>(
      `/api/videos/${id}/captions?language=${encodeURIComponent(language)}`,
    ),

  saveCaptions: (id: string, segments: CaptionSegmentDTO[]) =>
    req<{ ok: boolean; count: number }>(`/api/videos/${id}/captions`, {
      method: 'PUT',
      body: JSON.stringify({ segments }),
    }),

  getStatus: (id: string) =>
    req<{ status: string; errorMessage: string | null; job: unknown }>(`/api/videos/${id}/status`),

  downloadUrl: (id: string, format: string, language: string) =>
    `/api/videos/${id}/download/${format}?language=${encodeURIComponent(language)}`,
};

export function uploadVideo(opts: UploadOptions): Promise<{ video: VideoProjectDTO }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', opts.file);
    form.append('title', opts.title);
    form.append('originalLanguage', opts.originalLanguage);
    form.append('targetLanguages', JSON.stringify(opts.targetLanguages));
    form.append('captionFormat', opts.captionFormat);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/videos/upload');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as { video: VideoProjectDTO; error?: string };
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || 'Upload failed'));
      } catch {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed. Please try again.'));
    xhr.send(form);
  });
}

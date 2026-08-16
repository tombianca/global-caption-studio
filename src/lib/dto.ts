import type { CaptionLanguage, VideoProject } from '@prisma/client';
import { storage } from './storage';
import { DEFAULT_CAPTION_STYLE, type CaptionStyle, type VideoProjectDTO } from './types';

export function parseTargetLanguages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  return [];
}

export function parseCaptionStyle(raw: unknown): CaptionStyle {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...DEFAULT_CAPTION_STYLE, ...(raw as Partial<CaptionStyle>) };
  }
  return { ...DEFAULT_CAPTION_STYLE };
}

export type ProjectWithRelations = VideoProject & { languages: CaptionLanguage[] };

export async function toVideoDTO(project: ProjectWithRelations): Promise<VideoProjectDTO> {
  const originalFileUrl = await storage.getFileUrl(project.originalFileUrl, project.id);
  return {
    id: project.id,
    title: project.title,
    originalFileUrl,
    duration: project.duration,
    originalLanguage: project.originalLanguage,
    targetLanguages: parseTargetLanguages(project.targetLanguages),
    status: project.status as VideoProjectDTO['status'],
    errorMessage: project.errorMessage,
    captionStyle: parseCaptionStyle(project.captionStyle),
    burnedVideoUrl: project.burnedVideoUrl ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    languages: project.languages.map((l) => ({
      languageCode: l.languageCode,
      languageName: l.languageName,
      status: l.status,
      fileUrl: l.fileUrl,
    })),
  };
}

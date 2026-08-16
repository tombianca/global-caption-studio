// Shared domain types for Global Caption Studio.
// Imported by server logic, route handlers, and client code alike.

export type VideoStatus =
  | 'UPLOADING'
  | 'TRANSCRIBING'
  | 'TRANSLATING'
  | 'EXPORTING'
  | 'READY'
  | 'FAILED';

export type CaptionFormat = 'SRT' | 'VTT' | 'ASS' | 'TXT';

export type CaptionPosition = 'top' | 'center' | 'bottom';
export type CaptionTextAlign = 'left' | 'center' | 'right';

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number; // 0..1
  position: CaptionPosition;
  textAlign: CaptionTextAlign;
  outline: boolean;
  shadow: boolean;
  verticalOffset: number; // % distance from the bottom/top edge (0-50)
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 22,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.7,
  position: 'bottom',
  textAlign: 'center',
  outline: false,
  shadow: true,
  verticalOffset: 8,
};

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface CaptionLanguageDTO {
  languageCode: string;
  languageName: string;
  status: string;
  fileUrl: string | null;
}

export interface VideoProjectDTO {
  id: string;
  title: string;
  originalFileUrl: string;
  duration: number | null;
  originalLanguage: string;
  targetLanguages: string[];
  status: VideoStatus;
  errorMessage: string | null;
  captionStyle: CaptionStyle;
  burnedVideoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  languages: CaptionLanguageDTO[];
}

export interface CaptionSegmentDTO {
  id: string;
  segmentNumber: number;
  startTime: number; // seconds
  endTime: number; // seconds
  originalText: string;
  translatedTexts: Record<string, string>;
}

export interface TranscriptionResult {
  detectedLanguage: string;
  segments: CaptionSegmentDTO[];
}

export type JobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

export interface JobProgress {
  jobId: string;
  type: 'TRANSCRIBE' | 'TRANSLATE' | 'EXPORT';
  status: JobStatus;
  progress: number; // 0..100
  message?: string;
  error?: string;
}

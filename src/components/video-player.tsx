'use client';

import type { CaptionStyle } from '@/lib/types';
import { hexToRgb } from '@/lib/utils';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  src: string;
  activeText: string;
  rtl: boolean;
  style: CaptionStyle;
  onTimeUpdate: (t: number) => void;
  onPlay: () => void;
  onPause: () => void;
}

export function VideoPlayer({ videoRef, src, activeText, rtl, style, onTimeUpdate, onPlay, onPause }: Props) {
  // Position (top/center/bottom) runs on the column's MAIN axis → justify-content.
  const justify =
    style.position === 'top' ? 'justify-start' : style.position === 'bottom' ? 'justify-end' : 'justify-center';
  // Text alignment (left/center/right) runs on the column's CROSS axis → align-items.
  const align =
    style.textAlign === 'left' ? 'items-start' : style.textAlign === 'right' ? 'items-end' : 'items-center';

  const outline = style.outline
    ? '1px 0 0 #000, -1px 0 0 #000, 0 1px 0 #000, 0 -1px 0 #000'
    : 'none';
  const shadow = style.shadow ? '0 2px 6px rgba(0,0,0,0.85)' : 'none';
  const textShadow = style.outline ? `${outline}, ${shadow}` : shadow;

  // Vertical offset (% from the anchored edge) — drives the up/down slider.
  const verticalOffset = Math.max(0, Math.min(50, style.verticalOffset ?? 8));
  const verticalPad =
    style.position === 'bottom'
      ? { paddingBottom: `${verticalOffset}%`, paddingTop: '4%' }
      : style.position === 'top'
        ? { paddingTop: `${verticalOffset}%`, paddingBottom: '4%' }
        : { paddingTop: '4%', paddingBottom: '4%' };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        src={src}
        controls
        preload="metadata"
        className="h-full w-full"
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        onPlay={onPlay}
        onPause={onPause}
      />
      {activeText && (
        <div
          className={`pointer-events-none absolute inset-0 flex flex-col px-4 ${align} ${justify}`}
          style={verticalPad}
        >
          <div
            dir={rtl ? 'rtl' : 'ltr'}
            className="max-w-[92%] rounded px-3 py-1.5 text-center leading-snug"
            style={{
              fontFamily: style.fontFamily,
              fontSize: `${style.fontSize}px`,
              color: style.textColor,
              backgroundColor: `rgba(${hexToRgb(style.backgroundColor)}, ${style.backgroundOpacity})`,
              textShadow,
              whiteSpace: 'pre-line',
            }}
          >
            {activeText}
          </div>
        </div>
      )}
    </div>
  );
}

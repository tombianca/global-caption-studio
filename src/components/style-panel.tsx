'use client';

import type { CaptionStyle } from '@/lib/types';
import { hexToRgb } from '@/lib/utils';

const FAMILIES = [
  'Inter, system-ui, sans-serif',
  'Arial, sans-serif',
  'Helvetica, sans-serif',
  'Verdana, sans-serif',
  'Georgia, serif',
  'Times New Roman, serif',
  'Courier New, monospace',
];

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const labelCls = 'mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400';

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}

export function StylePanel({ style, onChange }: { style: CaptionStyle; onChange: (s: CaptionStyle) => void }) {
  const set = (p: Partial<CaptionStyle>) => onChange({ ...style, ...p });

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="font" className={labelCls}>
          Font family
        </label>
        <select id="font" value={style.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })} className={inputCls}>
          {FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f.split(',')[0]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="size" className={labelCls}>
          Font size — {style.fontSize}px
        </label>
        <input
          id="size"
          type="range"
          min={14}
          max={72}
          value={style.fontSize}
          onChange={(e) => set({ fontSize: Number(e.target.value) })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="textColor" className={labelCls}>
            Text color
          </label>
          <div className="flex items-center gap-2">
            <input
              id="textColor"
              type="color"
              value={style.textColor}
              onChange={(e) => set({ textColor: e.target.value })}
              className="h-9 w-9 cursor-pointer rounded border border-slate-300 dark:border-slate-700"
            />
            <code className="text-xs text-slate-400">{style.textColor}</code>
          </div>
        </div>
        <div>
          <label htmlFor="bgColor" className={labelCls}>
            Background
          </label>
          <div className="flex items-center gap-2">
            <input
              id="bgColor"
              type="color"
              value={style.backgroundColor}
              onChange={(e) => set({ backgroundColor: e.target.value })}
              className="h-9 w-9 cursor-pointer rounded border border-slate-300 dark:border-slate-700"
            />
            <code className="text-xs text-slate-400">{style.backgroundColor}</code>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="opacity" className={labelCls}>
          Background opacity — {Math.round(style.backgroundOpacity * 100)}%
        </label>
        <input
          id="opacity"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={style.backgroundOpacity}
          onChange={(e) => set({ backgroundOpacity: Number(e.target.value) })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="position" className={labelCls}>
            Position
          </label>
          <select id="position" value={style.position} onChange={(e) => set({ position: e.target.value as CaptionStyle['position'] })} className={inputCls}>
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </select>
        </div>
        <div>
          <label htmlFor="align" className={labelCls}>
            Text alignment
          </label>
          <select id="align" value={style.textAlign} onChange={(e) => set({ textAlign: e.target.value as CaptionStyle['textAlign'] })} className={inputCls}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="voffset" className={labelCls}>
          Move caption up / down — {style.verticalOffset ?? 8}%
        </label>
        <input
          id="voffset"
          type="range"
          min={0}
          max={50}
          step={1}
          value={style.verticalOffset ?? 8}
          onChange={(e) => set({ verticalOffset: Number(e.target.value) })}
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>Lower (bottom)</span>
          <span>Higher</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <Checkbox label="Outline" checked={style.outline} onChange={(v) => set({ outline: v })} />
        <Checkbox label="Shadow" checked={style.shadow} onChange={(v) => set({ shadow: v })} />
      </div>

      {/* Live preview */}
      <div className="overflow-hidden rounded-lg bg-slate-800 p-3">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">Preview</p>
        <div
          className="flex min-h-[64px] items-end justify-center"
          style={{
            fontFamily: style.fontFamily,
            fontSize: `${Math.min(style.fontSize, 28)}px`,
            color: style.textColor,
          }}
        >
          <span
            className="rounded px-2 py-1"
            style={{
              backgroundColor: `rgba(${hexToRgb(style.backgroundColor)}, ${style.backgroundOpacity})`,
              textShadow: style.outline
                ? '1px 0 0 #000, -1px 0 0 #000, 0 1px 0 #000, 0 -1px 0 #000'
                : style.shadow
                  ? '0 2px 6px rgba(0,0,0,0.85)'
                  : 'none',
            }}
          >
            Sample caption
          </span>
        </div>
      </div>
    </div>
  );
}

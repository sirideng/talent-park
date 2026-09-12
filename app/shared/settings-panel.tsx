'use client';
import { useSyncExternalStore, useState } from 'react';
import {
  settings,
  onSettings,
  updateSettings,
  type Settings,
} from './preferences';
const initial: Settings = { quality: 'auto', volume: 0.65, motion: 'system' };
export function SettingsPanel() {
  const value = useSyncExternalStore(onSettings, settings, () => initial),
    [failed, setFailed] = useState(false);
  const change = (v: Partial<Settings>) => {
    setFailed(!updateSettings(v));
  };
  return (
    <details className="memory-settings">
      <summary aria-label="打开画质与声音设置">设置</summary>
      <div>
        <label>
          画质
          <select
            aria-label="画质"
            value={value.quality}
            onChange={(e) =>
              change({ quality: e.target.value as Settings['quality'] })
            }
          >
            <option value="auto">自动适配</option>
            <option value="low">低 · 流畅优先</option>
            <option value="medium">中 · 平衡</option>
            <option value="high">高 · 柔光细节</option>
          </select>
        </label>
        <label>
          音量
          <input
            aria-label="全局音量"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={value.volume}
            onChange={(e) => change({ volume: Number(e.target.value) })}
          />
        </label>
        <label>
          动态效果
          <select
            aria-label="动态效果"
            value={value.motion}
            onChange={(e) =>
              change({ motion: e.target.value as Settings['motion'] })
            }
          >
            <option value="system">跟随系统</option>
            <option value="reduce">减少动态</option>
            <option value="full">完整动态</option>
          </select>
        </label>
        <small>进度仅存于当前浏览器。声音需主动开启。</small>
        {failed && <output>浏览器无法保存设置。</output>}
      </div>
    </details>
  );
}

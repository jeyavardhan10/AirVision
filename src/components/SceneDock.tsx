import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Moon,
  Radio,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { SceneMode, WeatherScene } from '../types/airvision';
import { SCENE_META } from '../utils/weatherLogic';

interface SceneDockProps {
  mode: SceneMode;
  activeScene: WeatherScene;
  liveScene: WeatherScene;
  onSelectMode: (mode: SceneMode) => void;
}

const SCENE_OPTIONS: Array<{
  id: SceneMode;
  label: string;
  Icon: typeof Sun;
}> = [
  { id: 'live', label: 'Live', Icon: Radio },
  { id: 'sunny', label: 'Sunny', Icon: Sun },
  { id: 'partly-cloudy', label: 'Cloudy', Icon: CloudSun },
  { id: 'overcast', label: 'Overcast', Icon: Cloud },
  { id: 'rain', label: 'Rain', Icon: CloudRain },
  { id: 'storm', label: 'Storm', Icon: CloudLightning },
  { id: 'fog', label: 'Fog', Icon: CloudFog },
  { id: 'night', label: 'Night', Icon: Moon },
];

export function SceneDock({ mode, activeScene, liveScene, onSelectMode }: SceneDockProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <aside
      aria-label="Sky scene controls"
      className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2 sm:right-6 sm:bottom-6"
    >
      {/* Mobile collapsible menu */}
      {mobileOpen && (
        <div className="atmosphere-surface-strong grid grid-cols-2 gap-1.5 rounded-2xl p-2 shadow-2xl md:hidden">
          {SCENE_OPTIONS.map(({ id, label, Icon }) => {
            const selected = mode === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onSelectMode(id);
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                  selected
                    ? 'bg-white text-slate-950'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Mobile compact toggle trigger (keeps sticky footprint minimal on mobile) */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? 'Close sky scene selector' : 'Open sky scene selector'}
        className="atmosphere-surface-strong flex h-11 items-center gap-2 rounded-full px-4 text-xs font-medium text-white shadow-xl md:hidden"
      >
        {mobileOpen ? (
          <X className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span className="whitespace-nowrap">
          Sky: {mode === 'live' ? `Live (${SCENE_META[liveScene].shortLabel})` : SCENE_META[activeScene].shortLabel}
        </span>
      </button>

      {/* Desktop horizontal scene dock */}
      <div
        role="group"
        aria-label="Live weather sky switcher"
        className="atmosphere-surface-strong hidden items-center gap-1 rounded-full p-1.5 shadow-2xl md:flex"
      >
        {SCENE_OPTIONS.map(({ id, label, Icon }) => {
          const selected = mode === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectMode(id)}
              title={
                id === 'live'
                  ? `Follow live Bengaluru sky (${SCENE_META[liveScene].label})`
                  : `Preview ${SCENE_META[id].label} sky`
              }
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${
                selected
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-200 hover:bg-white/12 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

import { Droplets, Wind, Cloud, Thermometer } from 'lucide-react';
import type { LiveConditions, WeatherScene } from '../types/airvision';
import { SCENE_META, describeWmoCode } from '../utils/weatherLogic';
import { AtmosphereCard } from './AtmosphereCard';

interface WeatherOrbProps {
  live: LiveConditions | null;
  scene: WeatherScene;
  isPreviewing: boolean;
  parallaxY: number;
  reducedMotion: boolean;
}

function SceneGlyph({ scene }: { scene: WeatherScene }) {
  if (scene === 'sunny') {
    return (
      <svg viewBox="0 0 120 120" className="h-28 w-28" aria-hidden="true">
        <defs>
          <radialGradient id="orbSun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="55%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="46" fill="url(#orbSun)" opacity="0.55" />
        <circle cx="60" cy="60" r="24" fill="#fef08a" />
        <g stroke="#fde68a" strokeWidth="2.4" strokeLinecap="round" opacity="0.9">
          <line x1="60" y1="12" x2="60" y2="24" />
          <line x1="60" y1="96" x2="60" y2="108" />
          <line x1="12" y1="60" x2="24" y2="60" />
          <line x1="96" y1="60" x2="108" y2="60" />
          <line x1="26" y1="26" x2="35" y2="35" />
          <line x1="85" y1="85" x2="94" y2="94" />
          <line x1="94" y1="26" x2="85" y2="35" />
          <line x1="35" y1="85" x2="26" y2="94" />
        </g>
      </svg>
    );
  }

  if (scene === 'night') {
    return (
      <svg viewBox="0 0 120 120" className="h-28 w-28" aria-hidden="true">
        <defs>
          <radialGradient id="orbMoonHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="48" fill="url(#orbMoonHalo)" />
        <path
          d="M72 32a28 28 0 1 0 16 50A23 23 0 1 1 72 32Z"
          fill="#e2e8f0"
        />
        <circle cx="88" cy="34" r="2" fill="#f8fafc" />
        <circle cx="32" cy="40" r="1.5" fill="#bae6fd" />
        <circle cx="94" cy="54" r="1.4" fill="#fde68a" />
      </svg>
    );
  }

  if (scene === 'rain' || scene === 'storm') {
    const isStorm = scene === 'storm';
    return (
      <svg viewBox="0 0 120 120" className="h-28 w-28" aria-hidden="true">
        <path
          d="M34 64h54a16 16 0 0 0 2-31.9A22 22 0 0 0 48 26a19 19 0 0 0-14 38Z"
          fill={isStorm ? '#64748b' : '#94a3b8'}
        />
        <g stroke={isStorm ? '#c4b5fd' : '#7dd3fc'} strokeWidth="2.6" strokeLinecap="round">
          <line x1="40" y1="74" x2="34" y2="92" />
          <line x1="56" y1="76" x2="50" y2="96" />
          <line x1="74" y1="74" x2="68" y2="92" />
          <line x1="88" y1="76" x2="82" y2="92" />
        </g>
        {isStorm && (
          <path d="M62 62 L51 82 H61 L55 102 L74 76 H63 L69 62 Z" fill="#fde047" />
        )}
      </svg>
    );
  }

  if (scene === 'fog') {
    return (
      <svg viewBox="0 0 120 120" className="h-28 w-28" aria-hidden="true">
        <circle cx="60" cy="48" r="20" fill="#99f6e4" opacity="0.35" />
        <g stroke="#cbd5e1" strokeWidth="3.2" strokeLinecap="round" opacity="0.85">
          <line x1="22" y1="58" x2="98" y2="58" />
          <line x1="30" y1="70" x2="90" y2="70" />
          <line x1="20" y1="82" x2="100" y2="82" />
          <line x1="38" y1="94" x2="82" y2="94" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28" aria-hidden="true">
      {scene === 'partly-cloudy' && <circle cx="76" cy="40" r="18" fill="#fde047" opacity="0.92" />}
      <path
        d="M32 76h56a17 17 0 0 0 2-33.9A23 23 0 0 0 46 36a20 20 0 0 0-14 40Z"
        fill={scene === 'overcast' ? '#94a3b8' : '#e2e8f0'}
      />
    </svg>
  );
}

export function WeatherOrb({ live, scene, isPreviewing, parallaxY, reducedMotion }: WeatherOrbProps) {
  const temp = live?.temperature;
  const conditionText = isPreviewing
    ? SCENE_META[scene].label
    : describeWmoCode(live?.weather_code, live?.is_day);

  return (
    <div
      style={{
        transform: reducedMotion ? undefined : `translate3d(0, ${parallaxY.toFixed(1)}px, 0)`,
        willChange: reducedMotion ? undefined : 'transform',
      }}
      className="h-full"
    >
      <AtmosphereCard mode="tilt" reducedMotion={reducedMotion} className="h-full p-6 sm:p-7">
        <div className="flex h-full flex-col justify-between gap-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-300">
                {isPreviewing ? 'Sky preview active' : 'Live Bengaluru atmosphere'}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                {conditionText}
              </h2>
              <p className="mt-1 text-xs text-slate-300/90 max-w-[26ch]">
                {SCENE_META[scene].tagline}
              </p>
            </div>
            <div className="shrink-0">
              <SceneGlyph scene={scene} />
            </div>
          </div>

          <div className="flex items-baseline justify-between border-t border-white/10 pt-5">
            <div>
              <span className="font-mono text-5xl font-semibold tracking-tight text-white tabular-nums">
                {typeof temp === 'number' ? temp.toFixed(1) : '—'}
              </span>
              <span className="ml-1.5 font-mono text-lg text-slate-300">°C</span>
            </div>
            <div className="text-right font-mono text-xs text-slate-300 tabular-nums">
              <div>12.9716° N</div>
              <div>77.5946° E</div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/10 pt-5 text-sm">
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                <Droplets className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
                <span>Humidity</span>
              </dt>
              <dd className="mt-1 font-mono text-base font-medium text-white tabular-nums">
                {typeof live?.humidity === 'number' ? `${Math.round(live.humidity)}%` : '—'}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                <Wind className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
                <span>Wind speed</span>
              </dt>
              <dd className="mt-1 font-mono text-base font-medium text-white tabular-nums">
                {typeof live?.wind_speed === 'number' ? `${live.wind_speed.toFixed(1)} km/h` : '—'}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                <Cloud className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
                <span>Cloud cover</span>
              </dt>
              <dd className="mt-1 font-mono text-base font-medium text-white tabular-nums">
                {typeof live?.cloud_cover === 'number' ? `${Math.round(live.cloud_cover)}%` : '—'}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                <Thermometer className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
                <span>Precipitation</span>
              </dt>
              <dd className="mt-1 font-mono text-base font-medium text-white tabular-nums">
                {typeof live?.precipitation === 'number' ? `${live.precipitation.toFixed(1)} mm` : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </AtmosphereCard>
    </div>
  );
}

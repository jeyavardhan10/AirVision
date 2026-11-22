import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Sun } from 'lucide-react';
import { useState } from 'react';
import type {
  BacktestPayload,
  Forecast24hPayload,
  ForecastExplainPayload,
  Future7DayPayload,
  WeatherScene,
} from '../types/airvision';
import {
  describeWmoCode,
  getAqiTone,
  wmoCodeToScene,
} from '../utils/weatherLogic';
import { AtmosphereCard } from './AtmosphereCard';
import { BacktestChart, ShapChart } from './Charts';
import { useScrollReveal } from '../hooks/useScrollEffects';

interface ForecastSectionProps {
  forecast24h: Forecast24hPayload | null;
  explain: ForecastExplainPayload | null;
  backtest: BacktestPayload | null;
  future7Day: Future7DayPayload | null;
  reducedMotion: boolean;
  onPreviewScene: (scene: WeatherScene) => void;
}

function DayWeatherIcon({ code }: { code: number | null }) {
  const scene = wmoCodeToScene(code, 1, 40);
  const cls = 'h-5 w-5 text-sky-200';
  if (scene === 'sunny') return <Sun className="h-5 w-5 text-amber-300" aria-hidden="true" />;
  if (scene === 'partly-cloudy') return <CloudSun className="h-5 w-5 text-amber-200" aria-hidden="true" />;
  if (scene === 'rain') return <CloudRain className={cls} aria-hidden="true" />;
  if (scene === 'storm') return <CloudLightning className="h-5 w-5 text-violet-300" aria-hidden="true" />;
  if (scene === 'fog') return <CloudFog className="h-5 w-5 text-teal-200" aria-hidden="true" />;
  return <Cloud className="h-5 w-5 text-slate-300" aria-hidden="true" />;
}

function formatDayShort(iso: string): { weekday: string; dayMonth: string } {
  const d = new Date(iso + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return { weekday: iso, dayMonth: '' };
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    dayMonth: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
  };
}

export function ForecastSection({
  forecast24h,
  explain,
  backtest,
  future7Day,
  reducedMotion,
  onPreviewScene,
}: ForecastSectionProps) {
  const { ref, revealed } = useScrollReveal(reducedMotion);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);

  const days = future7Day?.days ?? [];
  const activeDay = days[selectedDayIdx] ?? null;
  const fTone = forecast24h ? getAqiTone(forecast24h.forecast_aqi) : null;

  return (
    <section
      id="forecast"
      ref={ref}
      aria-labelledby="forecast-heading"
      className={`reveal-item scroll-mt-24 space-y-8 ${revealed ? 'is-revealed' : ''}`}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-300">
            Forecast &amp; Model Intelligence
          </p>
          <h2 id="forecast-heading" className="mt-1 text-3xl font-semibold tracking-tight text-white">
            7-Day Outlook &amp; 24-Hour XGBoost Explainability
          </h2>
        </div>
        <p className="max-w-md text-sm text-slate-300">
          Select any forecast day below to preview its atmosphere directly in the live sky background.
        </p>
      </div>

      {/* 7-Day Interactive Outlook Grid */}
      {days.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {days.map((day, idx) => {
              const { weekday, dayMonth } = formatDayShort(day.date);
              const isSelected = idx === selectedDayIdx;
              const aqiTone = day.aqi_mean !== null ? getAqiTone(day.aqi_mean) : null;
              const previewScene = wmoCodeToScene(day.weather_code, 1, 45);
              return (
                <AtmosphereCard
                  key={day.date}
                  asButton
                  mode="tilt"
                  reducedMotion={reducedMotion}
                  ariaPressed={isSelected}
                  ariaLabel={`${weekday} ${dayMonth}: ${describeWmoCode(day.weather_code, 1)}, high ${day.temp_max ?? 'N/A'} degrees, preview ${previewScene} sky`}
                  onClick={() => {
                    setSelectedDayIdx(idx);
                    onPreviewScene(previewScene);
                  }}
                  className={`p-4 ${
                    isSelected ? 'ring-1 ring-white/55 bg-white/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">{weekday}</div>
                      <div className="font-mono text-[11px] text-slate-400 tabular-nums">{dayMonth}</div>
                    </div>
                    <DayWeatherIcon code={day.weather_code} />
                  </div>

                  <div className="mt-4 flex items-baseline gap-1.5 font-mono tabular-nums">
                    <span className="text-lg font-semibold text-white">
                      {day.temp_max !== null ? `${Math.round(day.temp_max)}°` : '—'}
                    </span>
                    <span className="text-xs text-slate-400">
                      / {day.temp_min !== null ? `${Math.round(day.temp_min)}°` : '—'}
                    </span>
                  </div>

                  <div className="mt-2 truncate text-xs text-slate-300">
                    {describeWmoCode(day.weather_code, 1)}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-[11px] font-mono tabular-nums">
                    <span className="text-slate-400">
                      Rain {day.rain_chance !== null ? `${Math.round(day.rain_chance)}%` : '—'}
                    </span>
                    <span className={aqiTone ? aqiTone.textClass : 'text-slate-400'}>
                      {day.aqi_mean !== null ? `AQI ${day.aqi_mean}` : 'AQI —'}
                    </span>
                  </div>
                </AtmosphereCard>
              );
            })}
          </div>

          {activeDay && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-y border-white/10 py-3 text-xs text-slate-300">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium text-white">
                  Selected: {formatDayShort(activeDay.date).weekday}, {formatDayShort(activeDay.date).dayMonth}
                </span>
                <span aria-hidden="true">·</span>
                <span>{describeWmoCode(activeDay.weather_code, 1)}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Rain {activeDay.rain_mm !== null ? `${activeDay.rain_mm.toFixed(1)} mm` : '0.0 mm'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Peak wind {activeDay.wind_max !== null ? `${activeDay.wind_max.toFixed(1)} km/h` : '—'}
                </span>
                {activeDay.pm25_mean !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">Mean PM2.5 {activeDay.pm25_mean} µg/m³</span>
                  </>
                )}
              </div>
              <span className="text-slate-400">
                Source: {future7Day?.aqi_standard ?? 'US EPA AQI'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 24h XGBoost Model Forecast + SHAP Explainability */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <AtmosphereCard mode="steady" reducedMotion={reducedMotion} className="p-6 lg:col-span-5">
          <div className="flex h-full flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-medium text-slate-300">
                XGBoost 24-Hour Historical Forecast
              </p>
              <div className="mt-3 flex items-baseline gap-4">
                <span className="font-mono text-5xl font-semibold tracking-tight text-white tabular-nums">
                  {forecast24h ? forecast24h.forecast_aqi : '—'}
                </span>
                <div>
                  <div className={`text-sm font-semibold ${fTone?.textClass ?? 'text-slate-200'}`}>
                    {forecast24h?.category ?? 'Loading'}
                  </div>
                  <div className="font-mono text-xs text-slate-400 tabular-nums">
                    Target {forecast24h?.target_utc ?? '—'}
                  </div>
                </div>
              </div>

              {forecast24h && (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-white/10 py-3 font-mono text-xs text-slate-300 tabular-nums">
                  <span>Holdout MAE: <strong className="text-white">{forecast24h.test_mae}</strong></span>
                  <span aria-hidden="true">/</span>
                  <span>Persistence Baseline: <strong className="text-slate-200">{forecast24h.baseline_mae}</strong></span>
                  <span aria-hidden="true">/</span>
                  <span>{forecast24h.test_rows.toLocaleString()} test rows</span>
                </div>
              )}
            </div>

            {forecast24h && (
              <div className="space-y-3 text-sm">
                <div>
                  <h3 className="text-xs font-medium text-slate-400">Health Advisory</h3>
                  <p className="mt-0.5 text-slate-100">{forecast24h.advisory}</p>
                </div>
                <div className="border-t border-white/10 pt-3">
                  <h3 className="text-xs font-medium text-slate-400">Outdoor Guidance</h3>
                  <p className="mt-0.5 text-slate-200">{forecast24h.outdoor}</p>
                </div>
                <div className="border-t border-white/10 pt-3">
                  <h3 className="text-xs font-medium text-slate-400">Sensitive Groups</h3>
                  <p className="mt-0.5 text-slate-300">{forecast24h.warning}</p>
                </div>
              </div>
            )}
          </div>
        </AtmosphereCard>

        <AtmosphereCard mode="steady" reducedMotion={reducedMotion} className="p-6 lg:col-span-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-white">SHAP Feature Contributions</h3>
              <p className="mt-0.5 text-xs text-slate-300">
                How each input shifts the 24h XGBoost prediction relative to its model baseline.
              </p>
            </div>
            {explain && (
              <div className="font-mono text-xs text-slate-300 tabular-nums">
                Base {explain.baseline_aqi.toFixed(1)} + Δ{explain.contribution_sum >= 0 ? '+' : ''}
                {explain.contribution_sum.toFixed(1)} ={' '}
                <strong className="text-white">{explain.raw_prediction_aqi.toFixed(1)}</strong>
              </div>
            )}
          </div>

          <div className="mt-5">
            {explain ? (
              <ShapChart contributions={explain.contributions} />
            ) : (
              <div className="h-52 animate-pulse rounded-xl bg-white/5" />
            )}
          </div>

          {explain && (
            <p className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-400">
              {explain.note}
            </p>
          )}
        </AtmosphereCard>
      </div>

      {/* Chronological Holdout Backtest */}
      {backtest && (
        <AtmosphereCard mode="steady" reducedMotion={reducedMotion} className="p-6">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Chronological Holdout Validation ({backtest.split})
              </h3>
              <p className="text-xs text-slate-300">{backtest.note}</p>
            </div>
            <div className="font-mono text-xs text-slate-300 tabular-nums">
              Model MAE {backtest.mae} vs Persistence {backtest.baseline_mae}
            </div>
          </div>
          <BacktestChart points={backtest.points} />
        </AtmosphereCard>
      )}
    </section>
  );
}

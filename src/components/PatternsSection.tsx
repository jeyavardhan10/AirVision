import { useState } from 'react';
import type { WeatherPatternsPayload } from '../types/airvision';
import { getAqiTone } from '../utils/weatherLogic';
import { AtmosphereCard } from './AtmosphereCard';
import { WeatherTrendChart } from './Charts';
import { useScrollReveal } from '../hooks/useScrollEffects';

interface PatternsSectionProps {
  patterns: WeatherPatternsPayload | null;
  reducedMotion: boolean;
}

type PatternMetric = 'temperature' | 'humidity' | 'wind_speed' | 'rainfall';

const METRIC_TABS: Array<{ id: PatternMetric; label: string }> = [
  { id: 'temperature', label: 'Temperature' },
  { id: 'humidity', label: 'Humidity' },
  { id: 'wind_speed', label: 'Wind Speed' },
  { id: 'rainfall', label: 'Rainfall' },
];

export function PatternsSection({ patterns, reducedMotion }: PatternsSectionProps) {
  const { ref, revealed } = useScrollReveal(reducedMotion);
  const [metric, setMetric] = useState<PatternMetric>('temperature');

  return (
    <section
      id="patterns"
      ref={ref}
      aria-labelledby="patterns-heading"
      className={`reveal-item scroll-mt-24 space-y-8 ${revealed ? 'is-revealed' : ''}`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-300">
            Weather Intelligence · {patterns ? `${patterns.records.toLocaleString()} hourly records` : 'Historical archive'}
          </p>
          <h2 id="patterns-heading" className="mt-1 text-3xl font-semibold tracking-tight text-white">
            Seasonal Cycles &amp; Meteorological AQI Associations
          </h2>
        </div>

        <div
          role="tablist"
          aria-label="Select 30-day weather trend metric"
          className="atmosphere-surface inline-flex items-center gap-1 rounded-xl p-1 self-start"
        >
          {METRIC_TABS.map((tab) => {
            const active = metric === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMetric(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${
                  active
                    ? 'bg-white text-slate-950'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 30-day trend chart */}
      <AtmosphereCard mode="steady" reducedMotion={reducedMotion} className="p-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold text-white">
            Last 30 Dataset Days — {METRIC_TABS.find((t) => t.id === metric)?.label}
          </h3>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {patterns ? `${patterns.date_start} to ${patterns.date_end}` : ''}
          </span>
        </div>
        {patterns ? (
          <WeatherTrendChart daily={patterns.daily} metric={metric} />
        ) : (
          <div className="h-56 animate-pulse rounded-xl bg-white/5" />
        )}
      </AtmosphereCard>

      {/* Calendar Seasons Strip */}
      {patterns && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {patterns.seasons.map((s) => {
            const tone = getAqiTone(s.aqi);
            return (
              <AtmosphereCard key={s.season} mode="tilt" reducedMotion={reducedMotion} className="p-5">
                <div className="text-xs font-medium text-slate-300">{s.season}</div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="font-mono text-3xl font-semibold text-white tabular-nums">
                      {s.aqi.toFixed(1)}
                    </span>
                    <span className="ml-1.5 font-mono text-xs text-slate-400">US AQI</span>
                  </div>
                  <span className={`text-xs font-medium ${tone.textClass}`}>{tone.shortLabel}</span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-y-2 border-t border-white/10 pt-3 font-mono text-xs text-slate-300 tabular-nums">
                  <div>
                    <dt className="text-slate-400">Temp</dt>
                    <dd className="text-white">{s.temperature}°C</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Humidity</dt>
                    <dd className="text-white">{s.humidity}%</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Wind</dt>
                    <dd className="text-white">{s.wind_speed} km/h</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Rain sum</dt>
                    <dd className="text-white">{s.rainfall.toFixed(0)} mm</dd>
                  </div>
                </dl>
              </AtmosphereCard>
            );
          })}
        </div>
      )}

      {/* Quartile Comparison Table + Insights */}
      {patterns && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <AtmosphereCard mode="steady" reducedMotion={reducedMotion} className="p-6 lg:col-span-8">
            <h3 className="text-lg font-semibold text-white">
              Weather Quartiles vs. Mean US AQI
            </h3>
            <p className="mt-1 text-xs text-slate-300">
              Comparing average AQI during bottom-quartile (25th pct) vs. top-quartile (75th pct) weather hours.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/15 text-xs text-slate-400">
                    <th className="py-2.5 pr-4 font-medium">Variable</th>
                    <th className="py-2.5 px-3 text-right font-medium">Low Q1 AQI</th>
                    <th className="py-2.5 px-3 text-right font-medium">High Q3 AQI</th>
                    <th className="py-2.5 px-3 text-right font-medium">Δ AQI</th>
                    <th className="py-2.5 pl-3 text-right font-medium">Pearson r</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 font-mono text-xs tabular-nums">
                  {patterns.comparisons.map((row) => (
                    <tr key={row.key} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-4 font-sans text-sm font-medium text-white">
                        {row.label}
                        <span className="ml-2 font-mono text-[11px] font-normal text-slate-400">
                          ({row.low_threshold}–{row.high_threshold} {row.unit})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-200">{row.low_aqi.toFixed(1)}</td>
                      <td className="py-3 px-3 text-right text-slate-200">{row.high_aqi.toFixed(1)}</td>
                      <td
                        className={`py-3 px-3 text-right font-medium ${
                          row.difference <= 0 ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {row.difference > 0 ? '+' : ''}
                        {row.difference.toFixed(1)}
                      </td>
                      <td className="py-3 pl-3 text-right text-sky-300">
                        {row.correlation >= 0 ? '+' : ''}
                        {row.correlation.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AtmosphereCard>

          <AtmosphereCard mode="steady" reducedMotion={reducedMotion} className="p-6 lg:col-span-4">
            <h3 className="text-lg font-semibold text-white">Observational Insights</h3>
            <ul className="mt-4 space-y-4 text-sm leading-relaxed text-slate-200">
              {patterns.insights.map((insight, i) => (
                <li key={i} className={i > 0 ? 'border-t border-white/10 pt-4' : ''}>
                  {insight}
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-white/10 pt-3 text-xs text-slate-400">
              {patterns.methodology}
            </p>
          </AtmosphereCard>
        </div>
      )}
    </section>
  );
}

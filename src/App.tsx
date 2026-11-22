import { RefreshCw, ArrowDownRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AtmosphereCard } from './components/AtmosphereCard';
import { TimelineChart } from './components/Charts';
import { EstimatorSection } from './components/EstimatorSection';
import { ForecastSection } from './components/ForecastSection';
import { LiveSkyCanvas } from './components/LiveSkyCanvas';
import { PatternsSection } from './components/PatternsSection';
import { SceneDock } from './components/SceneDock';
import { WeatherCursor } from './components/WeatherCursor';
import { WeatherOrb } from './components/WeatherOrb';
import { useReducedMotion, useScrollTelemetry, type SectionId } from './hooks/useScrollEffects';
import type {
  BacktestPayload,
  DashboardPayload,
  Forecast24hPayload,
  ForecastExplainPayload,
  Future7DayPayload,
  LiveConditions,
  SceneMode,
  WeatherPatternsPayload,
  WeatherScene,
} from './types/airvision';
import {
  SCENE_META,
  getAqiAdvice,
  getAqiCategory,
  getAqiTone,
  wmoCodeToScene,
} from './utils/weatherLogic';

const NAV_LINKS: Array<{ id: SectionId; label: string }> = [
  { id: 'live', label: 'Live Sky' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'estimator', label: 'Estimator' },
];

export default function App() {
  const reducedMotion = useReducedMotion();
  const { scrollProgress, scrollY, activeSection } = useScrollTelemetry();

  const [sceneMode, setSceneMode] = useState<SceneMode>('live');
  const [live, setLive] = useState<LiveConditions | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [forecast24h, setForecast24h] = useState<Forecast24hPayload | null>(null);
  const [explain, setExplain] = useState<ForecastExplainPayload | null>(null);
  const [backtest, setBacktest] = useState<BacktestPayload | null>(null);
  const [future7Day, setFuture7Day] = useState<Future7DayPayload | null>(null);
  const [patterns, setPatterns] = useState<WeatherPatternsPayload | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [timelineMetric, setTimelineMetric] = useState<'aqi' | 'pm25' | 'temperature'>('aqi');

  const fetchLive = useCallback(async (force = false) => {
    setRefreshing(true);
    try {
      const res = await fetch(force ? '/api/live?force=1' : '/api/live');
      if (res.ok) {
        const data = (await res.json()) as LiveConditions;
        setLive(data);
      }
    } catch {
      // Keep existing state on transient error
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLive(false);
    const loadAll = async () => {
      const [dashRes, f24Res, expRes, btRes, f7Res, patRes] = await Promise.allSettled([
        fetch('/api/dashboard').then((r) => r.json()),
        fetch('/api/forecast/24h').then((r) => r.json()),
        fetch('/api/forecast/explain').then((r) => r.json()),
        fetch('/api/forecast/backtest').then((r) => r.json()),
        fetch('/api/future/7day').then((r) => r.json()),
        fetch('/api/weather/patterns').then((r) => r.json()),
      ]);

      if (dashRes.status === 'fulfilled') setDashboard(dashRes.value);
      if (f24Res.status === 'fulfilled') setForecast24h(f24Res.value);
      if (expRes.status === 'fulfilled') setExplain(expRes.value);
      if (btRes.status === 'fulfilled') setBacktest(btRes.value);
      if (f7Res.status === 'fulfilled') setFuture7Day(f7Res.value);
      if (patRes.status === 'fulfilled') setPatterns(patRes.value);
    };

    loadAll();

    // Re-check live sky conditions every 5 minutes while visible
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLive(false);
      }
    }, 300_000);

    return () => window.clearInterval(interval);
  }, [fetchLive]);

  const liveScene: WeatherScene = wmoCodeToScene(
    live?.weather_code,
    live?.is_day,
    live?.cloud_cover
  );
  const activeScene: WeatherScene = sceneMode === 'live' ? liveScene : sceneMode;

  useEffect(() => {
    document.documentElement.setAttribute('data-scene', activeScene);
  }, [activeScene]);

  const displayAqi = live?.aqi ?? dashboard?.latest.aqi ?? 68;
  const displayCategory = live?.category ?? getAqiCategory(displayAqi);
  const displayTone = getAqiTone(displayAqi);
  const displayAdvice = getAqiAdvice(displayAqi);

  // Subtle compositor-only hero parallax rates
  const heroTextParallax = reducedMotion ? 0 : Math.min(scrollY, 640) * -0.055;
  const heroOrbParallax = reducedMotion ? 0 : Math.min(scrollY, 640) * 0.045;

  return (
    <div className="relative min-h-screen text-slate-100" data-active-scene={activeScene}>
      {/* Live atmospheric canvas background */}
      <LiveSkyCanvas scene={activeScene} aqi={displayAqi} reducedMotion={reducedMotion} />

      {/* Custom weather-reactive cursor & particle trail */}
      <WeatherCursor scene={activeScene} reducedMotion={reducedMotion} />

      {/* Luminous top scroll progress hairline */}
      <div
        aria-hidden="true"
        data-testid="scroll-progress-bar"
        className="fixed top-0 left-0 z-50 h-0.5 w-full origin-left bg-gradient-to-r from-sky-300 via-white to-amber-200 transition-transform duration-75"
        style={{ transform: `scaleX(${scrollProgress})` }}
      />

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-white/12 bg-[#070d19]/84">
        <div className="mx-auto flex max-w-[1220px] items-center justify-between gap-8 px-5 py-3.5 sm:px-8">
          {/* Zone 1: Single text wordmark */}
          <a
            href="#live"
            className="font-display text-xl font-semibold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300"
          >
            AirVision
          </a>

          {/* Zone 2: 4 clean single-line navigation links */}
          <nav aria-label="Primary navigation" className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300 ${
                    isActive ? 'text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={`absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-white transition-transform duration-200 ${
                      isActive ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </a>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => fetchLive(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-950 whitespace-nowrap shrink-0 transition-colors hover:bg-sky-100 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 shrink-0 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{refreshing ? 'Syncing' : 'Refresh Live'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1220px] space-y-20 px-5 pt-10 pb-28 sm:px-8 sm:pt-14">
        {/* Section 1: Hero & Live Atmospheric Observatory */}
        <section id="live" aria-labelledby="hero-heading" className="scroll-mt-24 space-y-8">
          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
            {/* Editorial Hero Left Column with Parallax */}
            <div
              style={{
                transform: reducedMotion ? undefined : `translate3d(0, ${heroTextParallax.toFixed(1)}px, 0)`,
                willChange: reducedMotion ? undefined : 'transform',
              }}
              className="lg:col-span-7"
            >
              <AtmosphereCard mode="steady" reducedMotion={reducedMotion} className="h-full p-7 sm:p-9">
                <div className="flex h-full flex-col justify-between gap-7">
                  <div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-300">
                      <span>Bengaluru, India</span>
                      <span aria-hidden="true">·</span>
                      <span>US EPA AQI</span>
                      <span aria-hidden="true">·</span>
                      <span>Sky: {SCENE_META[activeScene].label}</span>
                    </div>

                    <h1
                      id="hero-heading"
                      className="mt-4 max-w-xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl"
                    >
                      Living sky telemetry for Bengaluru air quality.
                    </h1>

                    <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-200/95">
                      {displayAdvice.advisory} {displayAdvice.outdoor}
                    </p>
                  </div>

                  {/* Primary Monumental AQI Readout */}
                  <div className="flex flex-col gap-5 border-t border-white/12 pt-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-300">
                        Current Modeled US AQI
                      </div>
                      <div className="mt-1 flex items-baseline gap-3.5">
                        <span className="font-mono text-6xl font-semibold tracking-tight text-white tabular-nums sm:text-7xl">
                          {Math.round(displayAqi)}
                        </span>
                        <span className={`text-lg font-semibold ${displayTone.textClass}`}>
                          {displayCategory}
                        </span>
                      </div>
                    </div>

                    <a
                      href="#estimator"
                      className="inline-flex items-center gap-2 self-start rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white whitespace-nowrap transition-colors hover:bg-white/18 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 sm:self-auto"
                    >
                      <span>Open AQI Estimator</span>
                      <ArrowDownRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </AtmosphereCard>
            </div>

            {/* Right Floating Parallax Weather Orb */}
            <div className="lg:col-span-5">
              <WeatherOrb
                live={live}
                scene={activeScene}
                isPreviewing={sceneMode !== 'live'}
                parallaxY={heroOrbParallax}
                reducedMotion={reducedMotion}
              />
            </div>
          </div>

          {/* Full-width 4-column KPI strip below hero split */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AtmosphereCard mode="tilt" reducedMotion={reducedMotion} className="p-5">
              <div className="text-xs font-medium text-slate-300">Fine Particulate (PM2.5)</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-semibold text-white tabular-nums">
                  {typeof live?.pm25 === 'number'
                    ? live.pm25.toFixed(1)
                    : dashboard
                      ? dashboard.latest.pm25.toFixed(1)
                      : '—'}
                </span>
                <span className="font-mono text-xs text-slate-400">µg/m³</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">Primary driver of US EPA AQI score</p>
            </AtmosphereCard>

            <AtmosphereCard mode="tilt" reducedMotion={reducedMotion} className="p-5">
              <div className="text-xs font-medium text-slate-300">Coarse Particulate (PM10)</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-semibold text-white tabular-nums">
                  {typeof live?.pm10 === 'number'
                    ? live.pm10.toFixed(1)
                    : dashboard
                      ? dashboard.latest.pm10.toFixed(1)
                      : '—'}
                </span>
                <span className="font-mono text-xs text-slate-400">µg/m³</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">Road dust &amp; regional aerosol fraction</p>
            </AtmosphereCard>

            <AtmosphereCard mode="tilt" reducedMotion={reducedMotion} className="p-5">
              <div className="text-xs font-medium text-slate-300">24h Model Forecast</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-semibold text-white tabular-nums">
                  {forecast24h ? forecast24h.forecast_aqi : '—'}
                </span>
                <span className="font-mono text-xs text-slate-400">US AQI</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                XGBoost MAE {forecast24h?.test_mae ?? 9.61} vs {forecast24h?.baseline_mae ?? 11.47} baseline
              </p>
            </AtmosphereCard>

            <AtmosphereCard mode="tilt" reducedMotion={reducedMotion} className="p-5">
              <div className="text-xs font-medium text-slate-300">Historical Archive</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-semibold text-white tabular-nums">
                  {dashboard ? dashboard.records.toLocaleString() : '37,200'}
                </span>
                <span className="font-mono text-xs text-slate-400">hours</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">Open-Meteo Bengaluru 2022–2026 overlap</p>
            </AtmosphereCard>
          </div>

          {/* 14-Day Interactive Historical Timeline */}
          <AtmosphereCard mode="steady" reducedMotion={reducedMotion} className="p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">14-Day Hourly Atmospheric Trace</h2>
                <p className="text-xs text-slate-300">
                  Move pointer across the plot to inspect exact UTC timestamp readings.
                </p>
              </div>
              <div
                role="tablist"
                aria-label="Timeline trace metric"
                className="inline-flex items-center gap-1 rounded-xl bg-white/8 p-1 self-start"
              >
                {(
                  [
                    ['aqi', 'US AQI'],
                    ['pm25', 'PM2.5'],
                    ['temperature', 'Temperature'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={timelineMetric === id}
                    onClick={() => setTimelineMetric(id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      timelineMetric === id
                        ? 'bg-white text-slate-950'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {dashboard ? (
              <TimelineChart points={dashboard.timeline} metric={timelineMetric} />
            ) : (
              <div className="h-56 animate-pulse rounded-xl bg-white/5" />
            )}
          </AtmosphereCard>
        </section>

        {/* Section 2: Forecast, 7-Day Outlook, SHAP & Holdout Backtest */}
        <ForecastSection
          forecast24h={forecast24h}
          explain={explain}
          backtest={backtest}
          future7Day={future7Day}
          reducedMotion={reducedMotion}
          onPreviewScene={(scene) => setSceneMode(scene)}
        />

        {/* Section 3: Weather Intelligence & Seasonal Patterns */}
        <PatternsSection patterns={patterns} reducedMotion={reducedMotion} />

        {/* Section 4: Same-Time US AQI Estimator */}
        <EstimatorSection reducedMotion={reducedMotion} />
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="relative z-10 border-t border-white/12 bg-[#070d19]/75">
        <div className="mx-auto flex max-w-[1220px] flex-col gap-3 px-5 py-8 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="space-y-1">
            <div className="font-medium text-slate-200">
              AirVision · Bengaluru Atmospheric &amp; US EPA AQI Observatory
            </div>
            <div>
              {live?.source ?? 'Open-Meteo modeled weather & air-quality estimates'} · Not ground-station readings.
            </div>
          </div>
          <div className="font-mono text-slate-400 tabular-nums">
            {live?.fetched_at_utc ? `Synced ${live.fetched_at_utc}` : 'US EPA AQI Scale (0–500)'}
          </div>
        </div>
      </footer>

      {/* Floating Weather Scene Preview Dock */}
      <SceneDock
        mode={sceneMode}
        activeScene={activeScene}
        liveScene={liveScene}
        onSelectMode={setSceneMode}
      />
    </div>
  );
}

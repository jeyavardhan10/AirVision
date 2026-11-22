import { useState, type FormEvent } from 'react';
import type { EstimatorPrediction } from '../types/airvision';
import {
  ESTIMATOR_LIMITS,
  estimateSameTimeAqi,
  getAqiAdvice,
  getAqiCategory,
  getAqiTone,
  validateEstimatorInputs,
} from '../utils/weatherLogic';
import { AtmosphereCard } from './AtmosphereCard';
import { useScrollReveal } from '../hooks/useScrollEffects';

interface EstimatorSectionProps {
  reducedMotion: boolean;
}

interface Preset {
  label: string;
  temperature: string;
  humidity: string;
  pm25: string;
  pm10: string;
}

const PRESETS: Preset[] = [
  { label: 'Monsoon Clean', temperature: '22.5', humidity: '82', pm25: '8.5', pm10: '18' },
  { label: 'Typical Afternoon', temperature: '26.4', humidity: '56', pm25: '22', pm10: '44' },
  { label: 'Winter Inversion', temperature: '16.8', humidity: '74', pm25: '48', pm10: '96' },
  { label: 'Severe Dust Event', temperature: '29.2', humidity: '38', pm25: '115', pm10: '260' },
];

export function EstimatorSection({ reducedMotion }: EstimatorSectionProps) {
  const { ref, revealed } = useScrollReveal(reducedMotion);

  const [temperature, setTemperature] = useState('24.5');
  const [humidity, setHumidity] = useState('62');
  const [pm25, setPm25] = useState('26');
  const [pm10, setPm10] = useState('48');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EstimatorPrediction>(() => {
    const initialAqi = estimateSameTimeAqi({ temperature: 24.5, humidity: 62, pm25: 26, pm10: 48 });
    const advice = getAqiAdvice(initialAqi);
    return {
      aqi: initialAqi,
      category: getAqiCategory(initialAqi),
      ...advice,
      type: 'AQI estimate from provided measurements (not a future forecast)',
    };
  });

  const runEstimate = async (raw: {
    temperature: string;
    humidity: string;
    pm25: string;
    pm10: string;
  }) => {
    const check = validateEstimatorInputs(raw);
    if (!check.ok) {
      setError(check.error);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(check.values),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Prediction request failed.');
        return;
      }
      setResult(data as EstimatorPrediction);
    } catch {
      setError('Could not reach estimator service. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    runEstimate({ temperature, humidity, pm25, pm10 });
  };

  const applyPreset = (preset: Preset) => {
    setTemperature(preset.temperature);
    setHumidity(preset.humidity);
    setPm25(preset.pm25);
    setPm10(preset.pm10);
    runEstimate(preset);
  };

  const tone = getAqiTone(result.aqi);
  const gaugePct = Math.min(100, Math.max(2, (result.aqi / 350) * 100));

  const fields = [
    {
      id: 'est-temp',
      key: 'temperature' as const,
      value: temperature,
      setter: setTemperature,
      step: '0.5',
    },
    {
      id: 'est-humidity',
      key: 'humidity' as const,
      value: humidity,
      setter: setHumidity,
      step: '1',
    },
    {
      id: 'est-pm25',
      key: 'pm25' as const,
      value: pm25,
      setter: setPm25,
      step: '1',
    },
    {
      id: 'est-pm10',
      key: 'pm10' as const,
      value: pm10,
      setter: setPm10,
      step: '1',
    },
  ];

  return (
    <section
      id="estimator"
      ref={ref}
      aria-labelledby="estimator-heading"
      className={`reveal-item scroll-mt-24 space-y-6 ${revealed ? 'is-revealed' : ''}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-300">Same-Time Pollutant Estimator</p>
          <h2 id="estimator-heading" className="mt-1 text-3xl font-semibold tracking-tight text-white">
            Interactive US EPA AQI Calculator
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Estimator scenario presets">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="atmosphere-surface rounded-lg px-3 py-1.5 text-xs font-medium text-slate-200 whitespace-nowrap hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <AtmosphereCard mode="steady" reducedMotion={reducedMotion} className="p-6 lg:col-span-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {fields.map(({ id, key, value, setter, step }) => {
                const lim = ESTIMATOR_LIMITS[key];
                const numVal = Number(value);
                const sliderVal = Number.isFinite(numVal)
                  ? Math.max(lim.min, Math.min(lim.max, numVal))
                  : lim.min;

                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor={id} className="font-medium text-slate-200">
                        {lim.label}
                      </label>
                      <span className="font-mono text-slate-400">
                        {lim.min}–{lim.max} {lim.unit}
                      </span>
                    </div>
                    <input
                      id={id}
                      name={key}
                      type="number"
                      step={step}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-3.5 py-2.5 font-mono text-sm text-white tabular-nums focus:border-sky-400 focus:outline-none"
                    />
                    <input
                      type="range"
                      aria-label={`${lim.label} slider`}
                      min={lim.min}
                      max={key === 'pm25' ? 300 : key === 'pm10' ? 450 : lim.max}
                      step={step}
                      value={Math.min(sliderVal, key === 'pm25' ? 300 : key === 'pm10' ? 450 : lim.max)}
                      onChange={(e) => setter(e.target.value)}
                      className="air-slider w-full"
                    />
                  </div>
                );
              })}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-400/40 bg-rose-950/50 px-4 py-3 text-sm text-rose-200"
              >
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-1">
              <p className="text-xs text-slate-400">
                Estimates same-time US EPA AQI; not a future forecast.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 whitespace-nowrap shrink-0 transition-colors hover:bg-sky-100 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
              >
                {submitting ? 'Estimating...' : 'Estimate AQI'}
              </button>
            </div>
          </form>
        </AtmosphereCard>

        <AtmosphereCard mode="tilt" reducedMotion={reducedMotion} className="p-6 lg:col-span-6">
          <div className="flex h-full flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-medium text-slate-300">Estimated US EPA AQI</p>
              <div className="mt-3 flex items-baseline justify-between gap-4">
                <div className="flex items-baseline gap-3">
                  <span
                    data-testid="estimator-aqi-value"
                    className="font-mono text-6xl font-semibold tracking-tight text-white tabular-nums"
                  >
                    {result.aqi}
                  </span>
                  <span className={`text-base font-semibold ${tone.textClass}`}>
                    {result.category}
                  </span>
                </div>
              </div>

              {/* US EPA scale bar */}
              <div className="mt-5">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${tone.barClass}`}
                    style={{ width: `${gaugePct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[11px] text-slate-400 tabular-nums">
                  <span>0 Good</span>
                  <span>50</span>
                  <span>100 Mod</span>
                  <span>150 USG</span>
                  <span>200+</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
              <div>
                <h3 className="text-xs font-medium text-slate-400">Summary</h3>
                <p className="mt-1 text-sm text-slate-100">{result.advisory}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-slate-400">Outdoor Activity</h3>
                <p className="mt-1 text-sm text-slate-200">{result.outdoor}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-slate-400">Health Watch</h3>
                <p className="mt-1 text-sm text-slate-300">{result.warning}</p>
              </div>
            </div>
          </div>
        </AtmosphereCard>
      </div>
    </section>
  );
}

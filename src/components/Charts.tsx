import { useState } from 'react';
import type {
  BacktestPoint,
  ShapContribution,
  TimelinePoint,
  WeatherPatternDaily,
} from '../types/airvision';

interface TimelineChartProps {
  points: TimelinePoint[];
  metric: 'aqi' | 'pm25' | 'temperature';
}

export function TimelineChart({ points, metric }: TimelineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!points.length) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-400">
        No historical timeline records available.
      </div>
    );
  }

  const width = 760;
  const height = 224;
  const pad = { top: 18, right: 16, bottom: 28, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const values = points.map((p) => p[metric]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const minVal = Math.max(0, Math.floor(rawMin * 0.85));
  const maxVal = Math.ceil(rawMax * 1.12) || 100;
  const span = Math.max(1, maxVal - minVal);

  const coords = points.map((p, idx) => {
    const x = pad.left + (idx / Math.max(1, points.length - 1)) * plotW;
    const y = pad.top + plotH - ((p[metric] - minVal) / span) * plotH;
    return { x, y, point: p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${(pad.left + plotW).toFixed(1)} ${(pad.top + plotH).toFixed(1)} L ${pad.left} ${(pad.top + plotH).toFixed(1)} Z`;

  const strokeColor =
    metric === 'aqi' ? '#38bdf8' : metric === 'pm25' ? '#fbbf24' : '#fb923c';
  const unit = metric === 'aqi' ? 'US AQI' : metric === 'pm25' ? 'µg/m³' : '°C';

  const active = hoverIdx !== null ? coords[hoverIdx] : coords[coords.length - 1];
  const yTicks = [0, 0.5, 1].map((t) => Math.round(minVal + span * t));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <span className="font-mono tabular-nums text-slate-200">{active.point.date}</span>
        <div className="flex items-center gap-4 font-mono tabular-nums">
          <span>
            Reading:{' '}
            <strong className="text-white">
              {active.point[metric]} {unit}
            </strong>
          </span>
          <span className="text-slate-400">
            Humidity: {active.point.humidity}%
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full cursor-crosshair select-none"
        role="img"
        aria-label={`14-day historical ${metric} trend chart`}
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * width;
          const t = Math.max(0, Math.min(1, (relX - pad.left) / plotW));
          setHoverIdx(Math.round(t * (points.length - 1)));
        }}
      >
        <defs>
          <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.34" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = pad.top + plotH - ((tick - minVal) / span) * plotH;
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="3 4"
              />
              <text
                x={pad.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 font-mono text-[10px]"
              >
                {tick}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={`url(#grad-${metric})`} />
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.2" strokeLinejoin="round" />

        {/* Crosshair and active point */}
        <line
          x1={active.x}
          x2={active.x}
          y1={pad.top}
          y2={pad.top + plotH}
          stroke="rgba(255,255,255,0.28)"
          strokeDasharray="3 3"
        />
        <circle cx={active.x} cy={active.y} r="4.5" fill={strokeColor} stroke="#070d19" strokeWidth="2" />

        {/* Start / mid / end dates */}
        {[0, Math.floor(points.length / 2), points.length - 1].map((idx) => (
          <text
            key={idx}
            x={coords[idx].x}
            y={height - 6}
            textAnchor={idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}
            className="fill-slate-400 font-mono text-[10px]"
          >
            {points[idx].date.slice(5, 10)}
          </text>
        ))}
      </svg>
    </div>
  );
}

interface ShapChartProps {
  contributions: ShapContribution[];
}

export function ShapChart({ contributions }: ShapChartProps) {
  const top = contributions.slice(0, 8);
  const maxAbs = Math.max(1, ...top.map((c) => Math.abs(c.shap_value)));

  return (
    <div className="space-y-2.5" role="list" aria-label="SHAP feature attributions">
      {top.map((item) => {
        const pct = Math.min(100, (Math.abs(item.shap_value) / maxAbs) * 100);
        const positive = item.shap_value >= 0;
        return (
          <div key={item.feature} role="listitem" className="grid grid-cols-[1fr_minmax(110px,1fr)_72px] items-center gap-3 text-xs">
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-100">{item.label}</div>
              <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                Input: {item.input_value}
              </div>
            </div>

            {/* Diverging center bar */}
            <div className="relative flex h-5 items-center">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" aria-hidden="true" />
              <div className="flex w-1/2 justify-end pr-0.5">
                {!positive && (
                  <div
                    className="h-2.5 rounded-l-sm bg-sky-400/90 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              <div className="flex w-1/2 justify-start pl-0.5">
                {positive && (
                  <div
                    className="h-2.5 rounded-r-sm bg-amber-400/90 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
            </div>

            <div
              className={`text-right font-mono font-medium tabular-nums ${
                positive ? 'text-amber-300' : 'text-sky-300'
              }`}
            >
              {positive ? '+' : ''}
              {item.shap_value.toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface BacktestChartProps {
  points: BacktestPoint[];
}

export function BacktestChart({ points }: BacktestChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (!points.length) return null;

  const width = 760;
  const height = 216;
  const pad = { top: 16, right: 16, bottom: 26, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const allVals = points.flatMap((p) => [p.actual, p.predicted]);
  const minVal = Math.max(0, Math.floor(Math.min(...allVals) * 0.85));
  const maxVal = Math.ceil(Math.max(...allVals) * 1.1);
  const span = Math.max(1, maxVal - minVal);

  const toX = (i: number) => pad.left + (i / Math.max(1, points.length - 1)) * plotW;
  const toY = (v: number) => pad.top + plotH - ((v - minVal) / span) * plotH;

  const actualPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.actual).toFixed(1)}`)
    .join(' ');
  const predPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.predicted).toFixed(1)}`)
    .join(' ');

  const idx = hoverIdx !== null ? hoverIdx : points.length - 1;
  const active = points[idx];
  const yTicks = [minVal, Math.round((minVal + maxVal) / 2), maxVal];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-4 bg-slate-100" aria-hidden="true" />
            Actual US AQI
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-sky-400" aria-hidden="true" />
            XGBoost 24h Forecast
          </span>
        </div>
        <div className="font-mono tabular-nums text-slate-200">
          {active.date.slice(0, 10)} · Actual {active.actual} vs Pred {active.predicted}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full cursor-crosshair select-none"
        role="img"
        aria-label="Chronological 80/20 holdout actual versus predicted US AQI chart"
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * width;
          const t = Math.max(0, Math.min(1, (relX - pad.left) / plotW));
          setHoverIdx(Math.round(t * (points.length - 1)));
        }}
      >
        {yTicks.map((tick) => {
          const y = toY(tick);
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
              />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" className="fill-slate-400 font-mono text-[10px]">
                {tick}
              </text>
            </g>
          );
        })}

        <path d={actualPath} fill="none" stroke="#e2e8f0" strokeWidth="1.8" opacity="0.88" />
        <path d={predPath} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="5 3" />

        <line
          x1={toX(idx)}
          x2={toX(idx)}
          y1={pad.top}
          y2={pad.top + plotH}
          stroke="rgba(255,255,255,0.24)"
          strokeDasharray="3 3"
        />
        <circle cx={toX(idx)} cy={toY(active.actual)} r="3.8" fill="#f8fafc" />
        <circle cx={toX(idx)} cy={toY(active.predicted)} r="3.8" fill="#38bdf8" />
      </svg>
    </div>
  );
}

interface WeatherTrendChartProps {
  daily: WeatherPatternDaily[];
  metric: 'temperature' | 'humidity' | 'wind_speed' | 'rainfall';
}

export function WeatherTrendChart({ daily, metric }: WeatherTrendChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (!daily.length) return null;

  const width = 760;
  const height = 224;
  const pad = { top: 18, right: 16, bottom: 28, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const vals = daily.map((d) => d[metric]);
  const maxVal = Math.max(1, Math.ceil(Math.max(...vals) * 1.15));
  const minVal = metric === 'rainfall' ? 0 : Math.max(0, Math.floor(Math.min(...vals) * 0.85));
  const span = Math.max(1, maxVal - minVal);

  const unitMap = {
    temperature: '°C',
    humidity: '%',
    wind_speed: 'km/h',
    rainfall: 'mm',
  };
  const colorMap = {
    temperature: '#fb923c',
    humidity: '#38bdf8',
    wind_speed: '#34d399',
    rainfall: '#60a5fa',
  };

  const activeIdx = hoverIdx !== null ? hoverIdx : daily.length - 1;
  const active = daily[activeIdx];
  const color = colorMap[metric];

  const barW = Math.max(8, plotW / daily.length - 5);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <span className="font-mono tabular-nums text-slate-200">{active.date}</span>
        <div className="flex items-center gap-4 font-mono tabular-nums">
          <span>
            Value:{' '}
            <strong className="text-white">
              {active[metric]} {unitMap[metric]}
            </strong>
          </span>
          <span className="text-slate-400">Daily mean AQI: {active.aqi}</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full cursor-crosshair select-none"
        role="img"
        aria-label={`30-day Bengaluru ${metric} trend chart`}
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * width;
          const t = Math.max(0, Math.min(1, (relX - pad.left) / plotW));
          setHoverIdx(Math.round(t * (daily.length - 1)));
        }}
      >
        {[minVal, Math.round((minVal + maxVal) / 2), maxVal].map((tick) => {
          const y = pad.top + plotH - ((tick - minVal) / span) * plotH;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" className="fill-slate-400 font-mono text-[10px]">
                {tick}
              </text>
            </g>
          );
        })}

        {metric === 'rainfall' ? (
          daily.map((d, i) => {
            const x = pad.left + (i / daily.length) * plotW + 2;
            const h = ((d.rainfall - minVal) / span) * plotH;
            const y = pad.top + plotH - h;
            return (
              <rect
                key={d.date}
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, h)}
                rx="3"
                fill={i === activeIdx ? '#93c5fd' : color}
                opacity={i === activeIdx ? 1 : 0.72}
              />
            );
          })
        ) : (
          <>
            <path
              d={daily
                .map((d, i) => {
                  const x = pad.left + (i / Math.max(1, daily.length - 1)) * plotW;
                  const y = pad.top + plotH - ((d[metric] - minVal) / span) * plotH;
                  return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                })
                .join(' ')}
              fill="none"
              stroke={color}
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <circle
              cx={pad.left + (activeIdx / Math.max(1, daily.length - 1)) * plotW}
              cy={pad.top + plotH - ((active[metric] - minVal) / span) * plotH}
              r="4.5"
              fill={color}
              stroke="#070d19"
              strokeWidth="2"
            />
          </>
        )}

        {[0, Math.floor(daily.length / 2), daily.length - 1].map((idx) => {
          const x = pad.left + (idx / Math.max(1, daily.length - 1)) * plotW;
          return (
            <text
              key={idx}
              x={x}
              y={height - 6}
              textAnchor={idx === 0 ? 'start' : idx === daily.length - 1 ? 'end' : 'middle'}
              className="fill-slate-400 font-mono text-[10px]"
            >
              {daily[idx].date}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

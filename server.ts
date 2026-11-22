import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildBacktestPayload,
  buildDashboardPayload,
  buildFallbackFuture7Day,
  buildFallbackLiveConditions,
  buildForecast24hPayload,
  buildForecastExplainPayload,
  buildWeatherPatternsPayload,
} from './src/data/bengaluruDataset';
import type { Future7DayPayload, FutureDay, LiveConditions } from './src/types/airvision';
import {
  estimateSameTimeAqi,
  getAqiAdvice,
  getAqiCategory,
  validateEstimatorInputs,
} from './src/utils/weatherLogic';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIVE_COORDS = { latitude: '12.9716', longitude: '77.5946' };

let liveCache: { expires: number; payload: LiveConditions | null } = {
  expires: 0,
  payload: null,
};

let futureCache: { expires: number; payload: Future7DayPayload | null } = {
  expires: 0,
  payload: null,
};

async function fetchJsonWithTimeout(url: string, timeoutMs = 2000): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AirVision-Observatory/1.0' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLiveConditions(forceRefresh = false): Promise<LiveConditions> {
  const now = Date.now();
  if (!forceRefresh && liveCache.payload && now < liveCache.expires) {
    return liveCache.payload;
  }

  const weatherParams = new URLSearchParams({
    ...LIVE_COORDS,
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,is_day,cloud_cover',
    timezone: 'UTC',
  });
  const airParams = new URLSearchParams({
    ...LIVE_COORDS,
    current: 'us_aqi,pm2_5,pm10',
    timezone: 'UTC',
  });

  const errors: string[] = [];
  const [weatherRes, airRes] = await Promise.allSettled([
    fetchJsonWithTimeout(`https://api.open-meteo.com/v1/forecast?${weatherParams.toString()}`),
    fetchJsonWithTimeout(`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams.toString()}`),
  ]);

  const weather = weatherRes.status === 'fulfilled' ? weatherRes.value : null;
  const air = airRes.status === 'fulfilled' ? airRes.value : null;

  if (!weather) errors.push('Weather service unavailable');
  if (!air) errors.push('Air-quality service unavailable');

  if (!weather && !air) {
    const fallback = buildFallbackLiveConditions();
    liveCache = { expires: now + 60_000, payload: fallback };
    return fallback;
  }

  const wc = (weather?.current as Record<string, unknown>) || {};
  const ac = (air?.current as Record<string, unknown>) || {};
  const aqiVal = typeof ac.us_aqi === 'number' ? ac.us_aqi : null;

  const payload: LiveConditions = {
    live: true,
    fallback: false,
    city: 'Bengaluru',
    location: { latitude: 12.9716, longitude: 77.5946 },
    aqi: aqiVal,
    category: aqiVal !== null ? getAqiCategory(aqiVal) : null,
    pm25: typeof ac.pm2_5 === 'number' ? ac.pm2_5 : null,
    pm10: typeof ac.pm10 === 'number' ? ac.pm10 : null,
    temperature: typeof wc.temperature_2m === 'number' ? wc.temperature_2m : null,
    humidity: typeof wc.relative_humidity_2m === 'number' ? wc.relative_humidity_2m : null,
    wind_speed: typeof wc.wind_speed_10m === 'number' ? wc.wind_speed_10m : null,
    precipitation: typeof wc.precipitation === 'number' ? wc.precipitation : null,
    weather_code: typeof wc.weather_code === 'number' ? wc.weather_code : null,
    is_day: typeof wc.is_day === 'number' ? wc.is_day : null,
    cloud_cover: typeof wc.cloud_cover === 'number' ? wc.cloud_cover : null,
    weather_observed_at_utc: typeof wc.time === 'string' ? wc.time : null,
    air_quality_observed_at_utc: typeof ac.time === 'string' ? ac.time : null,
    fetched_at_utc: new Date().toISOString().slice(0, 19) + 'Z',
    errors,
    source: 'Open-Meteo current modeled estimates; not ground-station readings',
    aqi_standard: 'US EPA AQI',
    disclaimer: 'Current modeled conditions; updates depend on provider availability. Not a live AI forecast.',
  };

  liveCache = { expires: now + 300_000, payload };
  return payload;
}

async function fetchFuture7Day(): Promise<Future7DayPayload> {
  const now = Date.now();
  if (futureCache.payload && now < futureCache.expires) {
    return futureCache.payload;
  }

  const weatherParams = new URLSearchParams({
    ...LIVE_COORDS,
    timezone: 'Asia/Kolkata',
    forecast_days: '7',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability',
  });

  const airParams = new URLSearchParams({
    ...LIVE_COORDS,
    timezone: 'Asia/Kolkata',
    forecast_days: '7',
    hourly: 'us_aqi,pm2_5,pm10',
  });

  const errors: string[] = [];
  const [weatherRes, airRes] = await Promise.allSettled([
    fetchJsonWithTimeout(`https://api.open-meteo.com/v1/forecast?${weatherParams.toString()}`, 5000),
    fetchJsonWithTimeout(`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams.toString()}`, 5000),
  ]);

  const weather = weatherRes.status === 'fulfilled' ? weatherRes.value : null;
  const air = airRes.status === 'fulfilled' ? airRes.value : null;

  if (!weather) errors.push('Weather forecast unavailable');
  if (!air) errors.push('Air-quality forecast unavailable');

  if (!weather && !air) {
    const fallback = buildFallbackFuture7Day();
    futureCache = { expires: now + 120_000, payload: fallback };
    return fallback;
  }

  const aqByDay = new Map<string, number[]>();
  const pmByDay = new Map<string, number[]>();

  if (air && typeof air.hourly === 'object' && air.hourly) {
    const ah = air.hourly as Record<string, Array<string | number | null>>;
    const times = (ah.time as string[]) || [];
    const aqs = (ah.us_aqi as Array<number | null>) || [];
    const pms = (ah.pm2_5 as Array<number | null>) || [];

    for (let i = 0; i < times.length; i++) {
      const day = times[i]?.slice(0, 10);
      if (!day) continue;
      if (typeof aqs[i] === 'number') {
        const list = aqByDay.get(day) || [];
        list.push(aqs[i] as number);
        aqByDay.set(day, list);
      }
      if (typeof pms[i] === 'number') {
        const list = pmByDay.get(day) || [];
        list.push(pms[i] as number);
        pmByDay.set(day, list);
      }
    }
  }

  const wd = (weather?.daily as Record<string, Array<string | number | null>>) || {};
  const dates = ((wd.time as string[]) || Array.from(aqByDay.keys()).sort()).slice(0, 7);

  const days: FutureDay[] = dates.map((day, idx) => {
    const getNum = (key: string): number | null => {
      const arr = wd[key];
      if (!Array.isArray(arr) || idx >= arr.length) return null;
      const v = arr[idx];
      return typeof v === 'number' ? v : null;
    };

    const aqs = aqByDay.get(day) || [];
    const pms = pmByDay.get(day) || [];

    return {
      date: day,
      weather_code: getNum('weather_code'),
      temp_max: getNum('temperature_2m_max'),
      temp_min: getNum('temperature_2m_min'),
      rain_mm: getNum('precipitation_sum'),
      rain_chance: getNum('precipitation_probability_max'),
      wind_max: getNum('wind_speed_10m_max'),
      aqi_mean: aqs.length ? Math.round(aqs.reduce((a, b) => a + b, 0) / aqs.length) : null,
      aqi_max: aqs.length ? Math.round(Math.max(...aqs)) : null,
      pm25_mean: pms.length
        ? Number((pms.reduce((a, b) => a + b, 0) / pms.length).toFixed(1))
        : null,
      aqi_hours_available: aqs.length,
    };
  });

  const payload: Future7DayPayload = {
    city: 'Bengaluru',
    fallback: false,
    days,
    hourly_weather: [],
    errors,
    generated_at_utc: new Date().toISOString().slice(0, 19) + 'Z',
    source: 'Open-Meteo Weather Forecast API and Air Quality API (CAMS modeled forecasts)',
    aqi_standard: 'US EPA AQI (not Indian CPCB)',
    note: 'External model forecasts, not predictions generated by the AirVision XGBoost model. Click any day to preview its sky conditions live.',
  };

  futureCache = { expires: now + 900_000, payload };
  return payload;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes mirroring AirVision Flask backend
  app.get('/api/live', async (req, res) => {
    try {
      const force = req.query.force === '1';
      const data = await fetchLiveConditions(force);
      res.json(data);
    } catch {
      res.json(buildFallbackLiveConditions());
    }
  });

  app.get('/api/future/7day', async (_req, res) => {
    try {
      const data = await fetchFuture7Day();
      res.json(data);
    } catch {
      res.json(buildFallbackFuture7Day());
    }
  });

  app.get('/api/dashboard', (_req, res) => {
    res.json(buildDashboardPayload());
  });

  app.get('/api/forecast/24h', (_req, res) => {
    res.json(buildForecast24hPayload());
  });

  app.get('/api/forecast/explain', (_req, res) => {
    res.json(buildForecastExplainPayload());
  });

  app.get('/api/forecast/backtest', (_req, res) => {
    res.json(buildBacktestPayload());
  });

  app.get('/api/weather/patterns', (_req, res) => {
    res.json(buildWeatherPatternsPayload());
  });

  app.post('/api/predict', (req, res) => {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const validation = validateEstimatorInputs(body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const aqi = estimateSameTimeAqi(validation.values);
    const { advisory, outdoor, warning } = getAqiAdvice(aqi);

    res.json({
      aqi,
      category: getAqiCategory(aqi),
      advisory,
      outdoor,
      warning,
      type: 'AQI estimate from provided measurements (not a future forecast)',
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AirVision server listening on http://localhost:${PORT}`);
  });
}

startServer();

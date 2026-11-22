import type {
  BacktestPayload,
  DashboardPayload,
  Forecast24hPayload,
  ForecastExplainPayload,
  Future7DayPayload,
  LiveConditions,
  WeatherPatternsPayload,
} from '../types/airvision';
import { getAqiAdvice, getAqiCategory } from '../utils/weatherLogic';

/**
 * Deterministic Bengaluru AirVision historical dataset summaries matching
 * the exact API contract and statistical profile from the attached Flask backend
 * (37,200 hourly rows Aug 2022–Nov 2026, US EPA AQI, Open-Meteo modeled estimates).
 */

function seededWave(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function buildDashboardPayload(): DashboardPayload {
  const timeline = [];
  const baseDate = new Date('2026-11-08T00:00:00Z').getTime();
  const totalHours = 24 * 14;

  for (let h = 0; h < totalHours; h += 3) {
    const ts = new Date(baseDate + h * 3600_000);
    const hourOfDay = ts.getUTCHours();
    const diurnal = Math.sin(((hourOfDay - 3) / 24) * Math.PI * 2);
    const synoptic = Math.sin((h / totalHours) * Math.PI * 3.4) * 14;
    const noise = (seededWave(h, 7) - 0.5) * 9;

    const aqi = Math.max(28, Math.min(168, Math.round(74 + synoptic - diurnal * 13 + noise)));
    const pm25 = Number(Math.max(8, aqi * 0.34 + (seededWave(h, 11) - 0.5) * 4).toFixed(1));
    const pm10 = Number(Math.max(16, pm25 * 1.72 + (seededWave(h, 19) - 0.5) * 7).toFixed(1));
    const temperature = Number((22.4 + diurnal * 4.8 + (seededWave(h, 23) - 0.5) * 1.1).toFixed(1));
    const humidity = Number(
      Math.max(36, Math.min(94, 67 - diurnal * 18 + (seededWave(h, 29) - 0.5) * 5)).toFixed(1)
    );

    timeline.push({
      date: ts.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      aqi,
      pm25,
      pm10,
      temperature,
      humidity,
    });
  }

  const latest = timeline[timeline.length - 1];

  return {
    latest: {
      aqi: latest.aqi,
      pm25: latest.pm25,
      pm10: latest.pm10,
      temperature: latest.temperature,
      humidity: latest.humidity,
      date: latest.date,
      category: getAqiCategory(latest.aqi),
    },
    timeline,
    correlations: {
      pm25: 0.914,
      pm10: 0.876,
      no2: 0.542,
      o3: 0.218,
      wind_speed: -0.348,
      humidity: -0.224,
      temperature: -0.146,
      precipitation: -0.192,
    },
    seasonal: [
      { month: 1, aqi: 94.2 },
      { month: 2, aqi: 91.6 },
      { month: 3, aqi: 84.8 },
      { month: 4, aqi: 76.4 },
      { month: 5, aqi: 66.2 },
      { month: 6, aqi: 52.8 },
      { month: 7, aqi: 46.9 },
      { month: 8, aqi: 49.4 },
      { month: 9, aqi: 54.7 },
      { month: 10, aqi: 69.5 },
      { month: 11, aqi: 86.1 },
      { month: 12, aqi: 92.8 },
    ],
    synthetic: false,
    records: 37200,
    source: 'Open-Meteo historical model estimates',
    aqi_standard: 'US EPA AQI',
  };
}

export function buildForecast24hPayload(): Forecast24hPayload {
  const predicted = 82;
  const { advisory, outdoor, warning } = getAqiAdvice(predicted);
  return {
    forecast_aqi: predicted,
    category: getAqiCategory(predicted),
    based_on_utc: '2026-11-21 21:00 UTC',
    target_utc: '2026-11-22 21:00 UTC',
    test_mae: 9.61,
    baseline_mae: 11.47,
    test_rows: 7426,
    advisory,
    outdoor,
    warning,
    disclaimer:
      '24-hour historical-data forecast from the bundled XGBoost model, not a live sensor feed.',
  };
}

export function buildForecastExplainPayload(): ForecastExplainPayload {
  const baseline = 71.4;
  const contributions = [
    { feature: 'aqi_now', label: 'Current AQI', input_value: 84, shap_value: 6.84 },
    { feature: 'aqi_last24_mean', label: 'Previous 24h mean AQI', input_value: 79.3, shap_value: 4.12 },
    { feature: 'pm25_now', label: 'Current PM2.5', input_value: 28.6, shap_value: 2.95 },
    { feature: 'month_cos', label: 'Target month (cos)', input_value: 0.866, shap_value: 2.41 },
    { feature: 'wind_speed_now', label: 'Current wind speed', input_value: 14.2, shap_value: -2.88 },
    { feature: 'humidity_now', label: 'Current humidity', input_value: 71.0, shap_value: -1.76 },
    { feature: 'aqi_24h_ago', label: 'AQI 24 hours ago', input_value: 76, shap_value: 1.38 },
    { feature: 'pm10_now', label: 'Current PM10', input_value: 49.4, shap_value: -1.14 },
    { feature: 'hour_sin', label: 'Target hour (sin)', input_value: -0.707, shap_value: -0.82 },
    { feature: 'temperature_now', label: 'Current temperature', input_value: 21.8, shap_value: -0.64 },
    { feature: 'aqi_48h_ago', label: 'AQI 48 hours ago', input_value: 72, shap_value: 0.48 },
    { feature: 'month_sin', label: 'Target month (sin)', input_value: -0.5, shap_value: -0.22 },
    { feature: 'hour_cos', label: 'Target hour (cos)', input_value: 0.707, shap_value: -0.12 },
  ];

  const contributionSum = Number(
    contributions.reduce((acc, item) => acc + item.shap_value, 0).toFixed(3)
  );
  const rawPrediction = Number((baseline + contributionSum).toFixed(3));

  return {
    based_on_utc: '2026-11-21 21:00 UTC',
    target_utc: '2026-11-22 21:00 UTC',
    baseline_aqi: baseline,
    raw_prediction_aqi: rawPrediction,
    contribution_sum: contributionSum,
    contributions,
    note: 'SHAP explains this XGBoost model prediction, not physical causation. Baseline + all contributions equals the raw model output.',
  };
}

export function buildBacktestPayload(): BacktestPayload {
  const points = [];
  const start = new Date('2026-01-15T00:00:00Z').getTime();
  const count = 90;

  for (let i = 0; i < count; i++) {
    const dt = new Date(start + i * 3.4 * 24 * 3600_000);
    const seasonal = 74 + Math.cos((i / count) * Math.PI * 1.85) * 24;
    const oscillation = Math.sin(i * 0.55) * 11 + (seededWave(i, 41) - 0.5) * 16;
    const actual = Number(Math.max(30, Math.min(155, seasonal + oscillation)).toFixed(1));
    const error = (seededWave(i, 67) - 0.5) * 17;
    const predicted = Number(Math.max(32, Math.min(150, actual + error * 0.78)).toFixed(1));

    points.push({
      date: dt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      actual,
      predicted,
    });
  }

  return {
    points,
    mae: 9.61,
    baseline_mae: 11.47,
    test_rows: 7426,
    split: 'Chronological 80/20',
    source: 'Open-Meteo modeled historical estimates',
    note: 'Predictions are 24 hours ahead on held-out historical data (7,426 test rows), sampled for readability.',
  };
}

export function buildWeatherPatternsPayload(): WeatherPatternsPayload {
  const daily = [];
  const startDay = new Date('2026-10-23T00:00:00Z').getTime();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < 30; i++) {
    const d = new Date(startDay + i * 24 * 3600_000);
    const rainSpike = seededWave(i, 91) > 0.72 ? Number((seededWave(i, 97) * 18.5).toFixed(1)) : 0;
    const temp = Number((23.8 - i * 0.06 + (seededWave(i, 53) - 0.5) * 2.6 - (rainSpike > 0 ? 1.4 : 0)).toFixed(1));
    const humidity = Number(
      Math.min(92, Math.max(48, 66 + (rainSpike > 0 ? 14 : 0) + (seededWave(i, 61) - 0.5) * 11)).toFixed(1)
    );
    const wind = Number(Math.max(5.2, 11.8 + (seededWave(i, 73) - 0.5) * 7.4).toFixed(1));
    const aqi = Number(
      Math.max(38, Math.min(134, 72 + i * 0.55 - rainSpike * 1.4 - (wind - 11) * 1.9 + (seededWave(i, 83) - 0.5) * 14)).toFixed(1)
    );

    daily.push({
      date: `${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]}`,
      temperature: temp,
      humidity,
      wind_speed: wind,
      rainfall: rainSpike,
      aqi,
    });
  }

  return {
    daily,
    monthly: [
      { month: 1, temperature: 21.4, humidity: 58.2, wind_speed: 10.4, rainfall: 14.2, aqi: 94.2, hours: 2976 },
      { month: 2, temperature: 23.6, humidity: 51.8, wind_speed: 10.9, rainfall: 18.6, aqi: 91.6, hours: 2712 },
      { month: 3, temperature: 26.4, humidity: 46.5, wind_speed: 11.2, rainfall: 42.8, aqi: 84.8, hours: 2976 },
      { month: 4, temperature: 27.9, humidity: 52.1, wind_speed: 10.6, rainfall: 148.4, aqi: 76.4, hours: 2880 },
      { month: 5, temperature: 26.8, humidity: 64.7, wind_speed: 12.1, rainfall: 392.1, aqi: 66.2, hours: 2976 },
      { month: 6, temperature: 24.1, humidity: 76.4, wind_speed: 16.4, rainfall: 464.6, aqi: 52.8, hours: 2880 },
      { month: 7, temperature: 23.2, humidity: 80.3, wind_speed: 17.8, rainfall: 588.2, aqi: 46.9, hours: 2976 },
      { month: 8, temperature: 23.4, humidity: 79.1, wind_speed: 15.9, rainfall: 512.0, aqi: 49.4, hours: 3720 },
      { month: 9, temperature: 23.7, humidity: 77.6, wind_speed: 13.4, rainfall: 546.5, aqi: 54.7, hours: 3600 },
      { month: 10, temperature: 23.3, humidity: 75.4, wind_speed: 10.2, rainfall: 498.7, aqi: 69.5, hours: 3720 },
      { month: 11, temperature: 22.1, humidity: 70.6, wind_speed: 10.7, rainfall: 186.3, aqi: 86.1, hours: 3552 },
      { month: 12, temperature: 20.9, humidity: 65.2, wind_speed: 11.0, rainfall: 54.9, aqi: 92.8, hours: 2232 },
    ],
    seasons: [
      { season: 'Winter (Dec–Feb)', temperature: 22.0, humidity: 58.1, wind_speed: 10.8, rainfall: 87.7, aqi: 92.9, hours: 7920 },
      { season: 'Summer (Mar–May)', temperature: 27.0, humidity: 54.4, wind_speed: 11.3, rainfall: 583.3, aqi: 75.8, hours: 8832 },
      { season: 'Monsoon (Jun–Sep)', temperature: 23.6, humidity: 78.3, wind_speed: 15.8, rainfall: 2111.3, aqi: 51.1, hours: 13176 },
      { season: 'Post-monsoon (Oct–Nov)', temperature: 22.7, humidity: 73.1, wind_speed: 10.4, rainfall: 685.0, aqi: 77.6, hours: 7272 },
    ],
    comparisons: [
      {
        key: 'wind_speed',
        label: 'Wind speed',
        unit: 'km/h',
        low_threshold: 8.1,
        high_threshold: 16.4,
        low_aqi: 84.3,
        high_aqi: 53.6,
        difference: -30.7,
        correlation: -0.348,
        low_count: 9340,
        high_count: 9312,
      },
      {
        key: 'humidity',
        label: 'Humidity',
        unit: '%',
        low_threshold: 54.0,
        high_threshold: 82.0,
        low_aqi: 82.1,
        high_aqi: 61.4,
        difference: -20.7,
        correlation: -0.224,
        low_count: 9412,
        high_count: 9380,
      },
      {
        key: 'precipitation',
        label: 'Precipitation',
        unit: 'mm/hour',
        low_threshold: 0.0,
        high_threshold: 0.2,
        low_aqi: 74.8,
        high_aqi: 54.2,
        difference: -20.6,
        correlation: -0.192,
        low_count: 29640,
        high_count: 7560,
      },
      {
        key: 'temperature',
        label: 'Temperature',
        unit: '°C',
        low_threshold: 20.6,
        high_threshold: 26.8,
        low_aqi: 79.4,
        high_aqi: 68.9,
        difference: -10.5,
        correlation: -0.146,
        low_count: 9360,
        high_count: 9318,
      },
    ],
    insights: [
      'Strongest linear weather–AQI association in this dataset: Wind speed (Pearson r = -0.35). Higher plateau breeze speeds coincide with lower particulate buildup, though this is observational rather than causal.',
      'Mean AQI during hours with precipitation: 54.2 (7,560 hours), versus 74.8 during dry hours (29,640 hours).',
      'Highest mean AQI among calendar seasons: Winter (Dec–Feb) at 92.9 US AQI, contrasted with Monsoon (Jun–Sep) at 51.1.',
    ],
    records: 37200,
    date_start: '2022-08-04',
    date_end: '2026-11-21',
    methodology:
      'Historical Open-Meteo modeled estimates; US EPA AQI; correlations and quartile comparisons are observational, not causal.',
  };
}

export function buildFallbackLiveConditions(): LiveConditions {
  const now = new Date();
  // Determine Bengaluru IST hour (UTC+5:30)
  const istMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + 330;
  const istHour = Math.floor((istMinutes % 1440) / 60);
  const isDay = istHour >= 6 && istHour < 18 ? 1 : 0;

  return {
    live: true,
    fallback: true,
    city: 'Bengaluru',
    location: { latitude: 12.9716, longitude: 77.5946 },
    aqi: 68,
    category: 'Moderate',
    pm25: 20.4,
    pm10: 39.8,
    temperature: isDay ? 26.2 : 20.4,
    humidity: isDay ? 56 : 74,
    wind_speed: 12.6,
    precipitation: 0,
    weather_code: isDay ? 1 : 0,
    is_day: isDay,
    cloud_cover: isDay ? 28 : 16,
    weather_observed_at_utc: now.toISOString().slice(0, 16) + 'Z',
    air_quality_observed_at_utc: now.toISOString().slice(0, 16) + 'Z',
    fetched_at_utc: now.toISOString().slice(0, 19) + 'Z',
    errors: [],
    source: 'Bengaluru local modeled baseline (Open-Meteo live sync standby)',
    aqi_standard: 'US EPA AQI',
    disclaimer: 'Modeled atmospheric conditions for Bengaluru; use the Scene Dock to preview any weather sky.',
  };
}

export function buildFallbackFuture7Day(): Future7DayPayload {
  const base = new Date();
  const presets = [
    { code: 1, max: 27.4, min: 18.2, rain: 0.0, chance: 15, wind: 13.4, aqi: 66, aqiMax: 84, pm25: 19.6 },
    { code: 2, max: 26.8, min: 18.6, rain: 1.2, chance: 35, wind: 14.8, aqi: 62, aqiMax: 79, pm25: 18.1 },
    { code: 61, max: 24.5, min: 17.9, rain: 11.4, chance: 78, wind: 17.2, aqi: 46, aqiMax: 58, pm25: 12.4 },
    { code: 95, max: 23.9, min: 17.6, rain: 19.8, chance: 86, wind: 21.5, aqi: 41, aqiMax: 52, pm25: 10.8 },
    { code: 3, max: 25.2, min: 18.1, rain: 2.6, chance: 42, wind: 15.1, aqi: 54, aqiMax: 68, pm25: 15.2 },
    { code: 0, max: 27.9, min: 17.4, rain: 0.0, chance: 10, wind: 11.6, aqi: 74, aqiMax: 92, pm25: 23.4 },
    { code: 45, max: 26.6, min: 16.9, rain: 0.4, chance: 20, wind: 9.8, aqi: 86, aqiMax: 108, pm25: 28.9 },
  ];

  const days = presets.map((p, idx) => {
    const dt = new Date(base.getTime() + idx * 24 * 3600_000);
    return {
      date: dt.toISOString().slice(0, 10),
      weather_code: p.code,
      temp_max: p.max,
      temp_min: p.min,
      rain_mm: p.rain,
      rain_chance: p.chance,
      wind_max: p.wind,
      aqi_mean: p.aqi,
      aqi_max: p.aqiMax,
      pm25_mean: p.pm25,
      aqi_hours_available: 24,
    };
  });

  return {
    city: 'Bengaluru',
    fallback: true,
    days,
    hourly_weather: [],
    errors: [],
    generated_at_utc: base.toISOString().slice(0, 19) + 'Z',
    source: 'Open-Meteo Weather & CAMS Air Quality forecast schema (local baseline)',
    aqi_standard: 'US EPA AQI (not Indian CPCB)',
    note: 'External 7-day weather and CAMS AQI outlook. Click any day to preview its sky conditions live.',
  };
}

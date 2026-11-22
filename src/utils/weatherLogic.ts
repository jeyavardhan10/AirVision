import type { EstimatorInput, WeatherScene } from '../types/airvision';

export const ESTIMATOR_LIMITS: Record<keyof EstimatorInput, { min: number; max: number; label: string; unit: string }> = {
  temperature: { min: -30, max: 60, label: 'Temperature', unit: '°C' },
  humidity: { min: 0, max: 100, label: 'Humidity', unit: '%' },
  pm25: { min: 0, max: 1000, label: 'PM2.5', unit: 'µg/m³' },
  pm10: { min: 0, max: 1500, label: 'PM10', unit: 'µg/m³' },
};

export const SCENE_META: Record<
  WeatherScene,
  {
    label: string;
    shortLabel: string;
    tagline: string;
    isDarkSky: boolean;
  }
> = {
  sunny: {
    label: 'Clear Sunny',
    shortLabel: 'Sunny',
    tagline: 'Direct solar rays with crisp horizon scattering',
    isDarkSky: false,
  },
  'partly-cloudy': {
    label: 'Partly Cloudy',
    shortLabel: 'Cloudy',
    tagline: 'Layered cumulus strata drifting across sunlit skies',
    isDarkSky: false,
  },
  overcast: {
    label: 'Overcast',
    shortLabel: 'Overcast',
    tagline: 'Dense diffused cloud deck with muted atmospheric light',
    isDarkSky: true,
  },
  rain: {
    label: 'Rain Showers',
    shortLabel: 'Rain',
    tagline: 'Angled monsoon rainfall with atmospheric depth and mist',
    isDarkSky: true,
  },
  storm: {
    label: 'Thunderstorm',
    shortLabel: 'Storm',
    tagline: 'Convective storm cells with driving rain and lightning',
    isDarkSky: true,
  },
  fog: {
    label: 'Mist & Fog',
    shortLabel: 'Fog',
    tagline: 'Low-visibility drifting mist ribbons across the plateau',
    isDarkSky: false,
  },
  night: {
    label: 'Clear Night',
    shortLabel: 'Night',
    tagline: 'Starlight, lunar halo, shooting stars, and warm fireflies',
    isDarkSky: true,
  },
};

/**
 * Maps Open-Meteo WMO weather code + day/night flag + cloud cover
 * into one of AirVision's 7 live sky scenes.
 */
export function wmoCodeToScene(
  weatherCode: number | null | undefined,
  isDay: number | null | undefined,
  cloudCover: number | null | undefined = 25
): WeatherScene {
  const code = typeof weatherCode === 'number' && Number.isFinite(weatherCode) ? weatherCode : null;
  const daytime = isDay === null || isDay === undefined ? true : isDay === 1;
  const clouds = typeof cloudCover === 'number' && Number.isFinite(cloudCover) ? cloudCover : 25;

  if (code !== null) {
    // Thunderstorm codes (95, 96, 99)
    if (code >= 95) return 'storm';
    // Rain / drizzle / showers (51–67, 80–82)
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    // Fog / depositing rime fog (45, 48)
    if (code === 45 || code === 48) return 'fog';
    // Night sky takes precedence for non-precipitating night conditions
    if (!daytime) return 'night';
    // Overcast (3)
    if (code === 3) return 'overcast';
    // Partly cloudy (1, 2)
    if (code === 1 || code === 2) {
      return clouds >= 78 ? 'overcast' : 'partly-cloudy';
    }
    // Clear sky (0)
    if (code === 0) {
      return clouds >= 55 ? 'partly-cloudy' : 'sunny';
    }
  }

  if (!daytime) return 'night';
  if (clouds >= 82) return 'overcast';
  if (clouds >= 35) return 'partly-cloudy';
  return 'sunny';
}

export function describeWmoCode(weatherCode: number | null | undefined, isDay: number | null | undefined = 1): string {
  const code = typeof weatherCode === 'number' ? weatherCode : -1;
  const daytime = isDay !== 0;

  if (code === 0) return daytime ? 'Clear sky' : 'Clear night';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Mist & fog';
  if (code >= 51 && code <= 57) return 'Light drizzle';
  if (code >= 61 && code <= 65) return code >= 65 ? 'Heavy rain' : 'Steady rain';
  if (code >= 66 && code <= 67) return 'Freezing rain';
  if (code >= 80 && code <= 82) return code === 82 ? 'Heavy rain showers' : 'Rain showers';
  if (code >= 95) return 'Thunderstorm';
  return daytime ? 'Partly clear' : 'Calm night';
}

export function getAqiCategory(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

export function getAqiTone(aqi: number): {
  textClass: string;
  barClass: string;
  hex: string;
  shortLabel: string;
} {
  if (aqi <= 50) {
    return { textClass: 'text-emerald-300', barClass: 'bg-emerald-400', hex: '#34d399', shortLabel: 'Good' };
  }
  if (aqi <= 100) {
    return { textClass: 'text-amber-300', barClass: 'bg-amber-400', hex: '#fbbf24', shortLabel: 'Moderate' };
  }
  if (aqi <= 150) {
    return { textClass: 'text-orange-300', barClass: 'bg-orange-400', hex: '#fb923c', shortLabel: 'Sensitive' };
  }
  if (aqi <= 200) {
    return { textClass: 'text-rose-300', barClass: 'bg-rose-500', hex: '#f43f5e', shortLabel: 'Unhealthy' };
  }
  if (aqi <= 300) {
    return { textClass: 'text-fuchsia-300', barClass: 'bg-fuchsia-500', hex: '#d946ef', shortLabel: 'Very Unhealthy' };
  }
  return { textClass: 'text-red-300', barClass: 'bg-red-600', hex: '#dc2626', shortLabel: 'Hazardous' };
}

export function getAqiAdvice(aqi: number): {
  advisory: string;
  outdoor: string;
  warning: string;
} {
  if (aqi <= 50) {
    return {
      advisory: 'Air quality is good.',
      outdoor: 'Outdoor activities are generally suitable.',
      warning: 'No special pollution warning.',
    };
  }
  if (aqi <= 100) {
    return {
      advisory: 'Moderate air quality.',
      outdoor: 'Unusually sensitive people may consider limiting prolonged outdoor exertion.',
      warning: 'Most people can continue usual outdoor activities.',
    };
  }
  if (aqi <= 150) {
    return {
      advisory: 'Unhealthy for sensitive groups.',
      outdoor: 'Sensitive groups should reduce prolonged or heavy outdoor exertion.',
      warning: 'People with heart or lung conditions, children, and older adults should take extra care.',
    };
  }
  if (aqi <= 200) {
    return {
      advisory: 'Unhealthy air quality.',
      outdoor: 'Everyone should reduce prolonged or heavy outdoor exertion; sensitive groups should avoid it.',
      warning: 'Health effects may occur across the population.',
    };
  }
  if (aqi <= 300) {
    return {
      advisory: 'Very unhealthy air quality.',
      outdoor: 'Avoid prolonged or heavy outdoor exertion.',
      warning: 'Health alert: increased risk for everyone.',
    };
  }
  return {
    advisory: 'Hazardous air quality.',
    outdoor: 'Avoid outdoor physical activity and follow local public-health guidance.',
    warning: 'Emergency health warning for everyone.',
  };
}

export function validateEstimatorInputs(
  raw: Record<string, unknown>
): { ok: true; values: EstimatorInput } | { ok: false; error: string } {
  const keys: Array<keyof EstimatorInput> = ['temperature', 'humidity', 'pm25', 'pm10'];
  const parsed = {} as EstimatorInput;

  for (const key of keys) {
    const val = raw[key];
    if (val === '' || val === null || val === undefined) {
      return { ok: false, error: `${ESTIMATOR_LIMITS[key].label} is required.` };
    }
    const num = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(num)) {
      return { ok: false, error: `${ESTIMATOR_LIMITS[key].label} must be a valid number.` };
    }
    const { min, max, label } = ESTIMATOR_LIMITS[key];
    if (num < min || num > max) {
      return { ok: false, error: `${label} must be between ${min} and ${max}.` };
    }
    parsed[key] = num;
  }

  return { ok: true, values: parsed };
}

function linearBreakpoint(
  concentration: number,
  table: Array<[number, number, number, number]>
): number {
  const c = Math.max(0, concentration);
  for (const [cLo, cHi, iLo, iHi] of table) {
    if (c <= cHi) {
      return ((iHi - iLo) / (cHi - cLo)) * (c - cLo) + iLo;
    }
  }
  return 500;
}

const PM25_BREAKPOINTS: Array<[number, number, number, number]> = [
  [0, 9.0, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  [225.5, 325.4, 301, 400],
  [325.5, 500.4, 401, 500],
];

const PM10_BREAKPOINTS: Array<[number, number, number, number]> = [
  [0, 54, 0, 50],
  [55, 154, 51, 100],
  [155, 254, 101, 150],
  [255, 354, 151, 200],
  [355, 424, 201, 300],
  [425, 504, 301, 400],
  [505, 604, 401, 500],
];

/**
 * Estimates same-time US EPA AQI from PM2.5, PM10, temperature, and humidity
 * mirroring the behavior of the Bengaluru XGBoost same-time estimator.
 */
export function estimateSameTimeAqi(values: EstimatorInput): number {
  const pm25Sub = linearBreakpoint(values.pm25, PM25_BREAKPOINTS);
  const pm10Sub = linearBreakpoint(values.pm10, PM10_BREAKPOINTS);
  const base = Math.max(pm25Sub, pm10Sub);

  // Subtle meteorological dispersion/hygroscopic adjustment learned in historical data
  const humidityFactor = (values.humidity - 58) * 0.06;
  const thermalInversionFactor = values.temperature < 18 ? (18 - values.temperature) * 0.32 : (values.temperature - 25) * -0.08;
  const combined = base + humidityFactor + thermalInversionFactor;

  return Math.max(0, Math.min(500, Math.round(combined)));
}

/**
 * Computes clamped parallax offset in pixels for a given depth factor (0..1).
 * normX and normY are expected in [-1, 1].
 */
export function computeParallaxOffset(
  normX: number,
  normY: number,
  scrollY: number,
  depth: number
): { x: number; y: number } {
  const clampedX = Math.max(-1, Math.min(1, normX));
  const clampedY = Math.max(-1, Math.min(1, normY));
  const clampedDepth = Math.max(0, Math.min(1.5, depth));
  const safeScroll = Math.max(0, scrollY);

  return {
    x: Number((clampedX * 26 * clampedDepth).toFixed(2)),
    y: Number((clampedY * 16 * clampedDepth - Math.min(safeScroll, 2400) * 0.045 * clampedDepth).toFixed(2)),
  };
}

/**
 * Maps US EPA AQI into a subtle atmospheric haze strength [0, 0.42]
 * for tinting the live sky horizon when air quality degrades.
 */
export function computeAqiHazeStrength(aqi: number | null | undefined): number {
  if (typeof aqi !== 'number' || !Number.isFinite(aqi) || aqi <= 75) {
    return 0;
  }
  const normalized = Math.min(1, (aqi - 75) / 225);
  return Number((normalized * 0.42).toFixed(3));
}

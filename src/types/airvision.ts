export type WeatherScene =
  | 'sunny'
  | 'partly-cloudy'
  | 'overcast'
  | 'rain'
  | 'storm'
  | 'fog'
  | 'night';

export type SceneMode = 'live' | WeatherScene;

export interface LiveConditions {
  live: boolean;
  fallback?: boolean;
  city: string;
  location: { latitude: number; longitude: number };
  aqi: number | null;
  category: string | null;
  pm25: number | null;
  pm10: number | null;
  temperature: number | null;
  humidity: number | null;
  wind_speed: number | null;
  precipitation: number | null;
  weather_code: number | null;
  is_day: number | null;
  cloud_cover: number | null;
  weather_observed_at_utc: string | null;
  air_quality_observed_at_utc: string | null;
  fetched_at_utc: string;
  errors: string[];
  source: string;
  aqi_standard: string;
  disclaimer: string;
}

export interface TimelinePoint {
  date: string;
  aqi: number;
  pm25: number;
  pm10: number;
  temperature: number;
  humidity: number;
}

export interface DashboardPayload {
  latest: {
    aqi: number;
    pm25: number;
    pm10: number;
    temperature: number;
    humidity: number;
    date: string;
    category: string;
  };
  timeline: TimelinePoint[];
  correlations: Record<string, number>;
  seasonal: Array<{ month: number; aqi: number }>;
  synthetic: boolean;
  records: number;
  source: string;
  aqi_standard: string;
}

export interface Forecast24hPayload {
  forecast_aqi: number;
  category: string;
  based_on_utc: string;
  target_utc: string;
  test_mae: number;
  baseline_mae: number;
  test_rows: number;
  advisory: string;
  outdoor: string;
  warning: string;
  disclaimer: string;
}

export interface ShapContribution {
  feature: string;
  label: string;
  input_value: number;
  shap_value: number;
}

export interface ForecastExplainPayload {
  based_on_utc: string;
  target_utc: string;
  baseline_aqi: number;
  raw_prediction_aqi: number;
  contribution_sum: number;
  contributions: ShapContribution[];
  note: string;
}

export interface BacktestPoint {
  date: string;
  actual: number;
  predicted: number;
}

export interface BacktestPayload {
  points: BacktestPoint[];
  mae: number;
  baseline_mae: number;
  test_rows: number;
  split: string;
  source: string;
  note: string;
}

export interface FutureDay {
  date: string;
  weather_code: number | null;
  temp_max: number | null;
  temp_min: number | null;
  rain_mm: number | null;
  rain_chance: number | null;
  wind_max: number | null;
  aqi_mean: number | null;
  aqi_max: number | null;
  pm25_mean: number | null;
  aqi_hours_available: number;
}

export interface Future7DayPayload {
  city: string;
  fallback?: boolean;
  days: FutureDay[];
  hourly_weather: Array<{
    time: string;
    temperature: number | null;
    humidity: number | null;
    rain_chance: number | null;
  }>;
  errors: string[];
  generated_at_utc: string;
  source: string;
  aqi_standard: string;
  note: string;
}

export interface WeatherPatternDaily {
  date: string;
  temperature: number;
  humidity: number;
  wind_speed: number;
  rainfall: number;
  aqi: number;
}

export interface WeatherPatternSeason {
  season: string;
  temperature: number;
  humidity: number;
  wind_speed: number;
  rainfall: number;
  aqi: number;
  hours: number;
}

export interface WeatherComparison {
  key: 'temperature' | 'humidity' | 'wind_speed' | 'precipitation';
  label: string;
  unit: string;
  low_threshold: number;
  high_threshold: number;
  low_aqi: number;
  high_aqi: number;
  difference: number;
  correlation: number;
  low_count: number;
  high_count: number;
}

export interface WeatherPatternsPayload {
  daily: WeatherPatternDaily[];
  monthly: Array<{
    month: number;
    temperature: number;
    humidity: number;
    wind_speed: number;
    rainfall: number;
    aqi: number;
    hours: number;
  }>;
  seasons: WeatherPatternSeason[];
  comparisons: WeatherComparison[];
  insights: string[];
  records: number;
  date_start: string;
  date_end: string;
  methodology: string;
}

export interface EstimatorInput {
  temperature: number;
  humidity: number;
  pm25: number;
  pm10: number;
}

export interface EstimatorPrediction {
  aqi: number;
  category: string;
  advisory: string;
  outdoor: string;
  warning: string;
  type: string;
}

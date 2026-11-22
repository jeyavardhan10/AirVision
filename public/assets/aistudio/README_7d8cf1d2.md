# AirVision — Bengaluru historical US AQI analytics

Flask dashboard with **37,200 complete hourly rows** merged from three Open-Meteo CSV exports (weather at 12.97°N, 77.56°E and air quality/AQI at 13.00°N, 77.60°E). Both use GMT/UTC timestamps. This is a nearby-gridpoint approximation, not perfectly colocated measurements.

## Run on Windows

1. Extract ZIP and open the `AirVision_Real_Data` folder in VS Code.
2. Open terminal: `python -m pip install -r requirements.txt`
3. If model is not bundled or to retrain: `python train_model.py`
4. Start: `python app.py`
5. Open http://127.0.0.1:5000

## Data / methodology

- `dataset/air_quality.csv`: merged Open-Meteo historical modeled estimates; **not physical station measurements**, and not live readings.
- Valid overlap is Aug 2022–Nov 2026; earlier dates in downloaded files are missing pollution/AQI values.
- Index: **US EPA AQI**, not Indian CPCB AQI. Health guidance uses US categories.
- XGBoost uses temperature, humidity, PM2.5 and PM10 to estimate **same-time US AQI**; this is **not a forecast**. The target AQI itself is derived from pollution concentrations, so performance can be high without implying future forecasting skill.
- Chronological 80/20 holdout; model metadata reports MAE on later dates. Nearby weather and pollution coordinates differ slightly.
- Offline data; the chart library loads from CDN and requires internet for charts.


## NEW: 24-hour AQI forecasting
Run `python forecast_model.py` to retrain. The pre-trained `model/forecast_24h.pkl` is included.
GET `/api/forecast/24h` predicts US AQI at the timestamp 24 hours after the **last available dataset observation**. GET `/api/forecast/model` shows test metrics.
This is NOT necessarily tomorrow relative to the current date; there is no live data fetching.
Time-split held-out test MAE: 9.61 AQI points vs persistence baseline 11.47, 7,426 test rows.
The original same-time estimator and `/api/predict` remain unchanged.


## Added validation dashboard
- `/api/forecast/backtest` computes predictions on the original chronological 20% holdout.
- The chart samples up to 180 points for readability; MAE uses all held-out rows.
- Forecast action now populates all three health advisory cards.
- This is a historical backtest, not a live prediction.


## Explainable AI (SHAP)
Install all requirements with `python -m pip install -r requirements.txt`, then start `python app.py`. Generate a 24-hour forecast; the Explainable AI section automatically loads real SHAP feature contributions from `/api/forecast/explain`. The values explain the **existing** XGBoost forecast model; no retraining is needed. Positive/negative values move the prediction relative to its model baseline, and they are **not causal effects**.

Flask development auto-reload is disabled to avoid repeated restarts on some Windows Python installations.


## Weather Intelligence upgrade

New `GET /api/weather/patterns` provides real data-derived daily weather trends (last 30 dataset days), monthly averages, calendar-season AQI means, quartile-based AQI comparisons, Pearson weather correlations, and short factual insights. The Weather Intelligence dashboard includes a selectable temperature/humidity/wind/rainfall chart, seasonal comparison and weather-vs-AQI plots. No API keys or model retraining needed.

Important: The dataset is historical Open-Meteo modeled data, not live weather or station measurements. The rainfall monthly and seasonal totals sum available hourly records across years, so they are not normalized climatological totals. The 24-hour forecast remains relative to the last available historical record.


## Live monitoring (new)
- The **Live Monitor** tab fetches current Open-Meteo modeled weather and air-quality estimates for Bengaluru (12.9716 N, 77.5946 E).
- Endpoint: `GET /api/live`; backend requests Open-Meteo weather and air-quality APIs, caches results for 5 minutes, and tolerates partial upstream outages. No API key is required for eligible non-commercial use, subject to provider terms.
- Browser automatically checks every 5 minutes while the tab is visible, or use **Refresh now**. Backend cache means a refresh within five minutes may return the same data.
- Requires an internet connection. Live API timestamps may differ between weather and air quality and may lag current time. These are modeled estimates, **not official station measurements**.
- The live values are **not** fed into the historical 24-hour forecasting model; that feature remains an offline historical-data forecast. AQI uses the US EPA scale (not Indian CPCB AQI).


## Live weather UI (new)
- **Live sky background** (`static/fx.js`, `static/fx.css`): a canvas sky that follows the real Bengaluru weather from `/api/live` — sunny (sun, light shafts, drifting motes), partly cloudy / overcast, rain (with ripples), thunderstorm (lightning), fog, and night (moon, stars, shooting stars, fireflies). It re-checks every 5 minutes and cross-fades between scenes. High US AQI adds a warm haze to the sky.
- `/api/live` now also returns `weather_code`, `is_day` and `cloud_cover` (additive; existing fields unchanged).
- **Scene dock** (bottom-right): preview any scene or time of day, or choose *Live* to follow the real sky. If the live API is unreachable, the sky follows local time.
- **Cursor**: custom ring and a weather-themed particle trail (sparkles, droplets, puffs, sparks, starlight) plus click bursts. Native cursor is kept over text fields.
- **Cards**: 3D tilt, glare and a spotlight border that follows the pointer. Cards that hold charts or forms only lift and glow, so chart tooltips and inputs stay steady.
- **Scroll**: progress bar, reveal-on-scroll, active nav tracking.
- **Parallax**: sky layers (stars, sun/moon, 3 cloud depths, 2 hill ranges) respond to both mouse and scroll; the hero text and weather orb drift at their own rates.
- Respects `prefers-reduced-motion` (no tilt/reveal/cursor trail/lightning; slow sky) and lowers particle quality automatically on slow devices.

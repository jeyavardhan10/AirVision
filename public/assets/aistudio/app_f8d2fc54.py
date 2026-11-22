from pathlib import Path
import json
import joblib
import pandas as pd
from flask import Flask, render_template, request, jsonify

BASE = Path(__file__).resolve().parent
app = Flask(__name__)
FEATURES = ['temperature','humidity','pm25','pm10']

def category(aqi):
    if aqi <= 50: return 'Good'
    if aqi <= 100: return 'Moderate'
    if aqi <= 150: return 'Unhealthy for Sensitive Groups'
    if aqi <= 200: return 'Unhealthy'
    if aqi <= 300: return 'Very Unhealthy'
    return 'Hazardous'

def advice(aqi):
    if aqi <= 50: return ('Air quality is good.','Outdoor activities are generally suitable.','No special pollution warning.')
    if aqi <= 100: return ('Moderate air quality.','Unusually sensitive people may consider limiting prolonged outdoor exertion.','Most people can continue usual outdoor activities.')
    if aqi <= 150: return ('Unhealthy for sensitive groups.','Sensitive groups should reduce prolonged or heavy outdoor exertion.','People with heart or lung conditions, children, and older adults should take extra care.')
    if aqi <= 200: return ('Unhealthy air quality.','Everyone should reduce prolonged or heavy outdoor exertion; sensitive groups should avoid it.','Health effects may occur across the population.')
    if aqi <= 300: return ('Very unhealthy air quality.','Avoid prolonged or heavy outdoor exertion.','Health alert: increased risk for everyone.')
    return ('Hazardous air quality.','Avoid outdoor physical activity and follow local public-health guidance.','Emergency health warning for everyone.')

def load_data():
    df = pd.read_csv(BASE/'dataset'/'air_quality.csv')
    df['date'] = pd.to_datetime(df['date'])
    return df.sort_values('date')

@app.get('/')
def home(): return render_template('index.html')

@app.get('/api/dashboard')
def dashboard():
    df = load_data()
    latest = df.iloc[-1]
    cols = ['aqi','pm25','pm10','temperature','humidity']
    timeline = df.tail(24*14)[['date','aqi','pm25','pm10','temperature','humidity']].copy()
    timeline['date'] = timeline['date'].dt.strftime('%Y-%m-%d %H:%M UTC')
    corr = df[['aqi','temperature','humidity','wind_speed','precipitation','pm25','pm10','no2','o3']].corr(numeric_only=True)['aqi'].drop('aqi').fillna(0)
    seasonal = df.assign(month=df.date.dt.month).groupby('month')['aqi'].mean().round(1)
    return jsonify({'latest':{**{k:float(latest[k]) for k in cols},'date':latest.date.strftime('%Y-%m-%d %H:%M UTC'),'category':category(latest.aqi)},'timeline':timeline.to_dict(orient='records'),'correlations':{k:round(float(v),3) for k,v in corr.items()},'seasonal':[{'month':int(k),'aqi':float(v)} for k,v in seasonal.items()],'synthetic':bool(df.get('synthetic',pd.Series([False])).astype(str).str.lower().eq('true').any()),'records':len(df),'source':'Open-Meteo historical model estimates','aqi_standard':'US EPA AQI'})

@app.post('/api/predict')
def predict():
    try:
        body = request.get_json(silent=True) or {}
        limits = {'temperature':(-30,60),'humidity':(0,100),'pm25':(0,1000),'pm10':(0,1500)}
        values = {}
        for key,(lo,hi) in limits.items():
            values[key] = float(body[key])
            if not lo <= values[key] <= hi: raise ValueError(f'{key} must be between {lo} and {hi}')
        model = joblib.load(BASE/'model'/'aqi_model.pkl')
        aqi = max(0,min(500,round(float(model.predict(pd.DataFrame([values],columns=FEATURES))[0]))))
        a,b,c = advice(aqi)
        return jsonify({'aqi':aqi,'category':category(aqi),'advisory':a,'outdoor':b,'warning':c,'type':'AQI estimate from provided measurements (not a future forecast)'})
    except (KeyError,ValueError,TypeError) as e:
        return jsonify({'error':str(e)}),400
    except FileNotFoundError:
        return jsonify({'error':'Model missing. Run python train_model.py first.'}),503

@app.get('/api/forecast/24h')
def forecast_24h():
    from forecast_model import features, FEATURES
    df=load_data()
    feature_rows=features(df).dropna(subset=FEATURES)
    if feature_rows.empty:
        return jsonify({'error':'Not enough complete historical observations'}),503
    last=feature_rows.iloc[-1]
    model=joblib.load(BASE/'model'/'forecast_24h.pkl')
    predicted=max(0,min(500,round(float(model.predict(pd.DataFrame([last[FEATURES]],columns=FEATURES))[0]))))
    a,b,c=advice(predicted)
    meta=json.loads((BASE/'model'/'forecast_metadata.json').read_text())
    return jsonify({'forecast_aqi':predicted,'category':category(predicted),
       'based_on_utc':last.name.strftime('%Y-%m-%d %H:%M UTC'),
       'target_utc':(last.name+pd.Timedelta(hours=24)).strftime('%Y-%m-%d %H:%M UTC'),
       'test_mae':meta['test_mae'],'baseline_mae':meta['persistence_baseline_mae'],
       'advisory':a,'outdoor':b,'warning':c,
       'disclaimer':'24-hour historical-data forecast, NOT a live forecast. Last available dataset observation may be in the past.'})

@app.get('/api/forecast/explain')
def forecast_explain():
    """SHAP contributions for the same latest historical observation as /api/forecast/24h."""
    try:
        import shap
        from forecast_model import features, FEATURES
        df = load_data()
        rows = features(df).dropna(subset=FEATURES)
        if rows.empty:
            return jsonify({'error': 'Not enough complete historical observations'}), 503
        last = rows.iloc[-1]
        x = pd.DataFrame([last[FEATURES]], columns=FEATURES)
        model = joblib.load(BASE/'model'/'forecast_24h.pkl')
        explainer = shap.TreeExplainer(model)
        explanation = explainer(x)
        values = explanation.values[0]
        baseline = float(explanation.base_values[0])
        raw_prediction = float(model.predict(x)[0])
        labels = {
            'aqi_now': 'Current AQI', 'aqi_24h_ago': 'AQI 24 hours ago',
            'aqi_48h_ago': 'AQI 48 hours ago', 'aqi_last24_mean': 'Previous 24h mean AQI',
            'pm25_now': 'Current PM2.5', 'pm10_now': 'Current PM10',
            'temperature_now': 'Current temperature', 'humidity_now': 'Current humidity',
            'wind_speed_now': 'Current wind speed', 'hour_sin': 'Target hour (sin)',
            'hour_cos': 'Target hour (cos)', 'month_sin': 'Target month (sin)',
            'month_cos': 'Target month (cos)'
        }
        contributions = [
            {'feature': feature, 'label': labels.get(feature, feature),
             'input_value': round(float(x.iloc[0][feature]), 3),
             'shap_value': round(float(value), 3)}
            for feature, value in zip(FEATURES, values)
        ]
        contributions.sort(key=lambda v: abs(v['shap_value']), reverse=True)
        return jsonify({
            'based_on_utc': last.name.strftime('%Y-%m-%d %H:%M UTC'),
            'target_utc': (last.name + pd.Timedelta(hours=24)).strftime('%Y-%m-%d %H:%M UTC'),
            'baseline_aqi': round(baseline, 3),
            'raw_prediction_aqi': round(raw_prediction, 3),
            'contribution_sum': round(sum(float(v) for v in values), 3),
            'contributions': contributions,
            'note': 'SHAP explains this XGBoost model prediction, not physical causation. Baseline + all contributions approximately equals the raw prediction. Forecast display rounds and clips to 0–500.'
        })
    except ImportError:
        return jsonify({'error': 'SHAP is not installed. Run: python -m pip install -r requirements.txt'}), 503
    except Exception as exc:
        app.logger.exception('SHAP explanation failed')
        return jsonify({'error': 'Could not calculate SHAP explanation: ' + str(exc)}), 500

@app.get('/api/forecast/backtest')
def forecast_backtest():
    """True chronological holdout predictions, not illustrative points."""
    from forecast_model import features, FEATURES
    import numpy as np
    df = load_data()
    z = features(df, training=True).dropna(subset=FEATURES + ['target'])
    meta = json.loads((BASE/'model'/'forecast_metadata.json').read_text())
    # Match the original 80/20 chronological split used during training.
    test = z.iloc[int(len(z)*0.8):]
    model = joblib.load(BASE/'model'/'forecast_24h.pkl')
    predictions = model.predict(test[FEATURES])
    actual = test['target'].to_numpy()
    from sklearn.metrics import mean_absolute_error
    mae = float(mean_absolute_error(actual, predictions))
    baseline_mae = float(mean_absolute_error(actual, test['aqi_now'].to_numpy()))
    # A sampled visualization for readability; metrics use ALL test rows.
    indices = np.unique(np.linspace(0, len(test)-1, min(180,len(test)),dtype=int))
    series = [{'date':(test.index[i]+pd.Timedelta(hours=24)).strftime('%Y-%m-%d %H:%M UTC'),
               'actual':round(float(actual[i]),1),'predicted':round(float(predictions[i]),1)} for i in indices]
    return jsonify({'points':series,'mae':round(mae,2),'baseline_mae':round(baseline_mae,2),
        'test_rows':len(test),'split':'Chronological 80/20','source':'Open-Meteo modeled historical estimates',
        'note':'Predictions are 24 hours ahead on held-out historical data, not live measurements.'})

@app.get('/api/forecast/model')
def forecast_model_info():
    return jsonify(json.loads((BASE/'model'/'forecast_metadata.json').read_text()))

@app.get('/api/model')
def model_info():
    path = BASE/'model'/'model_metadata.json'
    return jsonify(json.loads(path.read_text()) if path.exists() else {'error':'Train model first'})


@app.get('/api/weather/patterns')
def weather_patterns():
    """Historical weather and AQI summaries, calculated from bundled modeled data."""
    import numpy as np
    df = load_data().copy()
    needed = ['date','temperature','humidity','wind_speed','precipitation','aqi']
    df = df.dropna(subset=needed)
    if df.empty:
        return jsonify({'error':'No complete weather records available'}),503
    df['month'] = df.date.dt.month
    df['day'] = df.date.dt.floor('D')
    monthly = df.groupby('month').agg(temperature=('temperature','mean'),humidity=('humidity','mean'),wind_speed=('wind_speed','mean'),aqi=('aqi','mean'),rainfall=('precipitation','sum'),hours=('aqi','size')).reset_index()
    monthly_records = [{'month':int(r.month),'temperature':round(float(r.temperature),1),'humidity':round(float(r.humidity),1),'wind_speed':round(float(r.wind_speed),1),'rainfall':round(float(r.rainfall),1),'aqi':round(float(r.aqi),1),'hours':int(r.hours)} for r in monthly.itertuples()]
    daily = df.groupby('day').agg(temperature=('temperature','mean'),humidity=('humidity','mean'),wind_speed=('wind_speed','mean'),rainfall=('precipitation','sum'),aqi=('aqi','mean')).tail(30).reset_index()
    daily_records = [{'date':r.day.strftime('%d %b'),'temperature':round(float(r.temperature),1),'humidity':round(float(r.humidity),1),'wind_speed':round(float(r.wind_speed),1),'rainfall':round(float(r.rainfall),1),'aqi':round(float(r.aqi),1)} for r in daily.itertuples()]
    # Monsoon groupings are descriptive calendar bins, not inferred climate classifications.
    def season(m):
        if m in (3,4,5): return 'Summer (Mar–May)'
        if m in (6,7,8,9): return 'Monsoon (Jun–Sep)'
        if m in (10,11): return 'Post-monsoon (Oct–Nov)'
        return 'Winter (Dec–Feb)'
    df['season'] = df.month.map(season)
    season_order = ['Winter (Dec–Feb)','Summer (Mar–May)','Monsoon (Jun–Sep)','Post-monsoon (Oct–Nov)']
    seasons = df.groupby('season').agg(temperature=('temperature','mean'),humidity=('humidity','mean'),wind_speed=('wind_speed','mean'),rainfall=('precipitation','sum'),aqi=('aqi','mean'),hours=('aqi','size'))
    seasonal = [{'season':k,'temperature':round(float(seasons.loc[k,'temperature']),1),'humidity':round(float(seasons.loc[k,'humidity']),1),'wind_speed':round(float(seasons.loc[k,'wind_speed']),1),'rainfall':round(float(seasons.loc[k,'rainfall']),1),'aqi':round(float(seasons.loc[k,'aqi']),1),'hours':int(seasons.loc[k,'hours'])} for k in season_order if k in seasons.index]
    # Compare average AQI in the bottom and top quartile of each weather variable.
    comparisons=[]
    for key,label,unit in [('temperature','Temperature','°C'),('humidity','Humidity','%'),('wind_speed','Wind speed','km/h'),('precipitation','Precipitation','mm/hour')]:
        lo,hi=df[key].quantile([.25,.75]); low=df.loc[df[key]<=lo,'aqi']; high=df.loc[df[key]>=hi,'aqi']
        r=float(df[[key,'aqi']].corr().iloc[0,1]) if df[key].nunique()>1 else 0.0
        comparisons.append({'key':key,'label':label,'unit':unit,'low_threshold':round(float(lo),2),'high_threshold':round(float(hi),2),'low_aqi':round(float(low.mean()),1),'high_aqi':round(float(high.mean()),1),'difference':round(float(high.mean()-low.mean()),1),'correlation':round(r,3),'low_count':int(len(low)),'high_count':int(len(high))})
    strongest=max(comparisons,key=lambda x:abs(x['correlation']))
    wet=df.loc[df.precipitation>0,'aqi']; dry=df.loc[df.precipitation==0,'aqi']
    insights=[f"Strongest linear weather–AQI association in this dataset: {strongest['label']} (Pearson r = {strongest['correlation']:+.2f}). This does not establish causation."]
    if len(wet) and len(dry):
        insights.append(f"Mean AQI during hours with precipitation: {wet.mean():.1f} ({len(wet):,} hours), versus {dry.mean():.1f} during dry hours ({len(dry):,} hours).")
    peak=max(seasonal,key=lambda x:x['aqi']); insights.append(f"Highest mean AQI among calendar seasons: {peak['season']} ({peak['aqi']:.1f}).")
    return jsonify({'daily':daily_records,'monthly':monthly_records,'seasons':seasonal,'comparisons':comparisons,'insights':insights,'records':len(df),'date_start':df.date.min().strftime('%Y-%m-%d'),'date_end':df.date.max().strftime('%Y-%m-%d'),'methodology':'Historical Open-Meteo modeled estimates; US EPA AQI; correlations and group comparisons are observational, not causal. Rainfall is summed over available hourly records; season totals are not normalized by years or observation counts.'})


# Live Open-Meteo modeled conditions, separate from the bundled historical dataset.
# Cached for five minutes to avoid excessive upstream requests.
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from threading import Lock
import time

LIVE_COORDS = {'latitude': 12.9716, 'longitude': 77.5946}
_live_cache = {'expires': 0, 'payload': None}
_live_lock = Lock()

def _open_meteo_json(endpoint, fields):
    params = {**LIVE_COORDS, 'current': ','.join(fields), 'timezone': 'UTC'}
    url = endpoint + '?' + urlencode(params)
    req = Request(url, headers={'User-Agent': 'AirVision-Hackathon/1.0'})
    with urlopen(req, timeout=12) as response:
        return json.load(response)

@app.get('/api/live')
def live_conditions():
    with _live_lock:
        now = time.monotonic()
        if _live_cache['payload'] is not None and now < _live_cache['expires']:
            return jsonify(_live_cache['payload'])
        weather = None
        air = None
        errors = []
        try:
            weather = _open_meteo_json('https://api.open-meteo.com/v1/forecast',
                ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'precipitation',
                 'weather_code', 'is_day', 'cloud_cover'])
        except Exception as exc:
            app.logger.warning('Live weather API failed: %s', exc)
            errors.append('Weather service unavailable')
        try:
            air = _open_meteo_json('https://air-quality-api.open-meteo.com/v1/air-quality',
                ['us_aqi', 'pm2_5', 'pm10'])
        except Exception as exc:
            app.logger.warning('Live air-quality API failed: %s', exc)
            errors.append('Air-quality service unavailable')
        if weather is None and air is None:
            return jsonify({'error': 'Live services are unavailable. Check internet connectivity.',
                            'details': errors, 'live': False}), 503
        wc = weather.get('current', {}) if weather else {}
        ac = air.get('current', {}) if air else {}
        aqi = ac.get('us_aqi')
        payload = {
            'live': True, 'city': 'Bengaluru',
            'location': LIVE_COORDS,
            'aqi': aqi, 'category': category(float(aqi)) if aqi is not None else None,
            'pm25': ac.get('pm2_5'), 'pm10': ac.get('pm10'),
            'temperature': wc.get('temperature_2m'),
            'humidity': wc.get('relative_humidity_2m'),
            'wind_speed': wc.get('wind_speed_10m'),
            'precipitation': wc.get('precipitation'),
            'weather_code': wc.get('weather_code'),
            'is_day': wc.get('is_day'),
            'cloud_cover': wc.get('cloud_cover'),
            'weather_observed_at_utc': wc.get('time'),
            'air_quality_observed_at_utc': ac.get('time'),
            'fetched_at_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'errors': errors,
            'source': 'Open-Meteo current modeled estimates; not ground-station readings',
            'aqi_standard': 'US EPA AQI',
            'disclaimer': 'Current modeled conditions; updates depend on provider availability. Not a live AI forecast.'
        }
        _live_cache['payload'] = payload
        _live_cache['expires'] = time.monotonic() + 300
        return jsonify(payload)

# Future weather and AQI outlook from independent Open-Meteo forecast services.
# The forecast AQI is NOT generated by AirVision's historical XGBoost model.
_future_cache = {'expires': 0, 'payload': None}
_future_lock = Lock()

def _future_fetch(url, params):
    request = Request(url + '?' + urlencode(params), headers={'User-Agent':'AirVision-Hackathon/1.0'})
    with urlopen(request, timeout=15) as response:
        return json.load(response)

@app.get('/api/future/7day')
def future_seven_day():
    with _future_lock:
        if _future_cache['payload'] is not None and time.monotonic() < _future_cache['expires']:
            return jsonify(_future_cache['payload'])
        errors=[]
        weather=None; air=None
        try:
            weather=_future_fetch('https://api.open-meteo.com/v1/forecast', {
                **LIVE_COORDS, 'timezone':'Asia/Kolkata', 'forecast_days':7,
                'daily':'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
                'hourly':'temperature_2m,relative_humidity_2m,precipitation_probability'})
        except Exception as exc:
            app.logger.warning('Future weather request failed: %s', exc)
            errors.append('Weather forecast unavailable')
        try:
            air=_future_fetch('https://air-quality-api.open-meteo.com/v1/air-quality', {
                **LIVE_COORDS, 'timezone':'Asia/Kolkata', 'forecast_days':7,
                'hourly':'us_aqi,pm2_5,pm10'})
        except Exception as exc:
            app.logger.warning('Future air-quality request failed: %s', exc)
            errors.append('Air-quality forecast unavailable')
        if weather is None and air is None:
            return jsonify({'error':'Both forecast services are unavailable; check internet connection', 'details':errors}),503
        from collections import defaultdict
        aq_by_day=defaultdict(list)
        pm_by_day=defaultdict(list)
        if air:
            hourly=air.get('hourly') or {}
            for t,aq,pm in zip(hourly.get('time',[]),hourly.get('us_aqi',[]),hourly.get('pm2_5',[])):
                day=t[:10]
                if aq is not None: aq_by_day[day].append(float(aq))
                if pm is not None: pm_by_day[day].append(float(pm))
        wd=(weather or {}).get('daily') or {}
        dates=wd.get('time') or sorted(aq_by_day)[:7]
        days=[]
        for i,day in enumerate(dates[:7]):
            def daily(key):
                vals=wd.get(key,[])
                return vals[i] if i < len(vals) else None
            aqs=aq_by_day.get(day,[])
            pms=pm_by_day.get(day,[])
            days.append({'date':day, 'weather_code':daily('weather_code'),
                'temp_max':daily('temperature_2m_max'), 'temp_min':daily('temperature_2m_min'),
                'rain_mm':daily('precipitation_sum'), 'rain_chance':daily('precipitation_probability_max'),
                'wind_max':daily('wind_speed_10m_max'),
                'aqi_mean':round(sum(aqs)/len(aqs)) if aqs else None,
                'aqi_max':round(max(aqs)) if aqs else None,
                'pm25_mean':round(sum(pms)/len(pms),1) if pms else None,
                'aqi_hours_available':len(aqs)})
        wh=(weather or {}).get('hourly') or {}
        hourly=[]
        for t,temp,humidity,rain in zip(wh.get('time',[])[:48], wh.get('temperature_2m',[])[:48],
              wh.get('relative_humidity_2m',[])[:48], wh.get('precipitation_probability',[])[:48]):
            hourly.append({'time':t,'temperature':temp,'humidity':humidity,'rain_chance':rain})
        payload={'city':'Bengaluru','days':days,'hourly_weather':hourly,'errors':errors,
            'generated_at_utc':datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'source':'Open-Meteo Weather Forecast API and Air Quality API (CAMS modeled forecasts)',
            'aqi_standard':'US EPA AQI (not Indian CPCB)',
            'note':'External model forecasts, not predictions generated by the AirVision XGBoost model. AQI may be unavailable for later days if upstream forecast coverage is shorter. Daily AQI is the mean of available hourly forecast values.'}
        _future_cache.update({'payload':payload,'expires':time.monotonic()+900})
        return jsonify(payload)

if __name__ == '__main__':
    app.run(debug=False, use_reloader=False, port=5000)

from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

BASE = Path(__file__).resolve().parent
DATA = BASE / 'dataset' / 'air_quality.csv'
MODEL = BASE / 'model'
FEATURES = ['temperature', 'humidity', 'pm25', 'pm10']

def train():
    df = pd.read_csv(DATA, parse_dates=['date']).sort_values('date')
    df = df.dropna(subset=FEATURES + ['aqi'])
    if len(df) < 30:
        raise ValueError('Dataset needs at least 30 complete rows')
    cutoff = max(1, int(len(df) * .8))
    train_df, test_df = df.iloc[:cutoff], df.iloc[cutoff:]
    try:
        from xgboost import XGBRegressor
        reg = XGBRegressor(n_estimators=120, max_depth=3, learning_rate=.06, random_state=42, n_jobs=2)
        kind = 'XGBoost'
    except ImportError:
        reg = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42, n_jobs=2)
        kind = 'Random Forest (fallback)'
    reg.fit(train_df[FEATURES], train_df['aqi'])
    pred = reg.predict(test_df[FEATURES])
    mae = float(mean_absolute_error(test_df['aqi'], pred))
    MODEL.mkdir(exist_ok=True)
    joblib.dump(reg, MODEL / 'aqi_model.pkl')
    meta = {'model':kind, 'features':FEATURES, 'mae':round(mae,2), 'test_rows':len(test_df), 'dataset_rows':len(df), 'aqi_standard':'US EPA AQI', 'prediction_type':'Same-time US AQI estimation from Open-Meteo modeled pollutant concentrations; not future forecasting', 'synthetic_data':bool(df.get('synthetic', pd.Series([False])).astype(str).str.lower().eq('true').any())}
    (MODEL/'model_metadata.json').write_text(json.dumps(meta, indent=2))
    print('Model trained:', meta)

if __name__ == '__main__':
    train()

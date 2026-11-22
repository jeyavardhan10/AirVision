from pathlib import Path
import json, joblib, numpy as np, pandas as pd
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error
BASE=Path(__file__).resolve().parent
HORIZON=24
FEATURES=['aqi_now','aqi_24h_ago','aqi_48h_ago','aqi_last24_mean','pm25_now','pm10_now','temperature_now','humidity_now','wind_speed_now','hour_sin','hour_cos','month_sin','month_cos']

def features(df, training=False):
    d=df.copy().sort_values('date').set_index('date')
    d=d[~d.index.duplicated(keep='last')].asfreq('h')
    z=pd.DataFrame(index=d.index)
    z['aqi_now']=d.aqi
    z['aqi_24h_ago']=d.aqi.shift(24)
    z['aqi_48h_ago']=d.aqi.shift(48)
    z['aqi_last24_mean']=d.aqi.shift(1).rolling(24,min_periods=24).mean()
    for c in ['pm25','pm10','temperature','humidity','wind_speed']:
        z[c+'_now']=d[c]
    future=z.index+pd.Timedelta(hours=24)
    z['hour_sin']=np.sin(2*np.pi*future.hour/24)
    z['hour_cos']=np.cos(2*np.pi*future.hour/24)
    z['month_sin']=np.sin(2*np.pi*(future.month-1)/12)
    z['month_cos']=np.cos(2*np.pi*(future.month-1)/12)
    if training: z['target']=d.aqi.shift(-24)
    return z

def train():
    df=pd.read_csv(BASE/'dataset'/'air_quality.csv',parse_dates=['date'])
    z=features(df,True).dropna(subset=FEATURES+['target'])
    cut=int(len(z)*.8)
    tr,te=z.iloc[:cut],z.iloc[cut:]
    model=XGBRegressor(n_estimators=240,max_depth=4,learning_rate=.045,subsample=.9,colsample_bytree=.9,random_state=42,n_jobs=2)
    model.fit(tr[FEATURES],tr.target)
    pred=model.predict(te[FEATURES]); mae=mean_absolute_error(te.target,pred)
    baseline=mean_absolute_error(te.target,te.aqi_now)
    (BASE/'model').mkdir(exist_ok=True)
    joblib.dump(model,BASE/'model'/'forecast_24h.pkl')
    meta={'model':'XGBoost','prediction_type':'24-hour-ahead US AQI forecast','horizon_hours':24,'features':FEATURES,'test_mae':round(float(mae),2),'persistence_baseline_mae':round(float(baseline),2),'test_rows':len(te),'training_rows':len(tr),'test_start_utc':str(te.index[0]),'test_end_utc':str(te.index[-1]),'data_source':'Open-Meteo modeled historical data','warning':'Forecast uses only observations available at prediction time; historical backtest does not guarantee live accuracy.'}
    (BASE/'model'/'forecast_metadata.json').write_text(json.dumps(meta,indent=2))
    print(meta)
if __name__=='__main__':train()

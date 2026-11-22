import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wmoCodeToScene,
  describeWmoCode,
  getAqiCategory,
  getAqiAdvice,
  validateEstimatorInputs,
  estimateSameTimeAqi,
  computeParallaxOffset,
  computeAqiHazeStrength,
} from './weatherLogic';

test('wmoCodeToScene maps WMO weather codes and day/night accurately', () => {
  assert.equal(wmoCodeToScene(0, 1, 10), 'sunny');
  assert.equal(wmoCodeToScene(0, 0, 10), 'night');
  assert.equal(wmoCodeToScene(2, 1, 45), 'partly-cloudy');
  assert.equal(wmoCodeToScene(3, 1, 95), 'overcast');
  assert.equal(wmoCodeToScene(45, 1, 80), 'fog');
  assert.equal(wmoCodeToScene(61, 1, 90), 'rain');
  assert.equal(wmoCodeToScene(80, 0, 85), 'rain');
  assert.equal(wmoCodeToScene(95, 1, 100), 'storm');
  assert.equal(wmoCodeToScene(99, 0, 100), 'storm');
});

test('describeWmoCode returns clear human weather descriptions', () => {
  assert.equal(describeWmoCode(0, 1), 'Clear sky');
  assert.equal(describeWmoCode(0, 0), 'Clear night');
  assert.equal(describeWmoCode(63, 1), 'Steady rain');
  assert.equal(describeWmoCode(95, 1), 'Thunderstorm');
});

test('getAqiCategory and getAqiAdvice cover every US EPA AQI band', () => {
  assert.equal(getAqiCategory(32), 'Good');
  assert.equal(getAqiCategory(78), 'Moderate');
  assert.equal(getAqiCategory(128), 'Unhealthy for Sensitive Groups');
  assert.equal(getAqiCategory(174), 'Unhealthy');
  assert.equal(getAqiCategory(240), 'Very Unhealthy');
  assert.equal(getAqiCategory(380), 'Hazardous');

  assert.match(getAqiAdvice(42).advisory, /good/i);
  assert.match(getAqiAdvice(185).outdoor, /reduce prolonged/i);
  assert.match(getAqiAdvice(350).warning, /Emergency health warning/i);
});

test('validateEstimatorInputs enforces strict bounds and rejects empty/invalid inputs', () => {
  const valid = validateEstimatorInputs({
    temperature: 24.5,
    humidity: 62,
    pm25: 28,
    pm10: 54,
  });
  assert.equal(valid.ok, true);

  const emptyField = validateEstimatorInputs({
    temperature: '',
    humidity: 60,
    pm25: 20,
    pm10: 40,
  });
  assert.equal(emptyField.ok, false);

  const outOfRangePm25 = validateEstimatorInputs({
    temperature: 24,
    humidity: 60,
    pm25: 1200,
    pm10: 40,
  });
  assert.equal(outOfRangePm25.ok, false);
  if (!outOfRangePm25.ok) {
    assert.match(outOfRangePm25.error, /between 0 and 1000/);
  }

  const negativeHumidity = validateEstimatorInputs({
    temperature: 24,
    humidity: -5,
    pm25: 20,
    pm10: 40,
  });
  assert.equal(negativeHumidity.ok, false);
});

test('estimateSameTimeAqi scales monotonically with PM2.5 and clamps to 0-500', () => {
  const clean = estimateSameTimeAqi({ temperature: 24, humidity: 60, pm25: 6, pm10: 18 });
  const moderate = estimateSameTimeAqi({ temperature: 24, humidity: 60, pm25: 25, pm10: 48 });
  const unhealthy = estimateSameTimeAqi({ temperature: 16, humidity: 78, pm25: 95, pm10: 180 });
  const extreme = estimateSameTimeAqi({ temperature: 20, humidity: 80, pm25: 900, pm10: 1400 });

  assert.ok(clean <= 50, `Expected clean AQI <= 50, got ${clean}`);
  assert.ok(moderate > clean && moderate <= 105, `Expected moderate AQI, got ${moderate}`);
  assert.ok(unhealthy > 150, `Expected unhealthy AQI > 150, got ${unhealthy}`);
  assert.equal(extreme, 500);
});

test('computeParallaxOffset clamps inputs and scales with depth', () => {
  const origin = computeParallaxOffset(0, 0, 0, 1);
  assert.deepEqual(origin, { x: 0, y: 0 });

  const clamped = computeParallaxOffset(5, -5, 100, 0.5);
  assert.equal(clamped.x, 13);
  assert.ok(clamped.y < 0);
});

test('computeAqiHazeStrength activates only above AQI 75 and caps at 0.42', () => {
  assert.equal(computeAqiHazeStrength(50), 0);
  assert.equal(computeAqiHazeStrength(75), 0);
  assert.ok(computeAqiHazeStrength(150) > 0.1);
  assert.equal(computeAqiHazeStrength(400), 0.42);
});

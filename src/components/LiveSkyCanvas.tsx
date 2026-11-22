import { useEffect, useRef } from 'react';
import type { WeatherScene } from '../types/airvision';
import { computeAqiHazeStrength } from '../utils/weatherLogic';

interface LiveSkyCanvasProps {
  scene: WeatherScene;
  aqi: number | null;
  reducedMotion: boolean;
}

interface Palette {
  top: [number, number, number];
  mid: [number, number, number];
  horizon: [number, number, number];
  hillFar: [number, number, number];
  hillNear: [number, number, number];
  cloudBase: [number, number, number];
  cloudLit: [number, number, number];
  cloudAlpha: number;
  sunAlpha: number;
  moonAlpha: number;
  starAlpha: number;
  rainAlpha: number;
  fogAlpha: number;
  moteAlpha: number;
  stormStrength: number;
}

const PALETTES: Record<WeatherScene, Palette> = {
  sunny: {
    top: [14, 72, 148],
    mid: [42, 134, 206],
    horizon: [242, 190, 126],
    hillFar: [24, 58, 96],
    hillNear: [12, 32, 58],
    cloudBase: [248, 240, 228],
    cloudLit: [255, 251, 240],
    cloudAlpha: 0.24,
    sunAlpha: 1,
    moonAlpha: 0,
    starAlpha: 0,
    rainAlpha: 0,
    fogAlpha: 0.08,
    moteAlpha: 0.85,
    stormStrength: 0,
  },
  'partly-cloudy': {
    top: [22, 68, 126],
    mid: [62, 118, 174],
    horizon: [188, 204, 218],
    hillFar: [28, 52, 82],
    hillNear: [14, 28, 48],
    cloudBase: [204, 216, 232],
    cloudLit: [252, 248, 242],
    cloudAlpha: 0.62,
    sunAlpha: 0.65,
    moonAlpha: 0,
    starAlpha: 0,
    rainAlpha: 0,
    fogAlpha: 0.14,
    moteAlpha: 0.35,
    stormStrength: 0,
  },
  overcast: {
    top: [32, 44, 62],
    mid: [58, 72, 92],
    horizon: [106, 120, 138],
    hillFar: [24, 34, 48],
    hillNear: [14, 20, 30],
    cloudBase: [86, 98, 116],
    cloudLit: [154, 168, 184],
    cloudAlpha: 0.88,
    sunAlpha: 0.08,
    moonAlpha: 0,
    starAlpha: 0,
    rainAlpha: 0,
    fogAlpha: 0.26,
    moteAlpha: 0.05,
    stormStrength: 0,
  },
  rain: {
    top: [14, 26, 46],
    mid: [27, 46, 74],
    horizon: [54, 78, 108],
    hillFar: [14, 24, 40],
    hillNear: [8, 15, 27],
    cloudBase: [44, 60, 82],
    cloudLit: [92, 114, 142],
    cloudAlpha: 0.85,
    sunAlpha: 0,
    moonAlpha: 0,
    starAlpha: 0,
    rainAlpha: 0.88,
    fogAlpha: 0.28,
    moteAlpha: 0,
    stormStrength: 0,
  },
  storm: {
    top: [9, 13, 28],
    mid: [22, 26, 52],
    horizon: [44, 48, 82],
    hillFar: [11, 14, 28],
    hillNear: [6, 8, 18],
    cloudBase: [28, 32, 52],
    cloudLit: [74, 82, 118],
    cloudAlpha: 0.94,
    sunAlpha: 0,
    moonAlpha: 0,
    starAlpha: 0,
    rainAlpha: 1,
    fogAlpha: 0.22,
    moteAlpha: 0,
    stormStrength: 1,
  },
  fog: {
    top: [44, 68, 82],
    mid: [82, 110, 122],
    horizon: [154, 178, 186],
    hillFar: [40, 58, 68],
    hillNear: [22, 36, 44],
    cloudBase: [168, 186, 194],
    cloudLit: [216, 228, 232],
    cloudAlpha: 0.54,
    sunAlpha: 0.28,
    moonAlpha: 0,
    starAlpha: 0,
    rainAlpha: 0,
    fogAlpha: 0.92,
    moteAlpha: 0.15,
    stormStrength: 0,
  },
  night: {
    top: [4, 9, 24],
    mid: [11, 22, 50],
    horizon: [26, 44, 84],
    hillFar: [10, 18, 38],
    hillNear: [5, 10, 22],
    cloudBase: [24, 38, 68],
    cloudLit: [64, 92, 142],
    cloudAlpha: 0.26,
    sunAlpha: 0,
    moonAlpha: 1,
    starAlpha: 1,
    rainAlpha: 0,
    fogAlpha: 0.12,
    moteAlpha: 0.72,
    stormStrength: 0,
  },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function rgbStr(c: [number, number, number], alpha = 1): string {
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})`;
}

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  layer: number; // 0 far, 1 mid, 2 near
  puffs: Array<{ dx: number; dy: number; r: number }>;
}

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  tint: string;
}

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  depth: number;
}

interface Mote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface Ripple {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
}

interface LightningBolt {
  segments: Array<[number, number, number, number]>;
  alpha: number;
  flash: number;
}

export function LiveSkyCanvas({ scene, aqi, reducedMotion }: LiveSkyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetSceneRef = useRef<WeatherScene>(scene);
  const aqiRef = useRef<number | null>(aqi);
  const reducedMotionRef = useRef<boolean>(reducedMotion);

  useEffect(() => {
    targetSceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    aqiRef.current = aqi;
  }, [aqi]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    // Pre-bake bright & dark cloud puff sprites once to avoid 70+ radial gradients per frame
    const makePuff = (inner: string, mid: string) => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const gCtx = c.getContext('2d');
      if (gCtx) {
        const g = gCtx.createRadialGradient(64, 52, 8, 64, 64, 62);
        g.addColorStop(0, inner);
        g.addColorStop(0.55, mid);
        g.addColorStop(1, 'rgba(180, 198, 220, 0)');
        gCtx.fillStyle = g;
        gCtx.fillRect(0, 0, 128, 128);
      }
      return c;
    };
    const brightPuff = makePuff('rgba(255, 252, 245, 0.9)', 'rgba(220, 232, 246, 0.5)');
    const darkPuff = makePuff('rgba(96, 114, 142, 0.85)', 'rgba(38, 48, 72, 0.52)');

    let cachedVignette: CanvasGradient | null = null;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const scale = 0.6;
      canvas.width = Math.max(1, Math.floor(width * scale));
      canvas.height = Math.max(1, Math.floor(height * scale));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);

      cachedVignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        Math.min(width, height) * 0.34,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.78
      );
      cachedVignette.addColorStop(0, 'rgba(4, 10, 22, 0)');
      cachedVignette.addColorStop(1, 'rgba(4, 9, 20, 0.38)');
    };
    resize();

    // Clone initial palette
    const initial = PALETTES[targetSceneRef.current];
    const current: Palette = {
      top: [...initial.top],
      mid: [...initial.mid],
      horizon: [...initial.horizon],
      hillFar: [...initial.hillFar],
      hillNear: [...initial.hillNear],
      cloudBase: [...initial.cloudBase],
      cloudLit: [...initial.cloudLit],
      cloudAlpha: initial.cloudAlpha,
      sunAlpha: initial.sunAlpha,
      moonAlpha: initial.moonAlpha,
      starAlpha: initial.starAlpha,
      rainAlpha: initial.rainAlpha,
      fogAlpha: initial.fogAlpha,
      moteAlpha: initial.moteAlpha,
      stormStrength: initial.stormStrength,
    };

    // Deterministic seeded visual entities
    const stars: Star[] = Array.from({ length: 135 }, (_, i) => {
      const s1 = Math.sin(i * 12.9898) * 43758.5453;
      const s2 = Math.sin(i * 78.233) * 43758.5453;
      const tints = ['#ffffff', '#dbeafe', '#fef3c7', '#e0f2fe'];
      return {
        x: s1 - Math.floor(s1),
        y: (s2 - Math.floor(s2)) * 0.68,
        r: 0.6 + ((i * 17) % 10) * 0.16,
        phase: (i * 1.37) % (Math.PI * 2),
        speed: 0.8 + ((i * 7) % 10) * 0.15,
        tint: tints[i % tints.length],
      };
    });

    const clouds: Cloud[] = Array.from({ length: 14 }, (_, i) => {
      const layer = i % 3;
      const puffCount = 4 + (i % 3);
      const puffs = Array.from({ length: puffCount }, (__, p) => {
        const ratio = p / (puffCount - 1) - 0.5;
        return {
          dx: ratio * 155,
          dy: -Math.abs(ratio) * -18 - (p % 2) * 14,
          r: 42 + (1 - Math.abs(ratio) * 1.1) * 34 + ((i + p) % 3) * 8,
        };
      });
      return {
        x: ((i * 193) % 1600) - 180,
        y: 65 + layer * 68 + ((i * 41) % 70),
        scale: 0.72 + layer * 0.34 + (i % 3) * 0.14,
        speed: (8 + layer * 9 + (i % 4) * 3) * (layer === 0 ? 0.7 : 1),
        layer,
        puffs,
      };
    });

    const drops: RainDrop[] = Array.from({ length: 170 }, (_, i) => {
      const depth = 0.4 + ((i * 13) % 10) * 0.08;
      return {
        x: ((i * 97) % 1700) - 100,
        y: (i * 61) % 1000,
        len: 14 + depth * 22,
        speed: 440 + depth * 420,
        depth,
      };
    });

    const motes: Mote[] = Array.from({ length: 38 }, (_, i) => ({
      x: ((i * 131) % 1500),
      y: 120 + ((i * 89) % 760),
      r: 1.4 + (i % 4) * 0.7,
      vx: -6 + (i % 5) * 3.2,
      vy: -8 - (i % 4) * 3.5,
      phase: (i * 0.9) % (Math.PI * 2),
    }));

    let shootingStar: ShootingStar | null = null;
    let nextMeteorAt = 2.8;
    const ripples: Ripple[] = [];
    let bolt: LightningBolt | null = null;
    let nextLightningAt = 2.4;

    // Pointer + scroll parallax state
    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;
    let targetScrollY = window.scrollY;
    let scrollY = window.scrollY;

    const onPointerMove = (e: PointerEvent) => {
      targetMouseX = (e.clientX / Math.max(1, width)) * 2 - 1;
      targetMouseY = (e.clientY / Math.max(1, height)) * 2 - 1;
    };

    const onScroll = () => {
      targetScrollY = window.scrollY;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const buildLightning = (): LightningBolt => {
      const startX = width * (0.22 + Math.random() * 0.56);
      const segments: Array<[number, number, number, number]> = [];
      let cx = startX;
      let cy = height * 0.04;
      const steps = 11;
      for (let i = 0; i < steps; i++) {
        const nx = cx + (Math.random() - 0.46) * 58;
        const ny = cy + height * (0.045 + Math.random() * 0.035);
        segments.push([cx, cy, nx, ny]);
        if (i > 2 && i < 8 && Math.random() > 0.55) {
          const bx = nx + (Math.random() > 0.5 ? 1 : -1) * (35 + Math.random() * 45);
          const by = ny + 38 + Math.random() * 44;
          segments.push([nx, ny, bx, by]);
        }
        cx = nx;
        cy = ny;
      }
      return { segments, alpha: 1, flash: 0.42 };
    };

    const drawHills = (
      yBase: number,
      amp1: number,
      amp2: number,
      color: [number, number, number],
      parallaxX: number,
      parallaxY: number,
      seedOffset: number
    ) => {
      ctx.beginPath();
      ctx.moveTo(-40, height + 20);
      const step = 28;
      for (let x = -40; x <= width + 60; x += step) {
        const sampleX = (x + parallaxX + seedOffset) * 0.0026;
        const ridge =
          Math.sin(sampleX * 1.4) * amp1 +
          Math.cos(sampleX * 3.1 + 1.2) * amp2 +
          Math.sin(sampleX * 6.2) * (amp2 * 0.35);
        ctx.lineTo(x, yBase + ridge + parallaxY);
      }
      ctx.lineTo(width + 60, height + 20);
      ctx.closePath();
      ctx.fillStyle = rgbStr(color, 0.92);
      ctx.fill();
    };

    let timerId = 0;
    let isDisposed = false;
    let lastScheduledAt = performance.now();

    const drawFrame = (now: number) => {
      if (isDisposed) return;
      const compositorLag = Math.max(0, now - lastScheduledAt);
      const rawDt = Math.min(0.1, Math.max(0.016, (now - lastTime) / 1000));
      lastTime = now;
      const motionScale = reducedMotionRef.current ? 0.12 : 1;
      const dt = rawDt * motionScale;
      elapsed += dt;

      // Smoothly interpolate active weather palette
      const target = PALETTES[targetSceneRef.current];
      const blend = Math.min(1, rawDt * 2.4);
      current.top = lerpRgb(current.top, target.top, blend);
      current.mid = lerpRgb(current.mid, target.mid, blend);
      current.horizon = lerpRgb(current.horizon, target.horizon, blend);
      current.hillFar = lerpRgb(current.hillFar, target.hillFar, blend);
      current.hillNear = lerpRgb(current.hillNear, target.hillNear, blend);
      current.cloudBase = lerpRgb(current.cloudBase, target.cloudBase, blend);
      current.cloudLit = lerpRgb(current.cloudLit, target.cloudLit, blend);
      current.cloudAlpha = lerp(current.cloudAlpha, target.cloudAlpha, blend);
      current.sunAlpha = lerp(current.sunAlpha, target.sunAlpha, blend);
      current.moonAlpha = lerp(current.moonAlpha, target.moonAlpha, blend);
      current.starAlpha = lerp(current.starAlpha, target.starAlpha, blend);
      current.rainAlpha = lerp(current.rainAlpha, target.rainAlpha, blend);
      current.fogAlpha = lerp(current.fogAlpha, target.fogAlpha, blend);
      current.moteAlpha = lerp(current.moteAlpha, target.moteAlpha, blend);
      current.stormStrength = lerp(current.stormStrength, target.stormStrength, blend);

      // Smooth damped mouse & scroll parallax
      const pSmooth = reducedMotionRef.current ? 0.04 : 0.08;
      mouseX = lerp(mouseX, reducedMotionRef.current ? 0 : targetMouseX, pSmooth);
      mouseY = lerp(mouseY, reducedMotionRef.current ? 0 : targetMouseY, pSmooth);
      scrollY = lerp(scrollY, targetScrollY, 0.1);
      const scrollNorm = Math.min(scrollY, 2200);

      // 1. Sky vertical gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, rgbStr(current.top));
      skyGrad.addColorStop(0.54, rgbStr(current.mid));
      skyGrad.addColorStop(1, rgbStr(current.horizon));
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Stars + Shooting stars (Night)
      if (current.starAlpha > 0.02) {
        const px = -mouseX * 10;
        const py = -mouseY * 6 - scrollNorm * 0.015;
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          const twinkle = 0.45 + 0.55 * Math.sin(elapsed * s.speed + s.phase);
          ctx.globalAlpha = current.starAlpha * twinkle * 0.92;
          ctx.fillStyle = s.tint;
          ctx.beginPath();
          ctx.arc(s.x * width + px, s.y * height + py, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (!reducedMotionRef.current && current.starAlpha > 0.6) {
          nextMeteorAt -= dt;
          if (nextMeteorAt <= 0 && !shootingStar) {
            shootingStar = {
              x: width * (0.2 + Math.random() * 0.65),
              y: height * (0.06 + Math.random() * 0.22),
              vx: 380 + Math.random() * 200,
              vy: 140 + Math.random() * 90,
              life: 0,
              maxLife: 0.72,
            };
            nextMeteorAt = 5 + Math.random() * 6;
          }
        }
        if (shootingStar) {
          shootingStar.x += shootingStar.vx * dt;
          shootingStar.y += shootingStar.vy * dt;
          shootingStar.life += dt;
          const prog = shootingStar.life / shootingStar.maxLife;
          if (prog >= 1) {
            shootingStar = null;
          } else {
            const alpha = Math.sin(prog * Math.PI) * current.starAlpha;
            const tailX = shootingStar.x - shootingStar.vx * 0.16;
            const tailY = shootingStar.y - shootingStar.vy * 0.16;
            const grad = ctx.createLinearGradient(shootingStar.x, shootingStar.y, tailX, tailY);
            grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
            grad.addColorStop(1, 'rgba(186, 230, 253, 0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(shootingStar.x, shootingStar.y);
            ctx.lineTo(tailX, tailY);
            ctx.stroke();
          }
        }
      }

      // 3. Solar disc + volumetric light shafts (Sunny / Partly Cloudy)
      if (current.sunAlpha > 0.02) {
        const sunX = width * 0.76 - mouseX * 18;
        const sunY = height * 0.22 - mouseY * 12 - scrollNorm * 0.03;

        // Atmospheric golden bloom
        const bloom = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, Math.max(width, height) * 0.44);
        bloom.addColorStop(0, `rgba(255, 248, 214, ${0.86 * current.sunAlpha})`);
        bloom.addColorStop(0.14, `rgba(254, 224, 148, ${0.44 * current.sunAlpha})`);
        bloom.addColorStop(0.45, `rgba(251, 191, 36, ${0.14 * current.sunAlpha})`);
        bloom.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = bloom;
        ctx.fillRect(0, 0, width, height);

        // Volumetric diagonal god-rays
        ctx.save();
        ctx.translate(sunX, sunY);
        for (let r = 0; r < 5; r++) {
          const angle = 2.15 + r * 0.18 + Math.sin(elapsed * 0.35 + r) * 0.03;
          const rayLen = Math.max(width, height) * 0.95;
          const rayGrad = ctx.createLinearGradient(0, 0, Math.cos(angle) * rayLen, Math.sin(angle) * rayLen);
          const rayOpacity = (0.075 + (r % 2) * 0.03) * current.sunAlpha;
          rayGrad.addColorStop(0, `rgba(255, 243, 199, ${rayOpacity})`);
          rayGrad.addColorStop(0.65, `rgba(255, 236, 179, ${rayOpacity * 0.35})`);
          rayGrad.addColorStop(1, 'rgba(255, 236, 179, 0)');
          ctx.fillStyle = rayGrad;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle - 0.045) * rayLen, Math.sin(angle - 0.045) * rayLen);
          ctx.lineTo(Math.cos(angle + 0.045) * rayLen, Math.sin(angle + 0.045) * rayLen);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // Crisp solar core
        const core = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 54);
        core.addColorStop(0, `rgba(255, 254, 244, ${0.98 * current.sunAlpha})`);
        core.addColorStop(0.6, `rgba(254, 240, 185, ${0.75 * current.sunAlpha})`);
        core.addColorStop(1, 'rgba(254, 240, 185, 0)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 54, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Lunar disc + atmospheric halo (Night)
      if (current.moonAlpha > 0.02) {
        const moonX = width * 0.77 - mouseX * 16;
        const moonY = height * 0.21 - mouseY * 10 - scrollNorm * 0.025;

        const halo = ctx.createRadialGradient(moonX, moonY, 18, moonX, moonY, 240);
        halo.addColorStop(0, `rgba(219, 234, 254, ${0.36 * current.moonAlpha})`);
        halo.addColorStop(0.45, `rgba(147, 197, 253, ${0.12 * current.moonAlpha})`);
        halo.addColorStop(1, 'rgba(147, 197, 253, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 240, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.globalAlpha = current.moonAlpha;
        ctx.fillStyle = '#e8f1ff';
        ctx.beginPath();
        ctx.arc(moonX, moonY, 32, 0, Math.PI * 2);
        ctx.fill();

        // Subtle lunar mare shading
        ctx.fillStyle = 'rgba(148, 163, 184, 0.26)';
        ctx.beginPath();
        ctx.arc(moonX - 9, moonY - 5, 9, 0, Math.PI * 2);
        ctx.arc(moonX + 10, moonY + 7, 7, 0, Math.PI * 2);
        ctx.arc(moonX + 4, moonY - 11, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 5. Three parallax cloud depth strata
      if (current.cloudAlpha > 0.03) {
        for (let layer = 0; layer < 3; layer++) {
          const depthFactor = 0.45 + layer * 0.4;
          const pX = -mouseX * (16 + layer * 14);
          const pY = -mouseY * (8 + layer * 6) - scrollNorm * (0.02 + layer * 0.022);
          const speedBoost = 1 + current.stormStrength * 1.6 + current.rainAlpha * 0.6;

          for (let i = 0; i < clouds.length; i++) {
            const c = clouds[i];
            if (c.layer !== layer) continue;

            c.x += c.speed * speedBoost * dt;
            if (c.x > width + 260) {
              c.x = -260;
            }

            const cx = c.x + pX;
            const cy = c.y + pY;
            const alpha = current.cloudAlpha * (0.34 + layer * 0.2);
            const useDarkSprite =
              current.rainAlpha > 0.35 || current.stormStrength > 0.25 || current.moonAlpha > 0.4;
            const sprite = useDarkSprite ? darkPuff : brightPuff;

            ctx.globalAlpha = Math.min(0.95, alpha);
            for (let p = 0; p < c.puffs.length; p++) {
              const puff = c.puffs[p];
              const px = cx + puff.dx * c.scale;
              const py = cy + puff.dy * c.scale;
              const pr = puff.r * c.scale;
              ctx.drawImage(sprite, px - pr, py - pr, pr * 2, pr * 2);
            }
            ctx.globalAlpha = 1;
          }
          // Subtle horizon aerial depth between cloud layers
          if (depthFactor > 0.8 && current.fogAlpha > 0.35) {
            const mistBandY = height * (0.48 + Math.sin(elapsed * 0.22) * 0.03);
            const mistGrad = ctx.createLinearGradient(0, mistBandY - 120, 0, mistBandY + 140);
            mistGrad.addColorStop(0, 'rgba(216, 232, 238, 0)');
            mistGrad.addColorStop(0.5, `rgba(216, 232, 238, ${current.fogAlpha * 0.18})`);
            mistGrad.addColorStop(1, 'rgba(216, 232, 238, 0)');
            ctx.fillStyle = mistGrad;
            ctx.fillRect(0, mistBandY - 120, width, 260);
          }
        }
      }

      // 6. Lightning bolts & sky-sheet flash (Storm)
      if (current.stormStrength > 0.3 && !reducedMotionRef.current) {
        nextLightningAt -= dt;
        if (nextLightningAt <= 0 && !bolt) {
          bolt = buildLightning();
          nextLightningAt = 3.2 + Math.random() * 4.8;
        }
      }
      if (bolt) {
        if (bolt.flash > 0.01) {
          ctx.fillStyle = `rgba(212, 224, 255, ${bolt.flash * current.stormStrength})`;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.save();
        ctx.strokeStyle = `rgba(196, 181, 253, ${bolt.alpha * 0.45})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (const [x1, y1, x2, y2] of bolt.segments) {
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        }
        ctx.stroke();

        ctx.strokeStyle = `rgba(244, 248, 255, ${bolt.alpha})`;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();

        bolt.alpha -= rawDt * 2.8;
        bolt.flash -= rawDt * 2.1;
        if (bolt.alpha <= 0) bolt = null;
      }

      // 7. Distant Bengaluru plateau / Nandi hill silhouettes (2 parallax ranges)
      drawHills(
        height * 0.81,
        36,
        18,
        current.hillFar,
        mouseX * 22,
        -mouseY * 6 - scrollNorm * 0.04,
        140
      );
      drawHills(
        height * 0.885,
        28,
        14,
        current.hillNear,
        mouseX * 42,
        -mouseY * 12 - scrollNorm * 0.07,
        620
      );

      // 8. Layered fog ribbons over hills
      if (current.fogAlpha > 0.18) {
        for (let f = 0; f < 3; f++) {
          const drift = ((elapsed * (16 + f * 9) + f * 310) % (width + 420)) - 210;
          const fy = height * (0.64 + f * 0.11);
          const fGrad = ctx.createRadialGradient(drift, fy, 20, drift, fy, width * 0.36);
          fGrad.addColorStop(0, `rgba(218, 236, 240, ${current.fogAlpha * 0.24})`);
          fGrad.addColorStop(1, 'rgba(218, 236, 240, 0)');
          ctx.fillStyle = fGrad;
          ctx.fillRect(0, fy - 180, width, 360);
        }
      }

      // 9. US AQI atmospheric particulate haze veil (visible when AQI > 75)
      const hazeStrength = computeAqiHazeStrength(aqiRef.current);
      if (hazeStrength > 0.01) {
        const hazeGrad = ctx.createLinearGradient(0, height * 0.35, 0, height);
        hazeGrad.addColorStop(0, 'rgba(217, 146, 62, 0)');
        hazeGrad.addColorStop(0.7, `rgba(217, 146, 62, ${hazeStrength * 0.45})`);
        hazeGrad.addColorStop(1, `rgba(180, 108, 42, ${hazeStrength * 0.72})`);
        ctx.fillStyle = hazeGrad;
        ctx.fillRect(0, height * 0.35, width, height * 0.65);
      }

      // 10. Multi-depth rain streaks & bottom surface ripples (Rain / Storm)
      if (current.rainAlpha > 0.04) {
        const windTilt = current.stormStrength > 0.4 ? -0.34 : -0.18;
        ctx.lineCap = 'round';
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i];
          d.y += d.speed * (1 + current.stormStrength * 0.35) * dt;
          d.x += d.speed * windTilt * dt;

          if (d.y > height + 30) {
            if (d.depth > 0.85 && ripples.length < 24 && Math.random() > 0.65) {
              ripples.push({
                x: Math.max(0, Math.min(width, d.x)),
                y: height - 18 - Math.random() * 48,
                r: 2,
                maxR: 18 + Math.random() * 20,
                alpha: 0.42 * current.rainAlpha,
              });
            }
            d.y = -30 - Math.random() * 140;
            d.x = Math.random() * (width + 260) - 80;
          }
          if (d.x < -120) d.x = width + 80;

          const dx = d.len * windTilt;
          const dy = d.len;
          ctx.strokeStyle = `rgba(196, 228, 255, ${(0.16 + d.depth * 0.34) * current.rainAlpha})`;
          ctx.lineWidth = 0.7 + d.depth * 0.9;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + dx, d.y + dy);
          ctx.stroke();
        }

        // Draw expanding water ripples along the lower horizon
        for (let i = ripples.length - 1; i >= 0; i--) {
          const rp = ripples[i];
          rp.r += 34 * dt;
          rp.alpha -= 0.42 * dt;
          if (rp.alpha <= 0 || rp.r >= rp.maxR) {
            ripples.splice(i, 1);
            continue;
          }
          ctx.strokeStyle = `rgba(186, 230, 253, ${rp.alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.28, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 11. Drifting sun motes (Day) or warm fireflies (Night)
      if (current.moteAlpha > 0.04) {
        const isNightMode = current.moonAlpha > current.sunAlpha;
        for (let i = 0; i < motes.length; i++) {
          const m = motes[i];
          m.x += (m.vx + Math.sin(elapsed * 0.8 + m.phase) * 9) * dt;
          m.y += (m.vy * (isNightMode ? 0.55 : 0.4) + Math.cos(elapsed * 0.7 + m.phase) * 6) * dt;

          if (m.y < -20) m.y = height + 20;
          if (m.y > height + 20) m.y = -20;
          if (m.x < -20) m.x = width + 20;
          if (m.x > width + 20) m.x = -20;

          const pulse = 0.4 + 0.6 * Math.sin(elapsed * 2.1 + m.phase);
          const color = isNightMode
            ? `rgba(253, 224, 128, ${pulse * current.moteAlpha * 0.75})`
            : `rgba(255, 245, 204, ${pulse * current.moteAlpha * 0.48})`;

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(m.x - mouseX * 16, m.y - mouseY * 10, m.r * (isNightMode ? 1.15 : 1), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 12. Subtle atmospheric vignette for cinematic depth and UI edge framing
      if (cachedVignette) {
        ctx.fillStyle = cachedVignette;
        ctx.fillRect(0, 0, width, height);
      }

      // Adaptive pacing based on real compositor turnaround time:
      // Fast hardware GPUs stay fluid (~30-60fps); software renderers get breathing room
      const nextDelay = compositorLag > 28 ? Math.min(140, Math.round(compositorLag * 1.4)) : 32;
      timerId = window.setTimeout(() => {
        if (!isDisposed) {
          lastScheduledAt = performance.now();
          rafId = window.requestAnimationFrame(drawFrame);
        }
      }, nextDelay);
    };

    rafId = window.requestAnimationFrame(drawFrame);

    return () => {
      isDisposed = true;
      window.clearTimeout(timerId);
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="live-sky-canvas"
      data-scene={scene}
      aria-hidden="true"
      className="fixed inset-0 z-0 h-full w-full pointer-events-none"
    />
  );
}

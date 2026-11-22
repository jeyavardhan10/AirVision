import { useEffect, useRef } from 'react';
import type { WeatherScene } from '../types/airvision';

interface WeatherCursorProps {
  scene: WeatherScene;
  reducedMotion: boolean;
}

interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
  shape: 'spark' | 'drop' | 'puff' | 'star';
}

function particlePalette(scene: WeatherScene): { color: string; shape: TrailParticle['shape'] } {
  switch (scene) {
    case 'sunny':
      return { color: '253, 224, 118', shape: 'spark' };
    case 'rain':
      return { color: '125, 211, 252', shape: 'drop' };
    case 'storm':
      return { color: '196, 181, 253', shape: 'spark' };
    case 'night':
      return { color: '186, 230, 253', shape: 'star' };
    case 'fog':
      return { color: '153, 246, 228', shape: 'puff' };
    default:
      return { color: '226, 232, 240', shape: 'puff' };
  }
}

export function WeatherCursor({ scene, reducedMotion }: WeatherCursorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<WeatherScene>(scene);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    if (reducedMotion) return;
    if (typeof window === 'undefined') return;
    const isCoarse = window.matchMedia?.('(pointer: coarse)').matches;
    if (isCoarse) return;

    const canvas = canvasRef.current;
    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!canvas || !ring || !dot) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let visible = false;
    let hoverInteractive = false;
    let overInput = false;
    let lastSpawnX = -100;
    let lastSpawnY = -100;

    const particles: TrailParticle[] = [];

    const spawnParticles = (x: number, y: number, count: number, burst = false) => {
      const { color, shape } = particlePalette(sceneRef.current);
      for (let i = 0; i < count; i++) {
        if (particles.length > 72) particles.shift();
        const angle = burst ? (Math.PI * 2 * i) / count + Math.random() * 0.35 : Math.random() * Math.PI * 2;
        const speed = burst ? 45 + Math.random() * 85 : 10 + Math.random() * 26;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: shape === 'drop' && !burst ? 32 + Math.random() * 44 : Math.sin(angle) * speed,
          size: shape === 'puff' ? 3.2 + Math.random() * 3.8 : 1.8 + Math.random() * 2.2,
          alpha: burst ? 0.85 : 0.62,
          decay: burst ? 1.5 : 1.25,
          color,
          shape,
        });
      }
    };

    let rafId = 0;
    let lastTime = performance.now();

    const ensureLoop = () => {
      if (!rafId) {
        lastTime = performance.now();
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      visible = true;

      const target = e.target as HTMLElement | null;
      overInput = Boolean(target?.closest('input, textarea, select'));
      hoverInteractive = Boolean(target?.closest('button, a, [role="tab"], label'));

      const dist = Math.hypot(mouseX - lastSpawnX, mouseY - lastSpawnY);
      if (dist > 14 && !overInput) {
        spawnParticles(mouseX, mouseY, 1, false);
        lastSpawnX = mouseX;
        lastSpawnY = mouseY;
      }
      ensureLoop();
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      spawnParticles(e.clientX, e.clientY, 10, true);
      ensureLoop();
    };

    const onPointerLeave = () => {
      visible = false;
      ensureLoop();
    };

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);

    const tick = (now: number) => {
      rafId = 0;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      ringX += (mouseX - ringX) * 0.22;
      ringY += (mouseY - ringY) * 0.22;

      const showRing = visible && !overInput;
      ring.style.opacity = showRing ? '1' : '0';
      dot.style.opacity = showRing ? '1' : '0';

      const scale = hoverInteractive ? 1.45 : 1;
      ring.style.transform = `translate3d(${ringX - 18}px, ${ringY - 18}px, 0) scale(${scale})`;
      dot.style.transform = `translate3d(${mouseX - 3}px, ${mouseY - 3}px, 0)`;

      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.shape === 'drop') p.vy += 120 * dt;
        if (p.shape === 'puff') p.size += 5 * dt;
        p.alpha -= p.decay * dt;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        if (p.shape === 'drop') {
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * 0.55, p.size * 1.45, -0.18, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'star') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.fillRect(-p.size, -0.5, p.size * 2, 1);
          ctx.fillRect(-0.5, -p.size, 1, p.size * 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const settled = Math.hypot(mouseX - ringX, mouseY - ringY) < 0.4 && particles.length === 0;
      if (!settled) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 hidden md:block"
      />
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-50 hidden h-9 w-9 rounded-full border border-white/45 transition-[opacity] duration-150 md:block"
        style={{
          opacity: 0,
          boxShadow: '0 0 18px var(--sky-glow)',
        }}
      />
      <div
        ref={dotRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-50 hidden h-1.5 w-1.5 rounded-full bg-white transition-[opacity] duration-150 md:block"
        style={{ opacity: 0 }}
      />
    </>
  );
}

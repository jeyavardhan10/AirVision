import { useEffect, useRef, useState } from 'react';

export type SectionId = 'live' | 'forecast' | 'patterns' | 'estimator';

const SECTION_IDS: SectionId[] = ['live', 'forecast', 'patterns', 'estimator'];

export function useScrollTelemetry() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [activeSection, setActiveSection] = useState<SectionId>('live');

  useEffect(() => {
    let rafId = 0;

    const update = () => {
      rafId = 0;
      const y = window.scrollY;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setScrollY(y);
      setScrollProgress(Math.min(1, Math.max(0, y / maxScroll)));

      const probeY = y + window.innerHeight * 0.34;
      let current: SectionId = 'live';
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= probeY) {
          current = id;
        }
      }
      setActiveSection(current);
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return { scrollProgress, scrollY, activeSection };
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

export function useScrollReveal(reducedMotion: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '0px 0px -40px 0px', threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return { ref, revealed };
}

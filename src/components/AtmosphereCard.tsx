import type { MouseEvent, ReactNode } from 'react';
import { useRef } from 'react';

interface AtmosphereCardProps {
  children: ReactNode;
  className?: string;
  mode?: 'tilt' | 'steady';
  reducedMotion?: boolean;
  onClick?: () => void;
  asButton?: boolean;
  ariaLabel?: string;
  ariaPressed?: boolean;
}

/**
 * Interactive atmospheric glass card supporting:
 * - mode="tilt": subtle 3D perspective tilt + moving specular glare + spotlight border
 * - mode="steady": pointer-tracking spotlight border & subtle lift without 3D tilt (keeps charts/inputs rock-steady)
 */
export function AtmosphereCard({
  children,
  className = '',
  mode = 'tilt',
  reducedMotion = false,
  onClick,
  asButton = false,
  ariaLabel,
  ariaPressed,
}: AtmosphereCardProps) {
  const ref = useRef<HTMLDivElement | HTMLButtonElement | null>(null);

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty('--mx', `${x}px`);
    el.style.setProperty('--my', `${y}px`);

    if (mode === 'tilt' && !reducedMotion) {
      const rx = ((y / rect.height) - 0.5) * -9;
      const ry = ((x / rect.width) - 0.5) * 9;
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translate3d(0, -3px, 0)`;
    } else if (mode === 'steady' && !reducedMotion) {
      el.style.transform = 'translate3d(0, -2px, 0)';
    }
  };

  const handleMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0)';
  };

  const baseClass = `atmosphere-surface card-interactive rounded-2xl overflow-hidden ${className}`;

  if (asButton) {
    return (
      <button
        type="button"
        ref={ref as React.RefObject<HTMLButtonElement>}
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`${baseClass} text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300`}
      >
        <span className="card-glare" aria-hidden="true" />
        <div className="relative z-10 h-full">{children}</div>
      </button>
    );
  }

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={baseClass}
    >
      <span className="card-glare" aria-hidden="true" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

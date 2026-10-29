import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Detects whether the user has requested reduced motion via OS/browser settings.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}

/**
 * Animates a numeric metric from its previous value (or 0 on first viewport entry)
 * to `targetValue` once without restarting on repeated scroll up/down.
 */
export function useCountUp(
  targetValue: number,
  durationMs = 1100
): { value: number; ref: React.RefObject<HTMLDivElement | null> } {
  const prefersReduced = usePrefersReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(targetValue);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasEnteredViewportRef = useRef<boolean>(false);
  const prevTargetRef = useRef<number>(targetValue);

  useEffect(() => {
    if (prefersReduced) {
      setDisplayValue(targetValue);
      prevTargetRef.current = targetValue;
      return;
    }

    let rafId = 0;
    const animateFromTo = (fromVal: number, toVal: number) => {
      const startTime = performance.now();
      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        // Cubic ease-out
        const eased = 1 - Math.pow(1 - t, 3);
        const current = Math.round(fromVal + (toVal - fromVal) * eased);
        setDisplayValue(current);
        if (t < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          setDisplayValue(toVal);
        }
      };
      rafId = requestAnimationFrame(step);
    };

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setDisplayValue(targetValue);
      return;
    }

    if (hasEnteredViewportRef.current) {
      if (prevTargetRef.current !== targetValue) {
        animateFromTo(prevTargetRef.current, targetValue);
        prevTargetRef.current = targetValue;
      } else {
        setDisplayValue(targetValue);
      }
      return () => cancelAnimationFrame(rafId);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasEnteredViewportRef.current) {
            hasEnteredViewportRef.current = true;
            prevTargetRef.current = targetValue;
            animateFromTo(0, targetValue);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [targetValue, durationMs, prefersReduced]);

  return { value: displayValue, ref: containerRef };
}

/**
 * Provides pointer-reactive 3D magnetic translation & subtle perspective rotation
 * directly on a DOM ref without triggering React re-renders.
 */
export function useMagneticHover(maxShiftPx = 8, maxDeg = 5) {
  const prefersReduced = usePrefersReducedMotion();
  const elementRef = useRef<HTMLDivElement | null>(null);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (prefersReduced || !elementRef.current) return;
      const rect = elementRef.current.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      const tx = relX * maxShiftPx * 2;
      const ty = relY * maxShiftPx * 2;
      const rx = -relY * maxDeg * 2;
      const ry = relX * maxDeg * 2;
      elementRef.current.style.transform = `perspective(700px) translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`;
    },
    [prefersReduced, maxShiftPx, maxDeg]
  );

  const onPointerLeave = useCallback(() => {
    if (!elementRef.current) return;
    elementRef.current.style.transform =
      'perspective(700px) translate3d(0px, 0px, 0px) rotateX(0deg) rotateY(0deg)';
  }, []);

  return { elementRef, onPointerMove, onPointerLeave };
}

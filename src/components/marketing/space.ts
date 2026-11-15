import { useEffect, type CSSProperties } from 'react';
import Lenis from 'lenis';

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Marks <html> as a space page (dark root background) while mounted. */
export function useSpaceRoot() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('space-root');
    return () => root.classList.remove('space-root');
  }, []);
}

/** Lenis smooth scroll (skipped under reduced motion). */
export function useLenis() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true, touchMultiplier: 1.5 });
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
}

/**
 * Staggered scroll reveal for every [data-reveal] under `root`.
 * Re-scans whenever `key` changes (route changes) and picks up nodes added later.
 */
export function useReveal(key: unknown, root: () => HTMLElement | null = () => document.body) {
  useEffect(() => {
    const scope = root();
    if (!scope) return;
    const pending = () => Array.from(scope.querySelectorAll<HTMLElement>('[data-reveal]:not(.in)'));

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      const showAll = () => pending().forEach((el) => el.classList.add('in'));
      showAll();
      const mo = new MutationObserver(showAll);
      mo.observe(scope, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    // Once revealed, drop the stagger delay so hover transitions are instant.
    const clearDelay = (e: TransitionEvent) => {
      const el = e.target as HTMLElement;
      if (el.hasAttribute('data-reveal') && el.classList.contains('in')) el.style.setProperty('--rd', '0ms');
    };
    scope.addEventListener('transitionend', clearDelay);

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    );
    const seen = new WeakSet<Element>();
    const observeAll = () =>
      pending().forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    observeAll();
    const mo = new MutationObserver(observeAll);
    mo.observe(scope, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      scope.removeEventListener('transitionend', clearDelay);
    };
  }, [key]);
}

/** Inline style helper for the per-element reveal delay. */
export const rd = (ms: number) => ({ '--rd': `${ms}ms` }) as CSSProperties;

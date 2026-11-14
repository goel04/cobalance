import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../space';

/** Fixed full-viewport WebGL planet. Falls back to the static space backdrop if WebGL is unavailable. */
export function PlanetCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    // three.js is loaded lazily so it never weighs on the app or the other pages.
    import('./scene')
      .then(({ createPlanetScene }) => {
        if (cancelled) return;
        dispose = createPlanetScene(canvas, { reducedMotion: prefersReducedMotion() });
      })
      .catch((err) => {
        console.warn('[planet] WebGL scene unavailable', err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return (
    <>
      <div className="space-backdrop" aria-hidden />
      {!failed && <canvas ref={ref} className="planet-canvas" aria-hidden />}
    </>
  );
}

import { useEffect, useRef } from 'react';
import type { FluidScene } from './fluidScene';

/** Decorative only: message selection, scrolling and controls keep their normal input events. */
export function FluidBackdrop({ paused }: { paused: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<FluidScene | undefined>(undefined);
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; scene.current?.setPaused(paused); }, [paused]);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false; let generation = 0;
    async function setup() {
      const current = ++generation;
      scene.current?.dispose(); scene.current = undefined;
      if (motion.matches || !host.current?.parentElement) return;
      try {
        const { createFluidScene } = await import('./fluidScene');
        if (disposed || current !== generation || !host.current?.parentElement) return;
        scene.current = createFluidScene(host.current, host.current.parentElement);
        scene.current.setPaused(pausedRef.current);
      } catch { /* The CSS fallback remains available if WebGL is unsupported. */ }
    }
    motion.addEventListener('change', setup); void setup();
    return () => { disposed = true; ++generation; motion.removeEventListener('change', setup); scene.current?.dispose(); scene.current = undefined; };
  }, []);
  return <div className="ms-fluid-backdrop" ref={host} aria-hidden="true"/>;
}

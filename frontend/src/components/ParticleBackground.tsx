import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { ParticleScene } from './particleScene';

export function ParticleBackground() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ParticleScene | null>(null);
  const pausedRef = useRef(false);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let generation = 0;
    let disposed = false;
    const setup = async () => {
      const current = ++generation;
      scene.current?.dispose(); scene.current = null; setActive(false);
      if (motion.matches || !host.current) return;
      try {
        const { createParticleScene } = await import('./particleScene');
        if (disposed || current !== generation || !host.current) return;
        scene.current = createParticleScene(host.current,
          () => { if (!disposed && current === generation) setActive(true); },
          () => { if (!disposed && current === generation) setActive(false); },
        );
        scene.current.setPaused(pausedRef.current);
      } catch { if (!disposed && current === generation) setActive(false); }
    };
    motion.addEventListener('change', setup);
    void setup();
    return () => {
      disposed = true; generation++;
      motion.removeEventListener('change', setup);
      scene.current?.dispose(); scene.current = null;
    };
  }, []);
  function toggle() {
    const next = !paused; pausedRef.current = next; setPaused(next); scene.current?.setPaused(next);
  }
  return <>
    <div className={`gp-particles${active ? ' is-active' : ''}`} ref={host} aria-hidden="true" />
    {active && <button className="gp-motion-control" type="button" onClick={toggle} aria-label={paused ? 'Play background animation' : 'Pause background animation'} title={paused ? 'Play background animation' : 'Pause background animation'} aria-pressed={paused}>
      {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
    </button>}
  </>;
}

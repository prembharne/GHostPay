import {
  AdditiveBlending, BufferAttribute, BufferGeometry, NoToneMapping,
  OrthographicCamera, Points, Scene, ShaderMaterial, Vector2, WebGLRenderer,
} from 'three';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uLayer;
  uniform float uPixelRatio;
  uniform float uAspect;
  uniform vec2 uPointer;
  varying float vLight;
  varying float vAlpha;

  void main() {
    float seed = position.z;
    float x = position.x;
    float y;
    float depth;
    float pointSize;

    if (uLayer < 1.5) {
      float across = position.y;
      float phase = x * 2.9 + uTime * 0.34 + uLayer * 1.85;
      float width = 0.30 + 0.055 * sin(x * 3.0 - uTime * 0.2);
      float center = 0.25 + 0.095 * sin(x * 3.1 + uTime * 0.23);
      y = center + across * width * cos(phase);
      y += 0.055 * sin(x * 4.0 - uTime * 0.28 + across * 1.65 + uLayer);
      depth = across * sin(phase) * 0.72;
      // Tiny independent movements prevent the surface looking like a rigid mesh.
      x += 0.002 * sin(seed * 90.0 + uTime * 0.7);
      y += 0.003 * cos(seed * 70.0 + uTime * 0.6);
      float fold = pow(abs(sin(phase)), 7.0);
      vLight = 0.24 + 0.34 * pow(1.0 - abs(across), 0.45) + fold * 0.28;
      vLight *= 0.76 + 0.24 * sin(seed * 42.0 + uTime * 0.35);
      vAlpha = (1.0 - smoothstep(0.92, 1.32, abs(x))) * 0.72;
      pointSize = 1.0 + seed * 1.15 + fold * 0.55;
    } else {
      // A separate, sparse volume gives the ribbon a drifting halo of particles.
      y = (fract((position.y + 1.2) / 2.4 + uTime * 0.006) - 0.5) * 2.4;
      x += 0.014 * sin(seed * 55.0 + uTime * 0.19);
      y += 0.012 * cos(seed * 38.0 + uTime * 0.22);
      depth = seed * 0.7 - 0.35;
      vLight = 0.12 + pow(seed, 5.0) * 0.65;
      vAlpha = 0.30 * (1.0 - smoothstep(0.85, 1.2, abs(y)));
      pointSize = 0.8 + seed * 1.7;
    }

    float perspective = 1.0 / (1.0 - depth * 0.19);
    vec2 cover = vec2(max(1.0, 1.7 / uAspect), max(1.0, uAspect / 1.7));
    vec2 screen = vec2(x, y) * perspective * cover;
    screen += uPointer * (0.012 + depth * 0.018);
    // Leave the copy at the bottom readable while particles still drift behind it.
    vAlpha *= mix(0.23, 1.0, smoothstep(-0.65, 0.05, screen.y));
    gl_Position = vec4(screen, 0.0, 1.0);
    gl_PointSize = pointSize * uPixelRatio;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying float vLight;
  varying float vAlpha;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
    if (radius > 1.0) discard;
    float softDot = exp(-radius * radius * 3.2) * (1.0 - smoothstep(0.65, 1.0, radius));
    gl_FragColor = vec4(vec3(vLight), softDot * vAlpha);
  }
`;

export interface ParticleScene {
  setPaused: (paused: boolean) => void;
  dispose: () => void;
}

/** GPU-animated point clouds; no video, texture animation, or per-frame buffer uploads. */
export function createParticleScene(host: HTMLElement, ready: () => void, failed: () => void): ParticleScene {
  const compact = window.matchMedia('(max-width: 900px)').matches;
  const renderer = new WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.5));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;
  const pointer = new Vector2();
  const targetPointer = new Vector2();
  const uniforms = {
    uTime: { value: 4.7 }, uPixelRatio: { value: renderer.getPixelRatio() },
    uAspect: { value: 1.7 }, uPointer: { value: pointer },
  };
  const geometries: BufferGeometry[] = [];
  const materials: ShaderMaterial[] = [];
  // Seeded distribution stays stable through React remounts and resize events.
  let state = 31737;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let layer = 0; layer < 3; layer++) {
    const count = layer === 2 ? (compact ? 5500 : 18000) : (compact ? 34000 : 92000);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (random() * 2 - 1) * 1.32;
      positions[i * 3 + 1] = (random() * 2 - 1) * (layer === 2 ? 1.2 : 1);
      positions[i * 3 + 2] = random();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const material = new ShaderMaterial({
      uniforms: { ...uniforms, uLayer: { value: layer } }, vertexShader, fragmentShader,
      transparent: true, blending: AdditiveBlending, depthTest: false, depthWrite: false,
    });
    const particles = new Points(geometry, material);
    particles.frustumCulled = false;
    scene.add(particles); geometries.push(geometry); materials.push(material);
  }

  let disposed = false;
  let paused = false;
  let intersecting = true;
  let broken = false;
  let firstFrame = true;
  let lastFrame = 0;
  const interval = 1000 / (compact ? 30 : 60);
  function stopWithFallback() {
    if (broken || disposed) return;
    broken = true; renderer.setAnimationLoop(null); failed();
  }
  renderer.debug.onShaderError = stopWithFallback;
  const resize = () => {
    if (disposed || broken) return;
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    uniforms.uAspect.value = width / height;
    renderer.setSize(width, height, false);
    if (paused || document.hidden) renderFrame();
  };
  function renderFrame() {
    try {
      renderer.render(scene, camera);
      if (firstFrame && !broken) { firstFrame = false; ready(); }
    } catch { stopWithFallback(); }
  }
  const animate = (timestamp: number) => {
    if (disposed || broken || paused || document.hidden || !intersecting) return;
    const delta = timestamp - lastFrame;
    if (delta < interval - 1) return;
    uniforms.uTime.value += lastFrame ? Math.min(delta / 1000, 0.05) : 0;
    lastFrame = timestamp;
    pointer.lerp(targetPointer, 0.035);
    renderFrame();
  };
  const updatePlayback = () => {
    if (disposed || broken) return;
    lastFrame = 0;
    renderer.setAnimationLoop(paused || document.hidden || !intersecting ? null : animate);
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    targetPointer.set(event.clientX / window.innerWidth * 2 - 1, 1 - event.clientY / window.innerHeight * 2);
  };
  const leave = () => targetPointer.set(0, 0);
  const lost = (event: Event) => { event.preventDefault(); stopWithFallback(); };
  const observer = new ResizeObserver(resize);
  const visibility = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; updatePlayback(); });
  observer.observe(host); visibility.observe(host);
  window.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerleave', leave);
  document.addEventListener('visibilitychange', updatePlayback);
  renderer.domElement.addEventListener('webglcontextlost', lost);
  resize(); renderFrame(); updatePlayback();

  return {
    setPaused(value) { paused = value; updatePlayback(); },
    dispose() {
      disposed = true; renderer.setAnimationLoop(null);
      observer.disconnect(); visibility.disconnect();
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', updatePlayback);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}

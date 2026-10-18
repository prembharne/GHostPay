import { Mesh, NoToneMapping, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderer } from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uAspect;
  uniform float uActivity;
  uniform vec2 uPointer;
  uniform vec3 uRipples[4];
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
  }
  float flow(vec2 p) {
    float result = 0.0, weight = 0.5;
    for (int i = 0; i < 4; i++) { result += weight * noise(p); p = mat2(1.6, -1.2, 1.2, 1.6) * p + 3.1; weight *= 0.5; }
    return result;
  }
  void main() {
    vec2 scale = vec2(uAspect, 1.0);
    vec2 p = (vUv - 0.5) * scale * 2.9;
    vec2 delta = (vUv - uPointer) * scale;
    float distanceToPointer = length(delta);
    float influence = exp(-dot(delta, delta) * 3.8) * uActivity;
    p += vec2(-delta.y, delta.x) * influence * 1.65;
    p += delta * influence * sin(uTime * 0.9 - distanceToPointer * 8.0) * 0.48;
    float ripples = 0.0;
    for (int i = 0; i < 4; i++) {
      float age = uTime - uRipples[i].z;
      float d = length((vUv - uRipples[i].xy) * scale);
      float band = (d - age * 0.25) * 22.0;
      float ring = exp(-band * band) * exp(-age * 1.05);
      ring *= step(0.0, age) * (1.0 - step(6.0, age));
      p += (vUv - uRipples[i].xy) * ring * 0.3; ripples += ring;
    }
    float t = uTime * 0.13;
    vec2 warp = vec2(flow(p * 0.72 + vec2(t, -t * 0.6)), flow(p * 0.67 + vec2(-t * 0.5, t) + 6.0));
    float fold = p.y + 0.58 * sin(p.x * 0.92 - t) + (warp.x - 0.5) * 1.4;
    float wave = 0.5 + 0.5 * sin(fold * 4.2 + warp.y * 3.8);
    float ribbon = pow(wave, 15.0);
    float shoulder = pow(wave, 3.0);
    float sheen = 0.55 + 0.45 * sin(p.x * 1.3 + warp.x * 4.0 + t);
    float vignette = 1.0 - smoothstep(0.15, 0.9, length(vUv - 0.5));
    float light = (ribbon * (0.045 + sheen * 0.10) + shoulder * 0.017) * (0.35 + vignette * 0.65);
    light += influence * 0.018 + ripples * 0.04;
    vec3 color = vec3(0.027, 0.028, 0.032) + light * vec3(0.96, 0.98, 1.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface FluidScene { setPaused(value: boolean): void; dispose(): void }

/** A procedural liquid-light shader, not a physical fluid simulation. */
export function createFluidScene(host: HTMLElement, interaction: HTMLElement): FluidScene {
  const compact = window.matchMedia('(max-width: 900px)').matches;
  const renderer = new WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' });
  renderer.toneMapping = NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.25));
  renderer.domElement.setAttribute('aria-hidden', 'true'); host.append(renderer.domElement);
  const scene = new Scene(); const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pointer = new Vector2(0.65, 0.5); const target = pointer.clone();
  const ripples = Array.from({ length: 4 }, () => new Vector3(-10, -10, -10));
  const uniforms = { uTime: { value: 8 }, uAspect: { value: 1 }, uPointer: { value: pointer }, uActivity: { value: 0 }, uRipples: { value: ripples } };
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false });
  scene.add(new Mesh(geometry, material));
  let disposed = false; let paused = false; let visible = true; let broken = false;
  let lastFrame = 0; let active = 0; let rippleIndex = 0;
  let bounds = interaction.getBoundingClientRect();
  const interval = 1000 / (compact ? 30 : 45);
  const fail = () => { broken = true; renderer.setAnimationLoop(null); renderer.domElement.style.opacity = '0'; };
  renderer.debug.onShaderError = fail;
  function draw() { if (!disposed && !broken) { try { renderer.render(scene, camera); } catch { fail(); } } }
  function animate(timestamp: number) {
    if (disposed || broken || paused || document.hidden || !visible) return;
    const elapsed = timestamp - lastFrame; if (elapsed < interval - 1) return;
    const dt = lastFrame ? Math.min(elapsed / 1000, 0.08) : 0; lastFrame = timestamp;
    uniforms.uTime.value += dt;
    pointer.lerp(target, 1 - Math.exp(-dt * 5));
    uniforms.uActivity.value += (active - uniforms.uActivity.value) * (1 - Math.exp(-dt * 3));
    draw();
  }
  function playback() { lastFrame = 0; renderer.setAnimationLoop(disposed || broken || paused || document.hidden || !visible ? null : animate); }
  function resize() {
    if (disposed || broken) return;
    bounds = interaction.getBoundingClientRect();
    const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1);
    uniforms.uAspect.value = width / height;
    renderer.setSize(width, height, false); draw();
  }
  function move(event: PointerEvent) {
    if (paused || bounds.width <= 0 || bounds.height <= 0) return;
    target.set(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), Math.max(0, Math.min(1, 1 - (event.clientY - bounds.top) / bounds.height))); active = 1;
  }
  const enter = (event: PointerEvent) => { bounds = interaction.getBoundingClientRect(); move(event); };
  const leave = () => { active = 0; };
  const press = (event: PointerEvent) => { if (paused) return; move(event); ripples[rippleIndex++ % ripples.length].set(target.x, target.y, uniforms.uTime.value); };
  const lost = (event: Event) => { event.preventDefault(); fail(); };
  const resizeObserver = new ResizeObserver(resize);
  const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; playback(); });
  resizeObserver.observe(host); visibility.observe(host);
  interaction.addEventListener('pointerenter', enter, { passive: true });
  interaction.addEventListener('pointermove', move, { passive: true });
  interaction.addEventListener('pointerdown', press, { passive: true });
  interaction.addEventListener('pointerleave', leave, { passive: true });
  document.addEventListener('visibilitychange', playback);
  renderer.domElement.addEventListener('webglcontextlost', lost);
  resize(); playback();
  return {
    setPaused(value) { paused = value; playback(); },
    dispose() {
      disposed = true; renderer.setAnimationLoop(null); resizeObserver.disconnect(); visibility.disconnect();
      interaction.removeEventListener('pointerenter', enter); interaction.removeEventListener('pointermove', move);
      interaction.removeEventListener('pointerdown', press); interaction.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', playback); renderer.domElement.removeEventListener('webglcontextlost', lost);
      geometry.dispose(); material.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}

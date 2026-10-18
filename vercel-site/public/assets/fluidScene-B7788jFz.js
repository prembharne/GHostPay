import{W as F,N as I,S as V,O as k,V as G,c as N,d as _,b as D,M as H}from"./three.module-BOLSB0gz.js";const X=`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`,Y=`
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
`;function q(a,n){const b=window.matchMedia("(max-width: 900px)").matches,t=new F({alpha:!1,antialias:!1,powerPreference:"low-power"});t.toneMapping=I,t.setPixelRatio(Math.min(window.devicePixelRatio||1,b?1:1.25)),t.domElement.setAttribute("aria-hidden","true"),a.append(t.domElement);const y=new V,C=new k(-1,1,1,-1,0,1),f=new G(.65,.5),p=f.clone(),m=Array.from({length:4},()=>new N(-10,-10,-10)),o={uTime:{value:8},uAspect:{value:1},uPointer:{value:f},uActivity:{value:0},uRipples:{value:m}},E=new _(2,2),L=new D({vertexShader:X,fragmentShader:Y,uniforms:o,depthTest:!1,depthWrite:!1});y.add(new H(E,L));let s=!1,r=!1,h=!0,l=!1,d=0,g=0,O=0,i=n.getBoundingClientRect();const W=1e3/(b?30:45),w=()=>{l=!0,t.setAnimationLoop(null),t.domElement.style.opacity="0"};t.debug.onShaderError=w;function M(){if(!s&&!l)try{t.render(y,C)}catch{w()}}function B(e){if(s||l||r||document.hidden||!h)return;const v=e-d;if(v<W-1)return;const x=d?Math.min(v/1e3,.08):0;d=e,o.uTime.value+=x,f.lerp(p,1-Math.exp(-x*5)),o.uActivity.value+=(g-o.uActivity.value)*(1-Math.exp(-x*3)),M()}function c(){d=0,t.setAnimationLoop(s||l||r||document.hidden||!h?null:B)}function A(){if(s||l)return;i=n.getBoundingClientRect();const e=Math.max(a.clientWidth,1),v=Math.max(a.clientHeight,1);o.uAspect.value=e/v,t.setSize(e,v,!1),M()}function u(e){r||i.width<=0||i.height<=0||(p.set(Math.max(0,Math.min(1,(e.clientX-i.left)/i.width)),Math.max(0,Math.min(1,1-(e.clientY-i.top)/i.height))),g=1)}const R=e=>{i=n.getBoundingClientRect(),u(e)},P=()=>{g=0},T=e=>{r||(u(e),m[O++%m.length].set(p.x,p.y,o.uTime.value))},S=e=>{e.preventDefault(),w()},U=new ResizeObserver(A),z=new IntersectionObserver(([e])=>{h=e.isIntersecting,c()});return U.observe(a),z.observe(a),n.addEventListener("pointerenter",R,{passive:!0}),n.addEventListener("pointermove",u,{passive:!0}),n.addEventListener("pointerdown",T,{passive:!0}),n.addEventListener("pointerleave",P,{passive:!0}),document.addEventListener("visibilitychange",c),t.domElement.addEventListener("webglcontextlost",S),A(),c(),{setPaused(e){r=e,c()},dispose(){s=!0,t.setAnimationLoop(null),U.disconnect(),z.disconnect(),n.removeEventListener("pointerenter",R),n.removeEventListener("pointermove",u),n.removeEventListener("pointerdown",T),n.removeEventListener("pointerleave",P),document.removeEventListener("visibilitychange",c),t.domElement.removeEventListener("webglcontextlost",S),E.dispose(),L.dispose(),t.dispose(),t.domElement.remove()}}}export{q as createFluidScene};

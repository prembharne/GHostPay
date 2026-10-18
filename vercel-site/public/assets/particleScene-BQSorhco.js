import{W as G,N as H,S as I,O as N,B as V,a as X,b as Y,A as j,V as k,P as q}from"./three.module-BOLSB0gz.js";const J=`
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
`,K=`
  precision highp float;
  varying float vLight;
  varying float vAlpha;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
    if (radius > 1.0) discard;
    float softDot = exp(-radius * radius * 3.2) * (1.0 - smoothstep(0.65, 1.0, radius));
    gl_FragColor = vec4(vec3(vLight), softDot * vAlpha);
  }
`;function U(n,B,O){const l=window.matchMedia("(max-width: 900px)").matches,t=new G({alpha:!1,antialias:!1,powerPreference:"low-power"});t.setClearColor(0,1),t.toneMapping=H,t.setPixelRatio(Math.min(window.devicePixelRatio||1,l?1.25:1.5)),t.domElement.setAttribute("aria-hidden","true"),n.append(t.domElement);const b=new I,x=new N(-1,1,1,-1,.1,10);x.position.z=2;const L=new k,p=new k,m={uTime:{value:4.7},uPixelRatio:{value:t.getPixelRatio()},uAspect:{value:1.7},uPointer:{value:L}},A=[],P=[];let f=31737;const v=()=>(f=Math.imul(f,1664525)+1013904223>>>0,f/4294967296);for(let e=0;e<3;e++){const i=e===2?l?5500:18e3:l?34e3:92e3,u=new Float32Array(i*3);for(let r=0;r<i;r++)u[r*3]=(v()*2-1)*1.32,u[r*3+1]=(v()*2-1)*(e===2?1.2:1),u[r*3+2]=v();const y=new V;y.setAttribute("position",new X(u,3));const F=new Y({uniforms:{...m,uLayer:{value:e}},vertexShader:J,fragmentShader:K,transparent:!0,blending:j,depthTest:!1,depthWrite:!1}),W=new q(y,F);W.frustumCulled=!1,b.add(W),A.push(y),P.push(F)}let s=!1,c=!1,h=!0,o=!1,T=!0,d=0;const _=1e3/(l?30:60);function g(){o||s||(o=!0,t.setAnimationLoop(null),O())}t.debug.onShaderError=g;const E=()=>{if(s||o)return;const e=Math.max(n.clientWidth,1),i=Math.max(n.clientHeight,1);m.uAspect.value=e/i,t.setSize(e,i,!1),(c||document.hidden)&&w()};function w(){try{t.render(b,x),T&&!o&&(T=!1,B())}catch{g()}}const D=e=>{if(s||o||c||document.hidden||!h)return;const i=e-d;i<_-1||(m.uTime.value+=d?Math.min(i/1e3,.05):0,d=e,L.lerp(p,.035),w())},a=()=>{s||o||(d=0,t.setAnimationLoop(c||document.hidden||!h?null:D))},S=e=>{e.pointerType==="mouse"&&p.set(e.clientX/window.innerWidth*2-1,1-e.clientY/window.innerHeight*2)},z=()=>p.set(0,0),M=e=>{e.preventDefault(),g()},R=new ResizeObserver(E),C=new IntersectionObserver(([e])=>{h=e.isIntersecting,a()});return R.observe(n),C.observe(n),window.addEventListener("pointermove",S,{passive:!0}),document.addEventListener("pointerleave",z),document.addEventListener("visibilitychange",a),t.domElement.addEventListener("webglcontextlost",M),E(),w(),a(),{setPaused(e){c=e,a()},dispose(){s=!0,t.setAnimationLoop(null),R.disconnect(),C.disconnect(),window.removeEventListener("pointermove",S),document.removeEventListener("pointerleave",z),document.removeEventListener("visibilitychange",a),t.domElement.removeEventListener("webglcontextlost",M),A.forEach(e=>e.dispose()),P.forEach(e=>e.dispose()),t.dispose(),t.domElement.remove()}}}export{U as createParticleScene};

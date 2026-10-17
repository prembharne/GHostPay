# Landing-page assets

- The default background is a live Three.js particle scene in `src/components/particleScene.ts`, loaded on demand by `ParticleBackground.tsx`. Two silver point-cloud ribbons twist continuously through a sparse drifting particle field; the GPU animates positions with shader uniforms rather than uploading geometry every frame. A pause/play control freezes/resumes the scene. Rendering pauses in hidden tabs or when the scene is offscreen; mobile particle count, frame rate, and pixel ratio are capped. GPU resources and listeners are disposed when leaving the homepage.
- `public/hero-wave.jpg` is the fallback for reduced-motion preferences, unavailable WebGL, shader/context failure, and the initial scene download. It is a frame at 5.5 seconds, extracted at 1920 × 1080 from the exact MP4 supplied in the user's design brief. No video element or video playback is used. The original source is `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4`.
- `public/inter.woff2` is the Inter variable roman Latin subset, downloaded from the exact Google Fonts CSS specified in the brief.
- `public/instrument-serif-italic.woff2` is the Instrument Serif italic Latin subset from the same CSS. It is used for the word “crypto” in the homepage heading.
- Font license texts are in `public/licenses/`.
- Remaining marks and icons are inline SVG via Lucide. The tiny grain texture is a CSS-embedded SVG filter, with no external asset dependency.

The homepage uses GhostPay branding, accurate payment copy, and existing payment routes, as explicitly confirmed by the user. It adapts the supplied Vesper layout rather than copying that product's name, AI-agent claims, or customer statistics. The navigation's informational items open native dialogs so the desktop landing page remains a single viewport; payment links navigate to the real app.

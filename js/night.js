import * as THREE from 'three';

// Original Gengar illustration and iris-light shader from the previous site.
// The original <img> supplies the full-resolution artwork. This transparent
// canvas only paints the illuminated areas, so its FX budget cannot blur it.
export async function createNight(parent) {
  const container = parent.querySelector('.night-landscape');
  const img = container.querySelector('img');
  const button = parent.querySelector('.night-wake');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motion.matches;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  let renderer, texture;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    texture = await new THREE.TextureLoader().loadAsync(img.getAttribute('src'));
  } catch (err) {
    renderer?.dispose();
    parent.dataset.gengarState = 'static';
    return;
  }
  container.append(canvas);
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const uniforms = {
    uImage: { value: texture }, uTime: { value: 0 }, uReaction: { value: 0 },
    uMotion: { value: reduced ? 0 : 1 },
    uScale: { value: new THREE.Vector2(1, 1) }, uOrigin: { value: new THREE.Vector2() },
  };
  const material = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, uniforms,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uImage;
      uniform float uTime, uReaction, uMotion;
      uniform vec2 uScale, uOrigin;
      float oval(vec2 p, vec2 center, vec2 radius) {
        return 1. - smoothstep(.5, 1., length((p - center) / radius));
      }
      void main() {
        vec2 uv = vUv * uScale + uOrigin;
        // Match the HTML image crop exactly; only the light moves, never the art.
        vec4 color = texture2D(uImage, clamp(uv, vec2(.001), vec2(.999)));
        float eyeArea = oval(uv, vec2(.738, .542), vec2(.122, .14));
        float red = clamp((color.r - max(color.b, color.g)) * 3.3, 0., 1.) * eyeArea;
        float wake = (.13 + .05 * sin(uTime * 1.2)) * uMotion + uReaction * .75;
        color.rgb += vec3(1., .075, .035) * red * wake;
        float lantern = oval(uv, vec2(.973, .693), vec2(.037, .088));
        color.rgb += vec3(.10, .048, .007) * lantern * (.5 + .5 * sin(uTime * 2.3)) * .12 * uMotion;
        float lightMask = max(smoothstep(.005, .12, red) * step(.001, wake), lantern * .12 * uMotion);
        gl_FragColor = vec4(color.rgb, lightMask);
        #include <colorspace_fragment>
      }
    `,
  });
  const scene = new THREE.Scene(), camera = new THREE.Camera();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  let active = false, raf = 0, last = 0, reaction = 0, reactionUntil = 0, timer;

  function requestFrame() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    if (!active || document.hidden || renderer.getContext().isContextLost()) return;
    if (now - last < 32) { requestFrame(); return; }
    const dt = Math.min((now - last) / 1000, .06), damping = 1 - Math.exp(-5 * dt);
    last = now;
    const pulsing = now < reactionUntil;
    const target = pulsing ? 1.5 : reduced ? 0 : reaction;
    uniforms.uTime.value = now / 1000;
    uniforms.uReaction.value = THREE.MathUtils.lerp(uniforms.uReaction.value, target, damping);
    uniforms.uMotion.value = reduced ? 0 : 1;
    renderer.render(scene, camera);
    if (!reduced || pulsing || Math.abs(uniforms.uReaction.value - target) > .002) requestFrame();
  }
  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const aspect = width / height, imageAspect = texture.image.width / texture.image.height;
    const sx = aspect > imageAspect ? 1 : aspect / imageAspect;
    const sy = aspect > imageAspect ? imageAspect / aspect : 1;
    const [px, py] = getComputedStyle(img).objectPosition.split(' ').map(parseFloat);
    uniforms.uScale.value.set(sx, sy);
    uniforms.uOrigin.value.set((1 - sx) * px / 100, (1 - sy) * (1 - py / 100));
    renderer.render(scene, camera);
    requestFrame();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  container.classList.add('art-ready');
  button.hidden = false;

  parent.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const r = parent.getBoundingClientRect();
    reaction = event.clientX - r.left > r.width * .53 ? 1 : .25;
    requestFrame();
  });
  parent.addEventListener('pointerleave', () => { reaction = 0; requestFrame(); });
  button.addEventListener('click', () => {
    reactionUntil = performance.now() + 2200;
    parent.dataset.gengarState = 'awake';
    clearTimeout(timer);
    timer = setTimeout(() => { parent.dataset.gengarState = 'idle'; requestFrame(); }, 2200);
    requestFrame();
  });
  new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
    if (active) requestFrame();
  }, { rootMargin: '100px' }).observe(parent);
  motion.addEventListener('change', (event) => { reduced = event.matches; requestFrame(); });
  document.addEventListener('visibilitychange', requestFrame);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    container.classList.remove('art-ready');
    button.hidden = true;
    parent.dataset.gengarState = 'static';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    resize(); container.classList.add('art-ready'); button.hidden = false;
    parent.dataset.gengarState = 'idle'; requestFrame();
  });
}

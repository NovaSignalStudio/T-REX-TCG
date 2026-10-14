// T-REX TCG — scena 3D dell'apertura della busta.
// Una busta in foil generata via shader si strappa allo scroll, ne escono quattro carte
// con effetto holo reale (foil, scintille, riflesso) che reagisce all'angolo di vista.
import * as THREE from 'three';

const CARD_W = 2.5, CARD_H = 3.5;
const PACK_W = CARD_W * 1.2, PACK_H = CARD_H * 1.34;
const CUT = 0.885; // altezza dello strappo, in uv della busta

// ————————————————————————————————————————— shader comuni
const COMMON = /* glsl */`
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.,0.)), c = hash(i + vec2(0.,1.)), d = hash(i + vec2(1.,1.));
    vec2 u = f*f*(3.-2.*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
  }
  float fbm(vec2 p){ float v = 0., a = .5; for(int i=0;i<4;i++){ v += a*noise(p); p *= 2.03; a *= .5; } return v; }
  vec3 rainbow(float t){ return .5 + .5*cos(6.28318*(t + vec3(0., .33, .67))); }
`;

const VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vView;
  varying vec3 vLight;
  varying vec3 vNormal;
  void main(){
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.);
    mat3 inv = transpose(mat3(modelMatrix));
    vView  = inv * (cameraPosition - wp.xyz);
    vLight = inv * normalize(vec3(-.35, .75, 1.));
    vNormal = normal;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// la striscia si stacca colonna per colonna, da sinistra a destra, piegandosi verso l'alto come plastica vera
const STRIP_VERT = /* glsl */`
  uniform float uTearX;
  uniform float uBaseY;
  uniform float uFlipX;
  varying vec2 vUv;
  varying vec3 vView;
  varying vec3 vLight;
  varying vec3 vNormal;
  void main(){
    vUv = uv;
    vec3 p = position;
    float ux = mix(uv.x, 1. - uv.x, uFlipX);
    float d = max(0., uTearX - ux);            // quanto questa colonna è già staccata
    float k = smoothstep(0., .35, d);
    float dy = p.y - uBaseY;
    // la parte staccata si alza in diagonale (più a sinistra, più in alto) e si arriccia verso chi guarda
    float ang = k * .55;
    p.y = uBaseY + dy * cos(ang) + d * d * 1.6 + k * .06;
    p.z = p.z + abs(dy) * sin(ang) + d * .55 + k * .12 + sin(ux * 46.) * .006 * k;
    p.x -= d * d * .25;
    vec4 wp = modelMatrix * vec4(p, 1.);
    mat3 inv = transpose(mat3(modelMatrix));
    vView  = inv * (cameraPosition - wp.xyz);
    vLight = inv * normalize(vec3(-.35, .75, 1.));
    vNormal = normalize(normal + vec3(0., -sin(ang), 0.));
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CARD_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform float uMode;      // 0 holo classico, 1 full art, 2 oro, 3 retro
  uniform vec4  uMask;      // finestra holo per le carte classiche (uv)
  uniform float uStrength;
  uniform float uTime;
  uniform float uFlash;
  uniform float uDim;
  uniform float uOpacity;
  uniform vec2  uSize;
  varying vec2 vUv; varying vec3 vView; varying vec3 vLight; varying vec3 vNormal;
  ${COMMON}
  float roundRect(vec2 uv){
    float r = .12;
    vec2 p = (uv - .5) * uSize;
    vec2 q = abs(p) - uSize*.5 + r;
    return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
  }
  void main(){
    float d = roundRect(vUv);
    float a = 1. - smoothstep(-.008, .004, d);
    vec4 tex = texture2D(uMap, vUv);
    a *= tex.a;
    if (a < .5) discard;

    vec3 col = tex.rgb;
    vec3 v = normalize(vView);
    vec3 L = normalize(vLight);
    vec3 n = vec3(0., 0., 1.);
    float spec = pow(max(dot(reflect(-L, n), v), 0.), 28.);
    vec2 tilt = v.xy;
    float lum = dot(col, vec3(.299, .587, .114));
    float m = 1.;

    if (uMode < .5) {
      // Holo classico: foil a stelle solo nella finestra dell'illustrazione
      m = step(uMask.x, vUv.x) * step(vUv.x, uMask.z) * step(uMask.y, vUv.y) * step(vUv.y, uMask.w);
      m *= mix(1., .25, smoothstep(.45, .85, lum));
      float sw = fbm(vUv * vec2(5., 7.) + tilt * 1.5);
      float ph = vUv.x * .8 + vUv.y * 1.2 + tilt.x * 2.4 - tilt.y * 1.8 + sw * .9;
      vec3 holo = rainbow(ph);
      float band = .45 + .55 * smoothstep(.2, .9, .5 + .5 * sin(ph * 6.28318));
      col = mix(col, 1. - (1. - col) * (1. - holo * .75 * band), m * uStrength);
    } else if (uMode < 1.5) {
      // Full art: lamina incisa a righe sottili, l'arcobaleno scorre con l'angolo
      float lines = .5 + .5 * sin((vUv.x * 1.15 + vUv.y) * 560.);
      float ph = vUv.y * 1.3 - vUv.x * .7 + tilt.x * 2.6 + tilt.y * 2.;
      vec3 holo = rainbow(ph);
      float band = smoothstep(.25, 1., .5 + .5 * sin(ph * 3.14159));
      col = 1. - (1. - col) * (1. - holo * (.16 + .34 * lines) * band * uStrength);
    } else if (uMode < 2.5) {
      // Oro: bande metalliche che scivolano sulla lamina
      float ph = vUv.x * 1.1 + vUv.y * .8 + tilt.x * 2.2 + tilt.y * 1.7;
      float band = pow(.5 + .5 * sin(ph * 8.), 6.);
      float metal = smoothstep(.35, .85, lum);
      col += vec3(1., .86, .52) * band * .5 * metal * uStrength + rainbow(ph * .5) * .07 * metal;
    } else {
      m = .35;
    }

    // Scintille: si accendono solo a certi angoli, come sulla carta vera
    vec2 g = floor(vUv * vec2(72., 100.));
    float h = hash(g);
    float tw = pow(max(0., sin(h * 60. + tilt.x * 11. + tilt.y * 9. + uTime * .5)), 14.);
    col += step(.972, h) * tw * .95 * m * uStrength;

    // Riflesso della luce che attraversa la carta
    vec2 gp = .5 - tilt * 1.5;
    vec2 dd = (vUv - gp) * vec2(1., 1.4);
    col += exp(-dot(dd, dd) * 6.) * .2 + spec * .22;

    col *= uDim;
    col += uFlash;
    gl_FragColor = vec4(col, 1.);
  }
`;

const PACK_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform float uSide;      // 0 corpo, 1 striscia strappabile
  uniform float uCut;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uTorn;
  uniform float uTearX;
  varying vec2 vUv; varying vec3 vView; varying vec3 vLight; varying vec3 vNormal;
  ${COMMON}
  float jag(float x){ return (hash(vec2(floor(x * 46.), 3.)) - .5) * .012 + sin(x * 61.) * .003; }
  void main(){
    float cy = uCut + jag(vUv.x);
    if (uSide < .5) { if (vUv.y > cy) discard; } else { if (vUv.y < cy) discard; }
    float tooth = abs(fract(vUv.x * 42.) - .5) * .014;
    if (vUv.y < .004 + tooth || vUv.y > .996 - tooth) discard;

    vec4 tex = texture2D(uMap, vUv);
    vec3 col = tex.rgb;
    float foil = tex.a;                    // l'alfa della texture codifica quanto è metallizzato

    // pieghe del foil
    float cr = fbm(vUv * vec2(7., 11.) + 3.1);
    float cr2 = fbm(vUv * vec2(26., 40.));
    vec3 n = normalize(vNormal + vec3((cr - .5) * .4 + (cr2 - .5) * .08, (fbm(vUv * vec2(9., 6.)) - .5) * .36, 0.));
    // zigrinatura delle saldature
    float crimp = step(vUv.y, .055) + step(.945, vUv.y);
    n.x += crimp * sin(vUv.x * 420.) * .25;
    n = normalize(n);

    vec3 v = normalize(vView);
    vec3 L = normalize(vLight);
    float spec = pow(max(dot(reflect(-L, n), v), 0.), 36.);
    float broad = pow(max(dot(reflect(-L, n), v), 0.), 6.);
    float ph = dot(n.xy, vec2(1.6, 1.2)) - v.x * 1.4 + v.y * .9 + vUv.y * .6;
    vec3 sheen = rainbow(ph);

    col = mix(col, col * (.55 + .9 * sheen), foil * .55);
    col += sheen * broad * .35 * foil + spec * (.55 + .5 * foil);
    // bordo dello strappo leggermente chiaro, come la plastica che si stira
    float e = 1. - smoothstep(0., .01, abs(vUv.y - cy));
    col += e * .5 * (1. - smoothstep(uTearX - .05, uTearX, vUv.x));
    gl_FragColor = vec4(col, uOpacity);
  }
`;


// ————————————————————————————————————————— particelle a tema e raggi di luce
const FX_VERT = /* glsl */`
  attribute float aSeed;
  attribute vec3 aRand;
  uniform float uTime, uMode, uSize, uPixel;
  uniform vec3 uSpread;
  varying float vAlpha; varying float vSeed;
  void main(){
    float t = uTime;
    vec3 p; float life;
    if (uMode < .5) {            // braci che salgono (Fuoco)
      life = fract(aSeed + t * (.09 + aRand.x * .12));
      p = vec3((aRand.y - .5) * uSpread.x + sin(t * 1.7 + aSeed * 20.) * .3 * life,
               -uSpread.y * .5 + life * uSpread.y, (aRand.z - .5) * uSpread.z);
      vAlpha = smoothstep(0., .12, life) * (1. - smoothstep(.55, 1., life)) * (.6 + .4 * sin(t * 12. + aSeed * 90.));
    } else if (uMode < 1.5) {    // fiammelle spettrali in orbita (Spettro)
      float a = aSeed * 6.2831 + t * (.12 + aRand.x * .18) * (aRand.y > .5 ? 1. : -1.);
      float r = uSpread.x * (.32 + aRand.y * .28);
      p = vec3(cos(a) * r, (aRand.z - .5) * uSpread.y + sin(t * .6 + aSeed * 9.) * .35, sin(a) * r * .5);
      vAlpha = (.35 + .65 * (.5 + .5 * sin(t * .9 + aSeed * 30.)));
    } else if (uMode < 2.5) {    // correnti di vento (Drago)
      life = fract(aSeed + t * (.16 + aRand.x * .22));
      p = vec3(-uSpread.x * .65 + life * uSpread.x * 1.3,
               (aRand.y - .5) * uSpread.y + sin(life * 6.2831 + aSeed * 7.) * .3, (aRand.z - .5) * uSpread.z);
      vAlpha = sin(life * 3.14159);
    } else if (uMode < 3.5) {    // bolle e scintille (Psico)
      life = fract(aSeed + t * (.04 + aRand.x * .06));
      p = vec3((aRand.y - .5) * uSpread.x + sin(t * .9 + aSeed * 12.) * .35,
               -uSpread.y * .5 + life * uSpread.y, (aRand.z - .5) * uSpread.z);
      vAlpha = sin(life * 3.14159) * (.45 + .55 * pow(.5 + .5 * sin(t * 2.6 + aSeed * 40.), 3.));
    } else {                     // polvere di lamina sempre presente
      p = (aRand - .5) * uSpread + vec3(sin(t * .17 + aSeed * 10.) * .4, cos(t * .13 + aSeed * 7.) * .4, 0.);
      vAlpha = .25 + .75 * pow(.5 + .5 * sin(t * 1.3 + aSeed * 50.), 8.);
    }
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (.55 + aRand.x * .9) * uPixel / -mv.z;
  }
`;
const FX_FRAG = /* glsl */`
  uniform vec3 uColorA, uColorB;
  uniform float uMode, uOpacity;
  varying float vAlpha; varying float vSeed;
  void main(){
    vec2 c = gl_PointCoord - .5;
    float r = length(c), a;
    if (uMode > 1.5 && uMode < 2.5) {
      a = (1. - smoothstep(0., .5, abs(c.x))) * (1. - smoothstep(0., .05, abs(c.y)));
    } else if (uMode > 2.5 && uMode < 3.5) {
      a = (1. - smoothstep(.44, .5, r)) * smoothstep(.36, .46, r) * .8 + (1. - smoothstep(.44, .5, r)) * .08 + exp(-r * r * 80.) * .6;
    } else if (uMode > 3.5) {
      float star = max(1. - smoothstep(0., .05, abs(c.x)) * 1., 0.) * (1. - smoothstep(0., .5, abs(c.y)))
                 + (1. - smoothstep(0., .05, abs(c.y))) * (1. - smoothstep(0., .5, abs(c.x)));
      a = exp(-r * r * 30.) + star * .5;
    } else if (uMode > .5 && uMode < 1.5) {
      a = exp(-r * r * 9.) * .45;
    } else {
      a = exp(-r * r * 16.);
    }
    vec3 col = mix(uColorA, uColorB, fract(vSeed * 7.31));
    gl_FragColor = vec4(col, a * vAlpha * uOpacity);
  }
`;
const RAYS_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uTime, uOpacity;
  varying vec2 vUv;
  void main(){
    vec2 p = vUv - .5;
    float r = length(p), ang = atan(p.y, p.x);
    float rays = .55 * pow(.5 + .5 * sin(ang * 23. + uTime * .18), 5.) + .45 * pow(.5 + .5 * sin(ang * 11. - uTime * .12 + 1.3), 7.);
    float fall = pow(smoothstep(.5, .02, r), 1.6);
    float core = exp(-r * r * 30.);
    vec3 col = mix(uColor, vec3(1.), .3 + core * .4);
    gl_FragColor = vec4(col, (rays * fall * .42 + core * .5) * uOpacity);
  }
`;
const RAYS_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;

function makeFx(mode, count, spread, size, colorA, colorB) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), seed = new Float32Array(count), rnd = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seed[i] = Math.random();
    rnd[i * 3] = Math.random(); rnd[i * 3 + 1] = Math.random(); rnd[i * 3 + 2] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: FX_VERT, fragmentShader: FX_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uMode: { value: mode }, uSize: { value: size }, uPixel: { value: 400 },
      uSpread: { value: new THREE.Vector3(...spread) }, uOpacity: { value: 0 },
      uColorA: { value: new THREE.Color(colorA) }, uColorB: { value: new THREE.Color(colorB) },
    },
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// ————————————————————————————————————————— texture disegnate in canvas (artwork originale)
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

function drawBrandMark(ctx, logo, x, y, size) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#fff'; ctx.fillRect(x - size / 2, y - size / 2, size, size);
  if (logo) ctx.drawImage(logo, 80, 50, 400, 400, x - size / 2, y - size / 2, size, size);
  else {
    ctx.fillStyle = '#0a1a46'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${size * .25}px "Bricolage", sans-serif`; ctx.fillText('T-REX', x, y);
  }
  ctx.restore();
}

function drawPackFront(ctx, w, h, art = {}) {
  // fondo blu notte con raggiera
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0a1a46'); g.addColorStop(.5, '#1d47a6'); g.addColorStop(1, '#0a1a46');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const cx = w * .5, cy = h * .44;
  ctx.save(); ctx.translate(cx, cy);
  for (let i = 0; i < 40; i++) {
    ctx.rotate(Math.PI * 2 / 40);
    ctx.fillStyle = i % 2 ? 'rgba(120,170,255,.16)' : 'rgba(10,26,70,.2)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 1.3, -46); ctx.lineTo(w * 1.3, 46); ctx.fill();
  }
  ctx.restore();
  for (let r = 60; r < w; r += 46) {
    ctx.strokeStyle = `rgba(160,200,255,${.2 - r / w * .16})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  // alone caldo dietro i Pokémon
  const glow = ctx.createRadialGradient(cx, cy, 30, cx, cy, 470);
  glow.addColorStop(0, 'rgba(255,236,150,.95)'); glow.addColorStop(.35, 'rgba(244,196,48,.55)'); glow.addColorStop(1, 'rgba(244,196,48,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, 470, 0, Math.PI * 2); ctx.fill();

  // maschera: dove c'è disegno e testo la lamina è meno metallica
  const mask = document.createElement('canvas'); mask.width = w; mask.height = h;
  const m = mask.getContext('2d');
  const place = (img, x, y, width, flip = false) => {
    if (!img) return;
    const hgt = width * img.height / img.width;
    for (const c of [ctx, m]) {
      c.save();
      if (c === ctx) { c.shadowColor = 'rgba(2,8,30,.65)'; c.shadowBlur = 40; c.shadowOffsetY = 18; }
      c.translate(x, y); if (flip) c.scale(-1, 1);
      c.drawImage(img, -width / 2, -hgt / 2, width, hgt);
      c.restore();
    }
  };
  place(art.charizard, cx + 10, h * .375, 760);
  place(art.gengar, w * .76, h * .6, 400);
  place(art.pikachu, w * .25, h * .615, 410);

  // emblema ufficiale, protetto dalla lamina come gli altri disegni
  for (const c of [ctx, m]) drawBrandMark(c, art.logo, 118, h * .175, 132);

  // wordmark
  const text = (c, fn) => { c.save(); fn(c); c.restore(); };
  for (const c of [ctx, m]) text(c, (c) => {
    c.translate(cx, h * .8); c.rotate(-.05);
    c.font = '800 210px "Bricolage", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const fitted = Math.min(210, 210 * w * .84 / c.measureText('T-REX TCG').width);
    c.font = `800 ${fitted}px "Bricolage", sans-serif`;
    c.lineWidth = 28; c.strokeStyle = c === m ? '#fff' : '#0a1a46'; c.lineJoin = 'round';
    c.strokeText('T-REX TCG', 0, 0);
    c.fillStyle = c === m ? '#fff' : '#f4c430'; c.fillText('T-REX TCG', 0, 0);
  });
  ctx.textAlign = 'center';
  ctx.font = '600 44px "Geist", sans-serif'; ctx.fillStyle = '#dbe6ff';
  ctx.fillText('Busta da collezione', cx, h * .875);
  ctx.font = '500 34px "Geist", sans-serif'; ctx.fillStyle = 'rgba(219,230,255,.75)';
  ctx.fillText('4 carte rare, scelte a mano', cx, h * .91);
  ctx.font = '600 30px "Geist", sans-serif'; ctx.fillStyle = 'rgba(219,230,255,.8)';
  ctx.fillText('STRAPPA QUI', cx, h * (1 - CUT) - 34);
  // saldature argento
  for (const [y0, y1] of [[0, h * .055], [h * .945, h]]) {
    const sg = ctx.createLinearGradient(0, y0, 0, y1);
    sg.addColorStop(0, '#8d9bb8'); sg.addColorStop(.5, '#e9eef8'); sg.addColorStop(1, '#8d9bb8');
    ctx.fillStyle = sg; ctx.fillRect(0, y0, w, y1 - y0);
  }
  ctx.setLineDash([18, 14]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.moveTo(40, h * (1 - CUT) + 18); ctx.lineTo(w - 40, h * (1 - CUT) + 18); ctx.stroke();
  ctx.setLineDash([]);
  // alfa = quantità di metallizzato
  const img = ctx.getImageData(0, 0, w, h), p = img.data;
  const mk = m.getImageData(0, 0, w, h).data;
  for (let i = 0; i < p.length; i += 4) {
    if (mk[i + 3] > 40) { p[i + 3] = 46; continue; }
    const r = p[i], gg = p[i + 1], b = p[i + 2];
    const warm = r > 170 && gg > 120 && b < 140;
    p[i + 3] = warm ? 90 : (b > r ? 255 : 150);
  }
  ctx.putImageData(img, 0, 0);
}

function drawPackBack(ctx, w, h) {
  ctx.fillStyle = '#0d2160'; ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 26) { ctx.fillStyle = `rgba(80,130,240,${.05 + (y / h) * .08})`; ctx.fillRect(0, y, w, 12); }
  ctx.fillStyle = 'rgba(219,230,255,.5)';
  for (let i = 0; i < 9; i++) ctx.fillRect(120, h * .5 + i * 34, (w - 240) * (.6 + ((i * 37) % 40) / 100), 12);
  ctx.fillStyle = '#fff'; ctx.fillRect(w * .32, h * .82, w * .36, 110);
  for (let x = 0; x < w * .32; x += 6) { if ((x * 7) % 11 > 4) { ctx.fillStyle = '#0d2160'; ctx.fillRect(w * .34 + x, h * .82 + 12, x % 3 ? 3 : 5, 86); } }
  for (const [y0, y1] of [[0, h * .055], [h * .945, h]]) {
    const sg = ctx.createLinearGradient(0, y0, 0, y1);
    sg.addColorStop(0, '#8d9bb8'); sg.addColorStop(.5, '#e9eef8'); sg.addColorStop(1, '#8d9bb8');
    ctx.fillStyle = sg; ctx.fillRect(0, y0, w, y1 - y0);
  }
  const img = ctx.getImageData(0, 0, w, h); const p = img.data;
  for (let i = 3; i < p.length; i += 4) p[i] = 200;
  ctx.putImageData(img, 0, 0);
}

function drawCardBack(ctx, w, h, logo) {
  ctx.fillStyle = '#0a1a46'; ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, h * .6);
  g.addColorStop(0, '#3a6fd8'); g.addColorStop(.6, '#163a8e'); g.addColorStop(1, '#0a1a46');
  ctx.fillStyle = g; ctx.fillRect(18, 18, w - 36, h - 36);
  ctx.save(); ctx.translate(cx, cy);
  for (let i = 0; i < 48; i++) {
    ctx.rotate(Math.PI / 24);
    ctx.strokeStyle = 'rgba(160,200,255,.12)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(80, -40, 160, 60, h * .7, 0); ctx.stroke();
  }
  ctx.restore();
  drawBrandMark(ctx, logo, cx, cy, 210);
  ctx.fillStyle = '#f4c430'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 30px "Bricolage", sans-serif'; ctx.fillText('T-REX TCG', cx, h - 70);
}

// ————————————————————————————————————————— geometria della busta con rigonfiamento
function packGeometry(y0, y1, back = false) {
  const segY = Math.max(4, Math.round((y1 - y0) * 70));
  const geo = new THREE.PlaneGeometry(PACK_W, PACK_H * (y1 - y0), 48, segY);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i), vLocal = uv.getY(i);
    const v = y0 + vLocal * (y1 - y0);
    uv.setY(i, v);
    const x = (u - .5) * PACK_W, y = (v - .5) * PACK_H;
    const nx = (u - .5) * 2, ny = (v - .5) * 2;
    const crimp = (v < .055 || v > .945) ? 0 : 1;
    const bulge = .16 * (1 - Math.pow(Math.abs(nx), 3.2)) * (1 - Math.pow(Math.abs(ny), 7)) * crimp;
    pos.setXYZ(i, x, y, bulge);
  }
  geo.computeVertexNormals();
  if (back) { geo.rotateY(Math.PI); }
  return geo;
}

// ————————————————————————————————————————— scena
export async function initHero({ section, canvas, cards, gsap, onPick, sfx, onReady, onProgress, onChapter, scroller }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  // Keep card artwork sharp on Retina phones. Adapt decorative effects below,
  // never permanently replace the scene with a 1x canvas after a loading stall.
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, document.documentElement.clientWidth <= 720 ? 2 : 1.75);
  renderer.setPixelRatio(pixelRatio());
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.set(0, 0, 10);

  await Promise.all([
    document.fonts.load('800 100px "Bricolage"'),
    document.fonts.load('600 40px "Geist"'),
  ]).catch(() => {});

  const loader = new THREE.TextureLoader();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const loadTex = (url) => new Promise((res, rej) => loader.load(url, (t) => { t.anisotropy = anisotropy; t.generateMipmaps = true; res(t); }, undefined, rej));
  let done = 0;
  onProgress?.(.15);
  const cardTex = await Promise.all(cards.map((c) => loadTex(c.img).then((t) => { done++; onProgress?.(.15 + .8 * done / cards.length); return t; })));

  const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  const [pChar, pGen, pPika, brandLogo] = await Promise.all(['assets/img/poke-charizard.webp', 'assets/img/poke-gengar.webp', 'assets/img/poke-pikachu.webp', 'assets/img/trex-logo.jpg?v=18'].map(loadImg));
  const packFrontTex = canvasTex(1024, 1640, (c, w, h) => drawPackFront(c, w, h, { charizard: pChar, gengar: pGen, pikachu: pPika, logo: brandLogo }));
  const packBackTex = canvasTex(512, 820, drawPackBack);
  const backTex = canvasTex(512, 716, (c, w, h) => drawCardBack(c, w, h, brandLogo));
  [packFrontTex, packBackTex, backTex].forEach((texture) => { texture.anisotropy = anisotropy; });

  // rig = tutto ciò che si inclina col puntatore
  const rig = new THREE.Group();
  scene.add(rig);

  // — busta
  const pack = new THREE.Group();
  const packIntro = new THREE.Group();
  packIntro.add(pack);
  rig.add(packIntro);
  const packMat = (map, side, flip = 0) => new THREE.ShaderMaterial({
    vertexShader: side ? STRIP_VERT : VERT, fragmentShader: PACK_FRAG, transparent: true,
    uniforms: { uMap: { value: map }, uSide: { value: side }, uCut: { value: CUT }, uOpacity: { value: 1 }, uTime: { value: 0 }, uTorn: { value: 0 }, uTearX: { value: 0 }, uBaseY: { value: (CUT - .5) * PACK_H }, uFlipX: { value: flip } },
  });
  const body = new THREE.Group(), strip = new THREE.Group();
  const bodyF = new THREE.Mesh(packGeometry(0, CUT + .02), packMat(packFrontTex, 0));
  const bodyB = new THREE.Mesh(packGeometry(0, CUT + .02, true), packMat(packBackTex, 0));
  const stripF = new THREE.Mesh(packGeometry(CUT - .02, 1), packMat(packFrontTex, 1));
  const stripB = new THREE.Mesh(packGeometry(CUT - .02, 1, true), packMat(packBackTex, 1, 1));
  // la geometria del retro è specchiata in x: allineo anche le uv della striscia al taglio
  body.add(bodyF, bodyB); strip.add(stripF, stripB);
  pack.add(body, strip);
  const packMats = [bodyF, bodyB, stripF, stripB].map((m) => m.material);

  // — carte
  const cardGroup = new THREE.Group();
  packIntro.add(cardGroup);
  const planeGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  // ombra morbida sotto ogni carta: separa le carte quando si sovrappongono
  const shadowTex = canvasTex(256, 340, (ctx, w, h) => {
    // sfocatura via shadowBlur (funziona anche dove ctx.filter non c'è)
    ctx.shadowColor = '#000'; ctx.shadowBlur = 22; ctx.shadowOffsetX = 2000;
    ctx.fillStyle = '#000';
    ctx.fillRect(44 - 2000, 44, w - 88, h - 88);
  });
  const shadowGeo = new THREE.PlaneGeometry(CARD_W * 1.3, CARD_H * 1.24);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: .55, depthWrite: false, color: 0x020818 });
  const backGeo = planeGeo.clone(); backGeo.rotateY(Math.PI);
  const modeOf = { classic: 0, full: 1, gold: 2 };
  const cardObjs = cards.map((c, i) => {
    const front = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: CARD_FRAG, transparent: false,
      uniforms: {
        uMap: { value: cardTex[i] }, uMode: { value: modeOf[c.card.holo] ?? 1 },
        uMask: { value: new THREE.Vector4(.105, .495, .895, .885) },
        uStrength: { value: c.card.holo === 'classic' ? .62 : .85 },
        uTime: { value: 0 }, uFlash: { value: 0 }, uDim: { value: 1 }, uOpacity: { value: 1 },
        uSize: { value: new THREE.Vector2(CARD_W, CARD_H) },
      },
    });
    const back = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: CARD_FRAG, transparent: false,
      uniforms: {
        uMap: { value: backTex }, uMode: { value: 3 }, uMask: { value: new THREE.Vector4() },
        uStrength: { value: 1 }, uTime: { value: 0 }, uFlash: { value: 0 }, uDim: { value: 1 }, uOpacity: { value: 1 },
        uSize: { value: new THREE.Vector2(CARD_W, CARD_H) },
      },
    });
    const g = new THREE.Group();
    const f = new THREE.Mesh(planeGeo, front); f.userData.product = c;
    const b = new THREE.Mesh(backGeo, back);
    const sh = new THREE.Mesh(shadowGeo, shadowMat);
    sh.position.set(.16, -.22, -.08);
    sh.renderOrder = -1;
    g.add(f, b, sh);
    g.userData = { front, back, mesh: f };
    g.renderOrder = 10 - i;
    cardGroup.add(g);
    return g;
  });
  const allCardMats = cardObjs.flatMap((g) => [g.userData.front, g.userData.back]);

  // — effetti: raggi dietro la carta, particelle per tipo, polvere di lamina
  const FX_BY_TYPE = {
    fire:    [0, 260, [4.4, 5.4, 2.4], .26, '#ff5a0f', '#ffd27a'],
    ghost:   [1, 70,  [5.4, 4.8, 2.4], 1.1, '#6d28d9', '#a78bfa'],
    dragon:  [2, 140, [7.5, 5.0, 2.4], .9,  '#10b981', '#a7f3d0'],
    psychic: [3, 60,  [4.8, 5.4, 2.2], .3,  '#f9a8d4', '#ffe08a'],
    electric:[0, 200, [4.2, 5.2, 2.2], .14, '#ffd23f', '#ffffff'],
    fairy:   [3, 110, [4.6, 5.2, 2.2], .3,  '#f9a8d4', '#ffffff'],
    normal:  [4, 120, [5, 5, 2], .12,       '#dbe6ff', '#ffd65a'],
  };
  const spotFx = new THREE.Group();
  rig.add(spotFx);
  const rays = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.ShaderMaterial({
    vertexShader: RAYS_VERT, fragmentShader: RAYS_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color('#f4c430') }, uTime: { value: 0 }, uOpacity: { value: 0 } },
  }));
  rays.position.z = -1.6;
  spotFx.add(rays);
  const cardFx = cards.map((c) => {
    const [mode, n, spread, size, a, b] = FX_BY_TYPE[c.type] || FX_BY_TYPE.normal;
    const pts = makeFx(mode, n, spread, size, a, b);
    spotFx.add(pts);
    return pts;
  });
  const dust = makeFx(4, 160, [16, 10, 7], .1, '#dbe6ff', '#ffd65a');
  dust.position.z = -1.5;
  dust.material.uniforms.uOpacity.value = .9;
  rig.add(dust);
  // raggi anche dietro la busta, che esplodono allo strappo
  const packRays = rays.clone();
  packRays.material = rays.material.clone();
  packRays.material.uniforms.uColor.value = new THREE.Color('#ffd65a');
  packRays.position.z = -1.4;
  packRays.material.uniforms.uOpacity.value = .22;
  pack.add(packRays);
  const fxMats = [rays.material, packRays.material, dust.material, ...cardFx.map((f) => f.material)];

  // ——— layout responsive (valori letti dalle tween function-based)
  const intro = section.querySelector('[data-hero-intro]');
  const chapters = [...section.querySelectorAll('[data-chapter]')];
  const outro = section.querySelector('[data-hero-outro]');
  const rail = section.querySelector('[data-rail]');
  const railDots = rail ? [...rail.querySelectorAll('li')] : [];
  const barEl = document.querySelector('.bar');
  // A pinned element may retain its previous inline dimensions during refresh.
  // Measure the same small viewport unit as .hero outside the pin instead.
  const viewportProbe = document.createElement('div');
  viewportProbe.setAttribute('aria-hidden', 'true');
  viewportProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none;contain:strict;';
  document.body.append(viewportProbe);
  const L = {};
  function layout() {
    const w = document.documentElement.clientWidth, h = viewportProbe.clientHeight || window.innerHeight;
    if (!w || !h) return;
    if (renderer.getPixelRatio() !== pixelRatio()) renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const portrait = w / h < .9;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = portrait
      ? Math.max(8.2 / (2 * halfTan), 3.7 / camera.aspect / (2 * halfTan))
      : Math.max(11.6, 7.4 / camera.aspect / (2 * halfTan));
    camera.position.z = dist;
    camera.updateProjectionMatrix();
    const visH = 2 * dist * halfTan, visW = visH * camera.aspect;
    const k = visH / h;                       // unità mondo per pixel sul piano z = 0
    const toY = (py) => (h / 2 - py) * k;
    const barH = barEl ? barEl.offsetHeight : 64;
    for (const m of fxMats) if (m.uniforms.uPixel) m.uniforms.uPixel.value = h * renderer.getPixelRatio() * .5;

    if (!portrait) {
      Object.assign(L, {
        portrait, introScale: 1,
        packX: Math.min(visW * .22, 3.2), packY: -.1,
        spotX: Math.min(visW * .19, 2.9), spotY: 0, spotZ: 2.4, spotScale: 1,
        fanGap: 1.75, fanY: 0,
        rowScale: .62, rowY: .95,
        rowX: (i) => (i - 1.5) * 2.9 * .62, rowYi: () => .95,
      });
      return;
    }
    // verticale: busta, carta e griglia finale occupano solo lo spazio lasciato libero dai testi
    const iB = intro.offsetTop + intro.offsetHeight + 16;
    const freeP = Math.max(1, h - 24 - iB);
    // Reserve the actual space below the CTA, including the tilted foil edges.
    const introScale = Math.min(1, (freeP * k) / (PACK_H * 1.1));
    const chH = Math.max(...chapters.map((c) => c.offsetHeight));
    const cTop = barH + 14, cBot = h - chH - 28 - 14;
    const freeC = Math.max(140, cBot - cTop);
    const spotScale = Math.min(1.15, (freeC * k) / CARD_H);
    const oTop = outro.offsetTop - 18, rTop = barH + 14;
    const freeO = Math.max(160, oTop - rTop);
    const rowScale = Math.min(.5, (freeO * k - .25) / (2 * CARD_H));
    const rowY = toY(rTop + freeO / 2);
    Object.assign(L, {
      portrait, introScale,
      packX: 0, packY: toY(iB + freeP / 2) / introScale,
      spotX: 0, spotY: toY(cTop + freeC / 2), spotZ: 0, spotScale,
      fanGap: .62, fanY: .2,
      rowScale, rowY,
      rowX: (i) => (i % 2 - .5) * (CARD_W * rowScale + .2),
      rowYi: (i) => rowY + (i < 2 ? 1 : -1) * (CARD_H * rowScale / 2 + .1),
    });
  }
  layout();

  // stato iniziale: carte dentro la busta
  const inside = (i) => ({ x: 0, y: -.12, z: .045 - i * .03 });
  cardObjs.forEach((g, i) => { const p = inside(i); g.position.set(p.x, p.y, p.z); });

  // ——— timeline guidata dallo scroll (pinned)

  const fan = (i) => ({
    x: () => (i - 1.5) * L.fanGap + (L.portrait ? 0 : .3),
    y: () => L.fanY - Math.abs(i - 1.5) * .12,
    z: () => .3 - i * .32,
  });
  const fanRot = (i) => ({ z: -(i - 1.5) * .13, y: (i - 1.5) * -.05, x: 0 });


  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: {
      trigger: section, start: 'top top',
      end: () => '+=' + Math.round(window.innerHeight * (L.portrait ? 5.2 : 6)),
      pin: true, scrub: 1, invalidateOnRefresh: true, refreshPriority: 2,
      // Function-based fromTo values must see the new layout before refresh
      // invalidates their cached starts, especially after rotating a phone.
      onRefreshInit: layout,
      onUpdate: (self) => {
        const v = Math.abs(self.getVelocity());
        if (tl.time() < 1.05 && v > 60) sfx?.('crinkle', Math.min(1, v / 2200));
      },
    },
  });

  // 0 → 1: titolo esce, busta al centro (le carte la seguono, sono ancora dentro)
  const packEnd = { x: 0, y: () => (L.portrait ? -.6 : -.55), z: () => (L.portrait ? .2 : .35) };
  tl.to(intro, { autoAlpha: 0, y: -80, duration: .7, ease: 'power2.in' }, .35)
    .fromTo(pack.position, { x: () => L.packX, y: () => L.packY, z: 0 }, { ...packEnd, duration: 1 }, 0)
    .fromTo(pack.rotation, { y: -.42, z: .06 }, { y: 0, z: 0, duration: 1 }, 0)
    .fromTo(packIntro.scale, { x: () => L.introScale, y: () => L.introScale, z: () => L.introScale }, { x: 1, y: 1, z: 1, duration: 1 }, 0);
  cardObjs.forEach((g, i) => {
    const p = inside(i);
    tl.fromTo(g.position,
      { x: () => L.packX, y: () => L.packY + p.y, z: p.z },
      { x: 0, y: () => packEnd.y() + p.y, z: () => packEnd.z() + p.z, duration: 1 }, 0)
      .fromTo(g.rotation, { y: -.42, z: .06 }, { y: 0, z: 0, duration: 1 }, 0);
  });
  tl
  // 1 → 2: strappo
    // lo strappo corre da sinistra a destra, poi la striscia vola via
    .to(packMats.map((m) => m.uniforms.uTearX), { value: 1.3, duration: .7, ease: 'power1.inOut' }, 1.05)
    .call(() => sfx?.('tearPop'), null, 1.72)
    .to(strip.position, { y: 1.5, x: 1.7, z: .8, duration: .7, ease: 'power2.in' }, 1.75)
    .to(strip.rotation, { z: -.8, x: .7, duration: .7, ease: 'power2.in' }, 1.75)
    .to(stripF.material.uniforms.uOpacity, { value: 0, duration: .25 }, 2.25)
    .to(stripB.material.uniforms.uOpacity, { value: 0, duration: .25 }, 2.25)
    .to(packRays.material.uniforms.uOpacity, { value: .85, duration: .25, ease: 'power2.out' }, 1.7)
    .to(packRays.scale, { x: 1.35, y: 1.35, duration: .9, ease: 'power2.out' }, 1.7)
    .to(packRays.material.uniforms.uOpacity, { value: 0, duration: .8 }, 2.4);
  // 2 → 3.2: le carte salgono, la busta scende
  cardObjs.forEach((g, i) => {
    tl.to(g.position, { y: () => (L.portrait ? .7 : .8), duration: 1, ease: 'power2.out' }, 2.2 + i * .07);
  });
  tl.call(() => sfx?.('slide'), null, 2.22)
    .to(body.scale, { x: .965, duration: .3, ease: 'power2.out' }, 2.2)
    .to(body.scale, { x: 1, duration: .5, ease: 'elastic.out(1, .5)' }, 2.75);
  tl.to(pack.position, { y: '-=6', duration: 1.2, ease: 'power2.in' }, 2.45)
    .to(pack.rotation, { x: -.18, z: .05, duration: 1.2, ease: 'power2.in' }, 2.45)
    .to(packMats.map((m) => m.uniforms.uOpacity), { value: 0, duration: .35 }, 3.3)
    .to(allCardMats.map((m) => m.uniforms.uFlash), { value: .35, duration: .15, ease: 'power1.out' }, 2.9)
    .to(allCardMats.map((m) => m.uniforms.uFlash), { value: 0, duration: .5 }, 3.05);
  // 3.2 → 4.2: ventaglio
  cardObjs.forEach((g, i) => {
    tl.to(g.position, { ...fan(i), duration: 1 }, 3.2)
      .to(g.rotation, { ...fanRot(i), duration: 1 }, 3.2)
      .call(() => sfx?.('flick', i), null, 3.3 + i * .12);
  });
  if (rail) tl.fromTo(rail, { autoAlpha: 0 }, { autoAlpha: 1, duration: .3 }, 3.9);

  // 4.2 → 9.4: una carta alla volta sotto i riflettori.
  // Coreografia "a nastro": la carta che esce scivola via a destra, quella nuova entra da sinistra
  // sullo stesso piano e sfalsata nel tempo. Due carte non si trovano mai nello stesso punto.
  const SPOT = 1.3, T0 = 4.3;
  const off = () => (L.portrait ? 7 : 11);
  const wait = (j) => ({ x: () => L.spotX - off(), y: () => L.spotY - 1, z: () => -1.2 - j * .3 });
  const gone = (j) => ({ x: () => L.spotX + off(), y: () => L.spotY + .9, z: () => 1.4 - j * .3 });
  tl.to(rays.material.uniforms.uOpacity, { value: .55, duration: .5 }, T0);
  // le altre carte lasciano il ventaglio e aspettano fuori scena, dietro
  cardObjs.forEach((o, j) => {
    if (!j) return;
    tl.to(o.position, { ...wait(j), duration: .36, ease: 'power2.in' }, T0 - .05 + (j - 1) * .03)
      .to(o.rotation, { x: 0, y: 0, z: .25, duration: .36 }, T0 - .05);
  });
  cardObjs.forEach((g, i) => {
    const t = T0 + i * SPOT;
    const c = cards[i];
    const tin = i === 0 ? t : t + .06;            // istante in cui la carta inizia ad entrare
    tl.to(cardFx[i].material.uniforms.uOpacity, { value: 1, duration: .35 }, t + .2)
      .to(cardFx[i].material.uniforms.uOpacity, { value: 0, duration: .25 }, t + SPOT - .2)
      .to(rays.material.uniforms.uColor.value, { r: () => new THREE.Color(c.glow).r, g: () => new THREE.Color(c.glow).g, b: () => new THREE.Color(c.glow).b, duration: .4 }, t)
      .to(section, { '--glow': c.glow, duration: .5 }, t);
    if (i === 0) {
      tl.to(g.position, { x: () => L.spotX, y: () => L.spotY, z: () => L.spotZ, duration: .5, ease: 'power3.out' }, tin);
    } else {
      tl.set(g.position, { x: () => L.spotX - off(), y: () => L.spotY - .7, z: () => L.spotZ }, tin - .02)
        .to(g.position, { x: () => L.spotX, y: () => L.spotY, duration: .5, ease: 'power3.out' }, tin);
    }
    tl.to(g.scale, { x: () => L.spotScale, y: () => L.spotScale, duration: .5, ease: 'power3.out' }, tin)
      .to(g.rotation, { z: 0, x: .06, y: -.6, duration: .5, ease: 'power3.out' }, tin)
      .to(g.rotation, { y: .55, x: -.06, duration: SPOT - (tin - t) - .5 - .16, ease: 'none' }, tin + .5)
      .fromTo(chapters[i], { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: .3, ease: 'power2.out' }, t + .14)
      .to(chapters[i], { autoAlpha: 0, y: -50, duration: .25, ease: 'power2.in' }, t + SPOT - .14)
      .call(() => sfx?.('shimmer', i), null, tin + .1)
      .call(() => onChapter?.(i), null, t + .16)
      .call(() => sfx?.('swish'), null, t + SPOT - .16);
    if (railDots[i]) tl.call(() => railDots.forEach((d, k) => d.classList.toggle('is-on', k === i)), null, t + .05);
    // uscita: scivola via a destra, leggermente in alto, prima che arrivi la successiva
    tl.to(g.position, { ...gone(i), duration: .34, ease: 'power3.in' }, t + SPOT - .16)
      .to(g.rotation, { z: -.3, y: .2, x: 0, duration: .34, ease: 'power2.in' }, t + SPOT - .16)
      .to(g.scale, { x: 1, y: 1, duration: .34 }, t + SPOT - .16);
  });

  // 9.6 → 10.6: le carte si allineano, compare l'uscita verso il catalogo
  const TE = T0 + cards.length * SPOT + .1;
  tl.to(section, { '--glow': '#1d47a6', duration: .5 }, TE)
    .to(rays.material.uniforms.uOpacity, { value: 0, duration: .5 }, TE);
  cardObjs.forEach((g, i) => {
    tl.to(g.position, { x: () => L.rowX(i), y: () => L.rowYi(i), z: () => -i * .02, duration: .8, ease: 'power3.out' }, TE + i * .06)
      .to(g.rotation, { x: 0, y: 0, z: 0, duration: .8 }, TE)
      .to(g.scale, { x: () => L.rowScale, y: () => L.rowScale, z: 1, duration: .8 }, TE);
  });
  if (rail) tl.to(rail, { autoAlpha: 0, duration: .3 }, TE);
  tl.call(() => sfx?.('reveal'), null, TE + .3);
  tl.fromTo(outro, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: .5, ease: 'power2.out' }, TE + .35)
    .to({}, { duration: .4 });

  // ——— entrata iniziale (indipendente dallo scroll)
  packIntro.position.y = 7; packIntro.rotation.set(.4, -1.6, .3);
  let entered = false;
  function enter() {
    if (entered) return; entered = true;
    gsap.to(packIntro.position, { y: 0, duration: 1.8, ease: 'expo.out', delay: .35 });
    gsap.to(packIntro.rotation, { x: 0, y: 0, z: 0, duration: 2.2, ease: 'expo.out', delay: .35 });
    gsap.delayedCall(.5, () => sfx?.('whoosh'));
  }

  // ——— puntatore, giroscopio, click sulle carte
  const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  const ndc = new THREE.Vector2(-9, -9);
  const ray = new THREE.Raycaster();
  let hovered = null;
  section.addEventListener('pointermove', (e) => {
    const r = section.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    target.x = (x - .5) * 2; target.y = (y - .5) * 2;
    ndc.set(x * 2 - 1, -(y * 2 - 1));
  });
  section.addEventListener('pointerleave', () => { target.x = target.y = 0; ndc.set(-9, -9); });
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    target.x = THREE.MathUtils.clamp(e.gamma / 30, -1, 1);
    target.y = THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1);
  });
  canvas.addEventListener('click', () => { if (hovered && !dragMoved) onPick?.(hovered.userData.product); });

  // ——— strappo a mano: trascina la busta in orizzontale per aprirla (lo scroll segue il gesto)
  const TEAR_END = 1.8, OPEN_AT = 3.05;
  const scrollFor = (t) => { const st = tl.scrollTrigger; return st.start + (st.end - st.start) * (t / tl.duration()); };
  let drag = null, dragMoved = false, overPack = false;
  canvas.style.touchAction = 'pan-y';
  const hitPack = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects([bodyF, stripF], false).length > 0;
  };
  canvas.addEventListener('pointerdown', (e) => {
    dragMoved = false;
    if (tl.time() > TEAR_END - .1 || !hitPack(e.clientX, e.clientY)) return;
    drag = { x: e.clientX, y: e.clientY, p: tl.time() / TEAR_END, start: tl.time() / TEAR_END, w: canvas.getBoundingClientRect().width };
    canvas.setPointerCapture(e.pointerId);
    section.classList.add('is-tearing');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = Math.abs(e.clientX - drag.x), dy = Math.abs(e.clientY - drag.y);
    if (!dragMoved && dy > dx * 1.4 && dy > 12) { drag = null; section.classList.remove('is-tearing'); return; }
    if (dx > 6) dragMoved = true;
    const p = Math.min(1, drag.start + dx / (drag.w * (L.portrait ? .55 : .28)));
    if (p > drag.p + .015) sfx?.('crinkle', Math.min(1, (p - drag.p) * 12));
    drag.p = p;
    scroller?.(scrollFor(p * TEAR_END), { immediate: true });
  });
  const endDrag = () => {
    if (!drag) return;
    const done = drag.p > .55;
    drag = null; section.classList.remove('is-tearing');
    scroller?.(scrollFor(done ? OPEN_AT : 0), { duration: done ? 1.6 : .6 });
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  const fronts = cardObjs.map((g) => g.userData.mesh);
  function pick() {
    if (tl.time() < TEAR_END - .1) {
      hovered = null;
      const over = ndc.x > -2 && (ray.setFromCamera(ndc, camera), ray.intersectObjects([bodyF, stripF], false).length > 0);
      if (over !== overPack) {
        overPack = over;
        canvas.style.cursor = over ? 'grab' : '';
        if (over) section.dataset.cursor = 'Trascina per strappare'; else delete section.dataset.cursor;
      }
      return;
    }
    if (overPack) { overPack = false; canvas.style.cursor = ''; }
    if (tl.progress() < .3) { hovered = null; return; }
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(fronts, false)[0];
    hovered = hit ? hit.object : null;
    canvas.style.cursor = hovered ? 'pointer' : '';
    if (hovered) section.dataset.cursor = 'Apri la scheda'; else delete section.dataset.cursor;
  }

  // ——— loop di rendering: disegna solo mentre la scena è a schermo
  let raf = 0;
  const clock = new THREE.Clock();
  const onScreen = () => {
    const st = tl.scrollTrigger;
    return !document.hidden && (!st || window.scrollY < st.end + window.innerHeight);
  };

  // Shed decorative overdraw before detail. Sampling starts after compilation
  // and resumes cleanly after leaving the scene; sustained recovery restores FX.
  let frames = 0, acc = 0, last = 0, stage = 0, slowWindows = 0, fastWindows = 0;
  let warmUntil = performance.now() + 2000;
  const setEffectBudget = () => {
    const ratio = stage === 2 ? .3 : stage === 1 ? .6 : 1;
    [dust, ...cardFx].forEach((effect) => {
      effect.geometry.setDrawRange(0, Math.ceil(effect.geometry.attributes.position.count * ratio));
    });
  };
  function tune(now) {
    const dt = last ? now - last : 0;
    last = now;
    if (!dt || dt > 250 || now < warmUntil) { frames = 0; acc = 0; return; }
    acc += dt;
    if (++frames < 90) return;
    const avg = acc / frames;
    frames = 0; acc = 0;
    slowWindows = avg > 24 ? slowWindows + 1 : 0;
    fastWindows = avg < 19 ? fastWindows + 1 : 0;
    if (slowWindows >= 2 && stage < 2) {
      stage++; slowWindows = fastWindows = 0; setEffectBudget();
    } else if (fastWindows >= 4 && stage > 0) {
      stage--; slowWindows = fastWindows = 0; setEffectBudget();
    }
  }

  let lastTear = 0;
  let lastDraw = 0;
  function loop(now = performance.now()) {
    raf = requestAnimationFrame(loop);
    if (!onScreen()) { last = 0; frames = 0; acc = 0; warmUntil = now + 500; return; }
    tune(now);
    // A 120 Hz phone does not need twice the GPU work for the same 3D detail.
    const drawElapsed = now - lastDraw, drawInterval = 1000 / 60;
    if (drawElapsed < drawInterval - .5) return;
    lastDraw = now - (Math.max(0, drawElapsed - drawInterval) % drawInterval);
    const tx = stripF.material.uniforms.uTearX.value;
    const dTear = tx - lastTear; lastTear = tx;
    if (dTear > .0005 && tx < 1.25) sfx?.('tear', Math.min(1, dTear * 28));
    const t = clock.getElapsedTime();
    cur.x += (target.x - cur.x) * .06;
    cur.y += (target.y - cur.y) * .06;
    rig.rotation.y = cur.x * .22;
    rig.rotation.x = cur.y * .14;
    // respiro leggero
    rig.position.y = Math.sin(t * 1.1) * .045;
    for (const m of allCardMats) m.uniforms.uTime.value = t;
    for (const m of packMats) m.uniforms.uTime.value = t;
    for (const m of fxMats) m.uniforms.uTime.value = t;
    rays.visible = stage === 0 && rays.material.uniforms.uOpacity.value > .001;
    packRays.visible = stage === 0 && packRays.material.uniforms.uOpacity.value > .001;
    cardFx.forEach((effect) => { effect.visible = effect.material.uniforms.uOpacity.value > .001; });
    spotFx.position.set(L.spotX, L.spotY, L.spotZ - .2);
    spotFx.scale.setScalar(L.spotScale);
    pick();
    renderer.render(scene, camera);
  }
  window.addEventListener('resize', () => { layout(); });
  loop();
  if (/[?&]debug/.test(location.search)) window.__trexTCG = { tl, cardObjs, L, pack, packCanvas: packFrontTex.image, backCanvas: backTex.image };
  onReady?.();

  return { tl, renderer, enter };
}

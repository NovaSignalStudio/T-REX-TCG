// T-REX TCG — sound design sintetizzato in tempo reale con Web Audio.
// Nessun file audio: ogni suono è generato al momento (carta che fruscia, strappo, carte che escono, lamina che brilla).

let ctx = null, master = null, bus = null, padNodes = null, noiseBuf = null;
let enabled = false;
const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches;

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    // riverbero leggero: delay con feedback filtrato
    bus = ctx.createGain(); bus.gain.value = 1;
    const dl = ctx.createDelay(1); dl.delayTime.value = .19;
    const fb = ctx.createGain(); fb.gain.value = .28;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const wet = ctx.createGain(); wet.gain.value = .22;
    bus.connect(master);
    bus.connect(dl); dl.connect(lp).connect(fb).connect(dl); lp.connect(wet).connect(master);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const now = () => ctx.currentTime;
function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
function noise(t, dur, { type = 'bandpass', f0 = 2000, f1 = f0, q = 1, peak = .2, attack = .005, pan = 0 } = {}) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = .8 + Math.random() * .4;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = ctx.createGain(); env(g, t, attack, peak, dur);
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = pan; src.connect(flt).connect(g).connect(p).connect(bus); } else src.connect(flt).connect(g).connect(bus);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + attack + .05);
  return { flt, g, p };
}
function tone(t, freq, dur, { type = 'sine', peak = .08, attack = .004, to = null, pan = 0 } = {}) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * .6);
  const g = ctx.createGain(); env(g, t, attack, peak, dur);
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = pan; o.connect(g).connect(p).connect(bus); } else o.connect(g).connect(bus);
  o.start(t); o.stop(t + attack + dur + .05);
}
const rnd = (a, b) => a + Math.random() * (b - a);
const vibrate = (p) => { if (isTouch && navigator.vibrate) try { navigator.vibrate(p); } catch { /* */ } };

// ——— sottofondo: accordo morbido che respira (La minore nona)
function startPad() {
  if (padNodes || !ctx) return;
  const t = now();
  const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(.05, t + 3);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = .4;
  const lfo = ctx.createOscillator(); lfo.frequency.value = .07;
  const lfoG = ctx.createGain(); lfoG.gain.value = 280;
  lfo.connect(lfoG).connect(lp.frequency); lfo.start();
  const oscs = [];
  [110, 164.81, 196, 246.94, 261.63].forEach((f, i) => {
    [-6, 6].forEach((det) => {
      const o = ctx.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle';
      o.frequency.value = f; o.detune.value = det + rnd(-3, 3);
      const g = ctx.createGain(); g.gain.value = i < 2 ? .12 : .18;
      o.connect(g).connect(lp); o.start(); oscs.push(o);
    });
  });
  lp.connect(out).connect(master);
  padNodes = { out, oscs, lfo };
}
function stopPad() {
  if (!padNodes) return;
  const { out, oscs, lfo } = padNodes; padNodes = null;
  const t = now();
  out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(Math.max(out.gain.value, .0001), t);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  setTimeout(() => { oscs.forEach((o) => o.stop()); lfo.stop(); }, 1400);
}

let lastCrinkle = 0;
// strappo continuo: una sorgente di rumore che resta accesa finché lo strappo avanza.
// Volume, timbro e crepitii seguono la velocità del gesto.
let tearNode = null, tearTimer = 0, lastGrain = 0;
function tearVoice(speed) {
  const t = now();
  if (!tearNode) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1; bp.frequency.value = 1800;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    src.connect(hp).connect(bp).connect(g).connect(bus); src.start();
    tearNode = { src, bp, g };
  }
  const { bp, g } = tearNode;
  g.gain.cancelScheduledValues(t);
  g.gain.setTargetAtTime(.05 + speed * .22, t, .02);
  bp.frequency.setTargetAtTime(1400 + speed * 4200, t, .03);
  // crepitii: le micro-rotture della plastica, più fitte quanto più si tira veloce
  if (t - lastGrain > .03 - speed * .022) {
    lastGrain = t;
    const n = 1 + Math.round(speed * 3);
    for (let i = 0; i < n; i++) noise(t + i * rnd(.004, .012), rnd(.006, .02), { f0: rnd(2200, 8000), q: rnd(4, 10), peak: .06 + speed * .2, pan: rnd(-.3, .3) });
  }
  clearTimeout(tearTimer);
  tearTimer = setTimeout(() => {
    if (!tearNode) return;
    const { src, g: gg } = tearNode; tearNode = null;
    const t2 = now(); gg.gain.cancelScheduledValues(t2); gg.gain.setTargetAtTime(0.0001, t2, .04);
    setTimeout(() => { try { src.stop(); } catch { /* */ } }, 300);
  }, 90);
}
const SFX = {
  tear(speed = .5) { tearVoice(speed); },
  // la striscia si stacca del tutto: schiocco secco della plastica
  tearPop() {
    const t = now();
    noise(t, .05, { type: 'highpass', f0: 2500, q: .8, peak: .3 });
    noise(t + .01, .18, { f0: 3800, f1: 900, q: 1.5, peak: .14 });
    tone(t, 180, .12, { peak: .16, to: 70 });
    vibrate([10, 20, 18]);
  },
  // le carte scivolano fuori: attrito del cartoncino sulla plastica
  slide() {
    const t = now();
    for (let i = 0; i < 4; i++) {
      noise(t + i * .07, .32, { type: 'lowpass', f0: 1800, f1: 700, q: .7, peak: .06, attack: .06, pan: -.2 + i * .12 });
      noise(t + i * .07 + .25, .03, { type: 'highpass', f0: 3000, peak: .05 });
    }
  },
  // carta girata
  flip(i = 0) {
    const t = now();
    noise(t, .09, { f0: 2400, f1: 5200, q: 1.4, peak: .1, pan: rnd(-.3, .3) });
    noise(t + .07, .02, { type: 'highpass', f0: 4000, peak: .08 });
    tone(t + .05, 1500 + i * 90, .04, { type: 'triangle', peak: .02 });
  },
  // rivelazione per rarità: più è rara, più ricco è il suono (tier 0..5)
  rarity(tier = 0) {
    const t = now();
    const scale = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    const n = 2 + tier;
    for (let k = 0; k < n; k++) tone(t + k * .07, scale[k % 6] * (k >= 6 ? 2 : 1), .9 + tier * .15, { type: k % 2 ? 'sine' : 'triangle', peak: .045 + tier * .006, pan: -.4 + k * .15 });
    if (tier >= 3) {
      tone(t + n * .07, 2093, 1.8, { type: 'sine', peak: .05 });
      for (let k = 0; k < 10 + tier * 3; k++) tone(t + .15 + k * rnd(.03, .07), rnd(2500, 7000), rnd(.06, .18), { peak: rnd(.012, .03), pan: rnd(-.9, .9) });
    }
    if (tier >= 5) { tone(t, 65.4, 2.2, { type: 'sine', peak: .2 }); vibrate([20, 40, 20, 40, 60]); }
  },
  // fruscio della busta mentre la si maneggia (intensità 0..1)
  crinkle(k = .5) {
    const t = now();
    if (t - lastCrinkle < .05) return; lastCrinkle = t;
    const n = 2 + Math.round(k * 4);
    for (let i = 0; i < n; i++) {
      noise(t + i * rnd(.008, .03), rnd(.012, .04), { f0: rnd(2500, 7500), q: rnd(2, 6), peak: .05 + k * .12, pan: rnd(-.5, .5) });
    }
  },
  // strappo: tensione, crepitio che sale, colpo secco
  rip() {
    const t = now();
    noise(t, .14, { type: 'lowpass', f0: 500, f1: 1400, q: .7, peak: .12, attack: .06 });
    for (let i = 0; i < 18; i++) {
      const tt = t + .1 + i * rnd(.014, .028);
      noise(tt, rnd(.01, .035), { f0: 1800 + i * 240 + rnd(-300, 300), q: rnd(3, 8), peak: rnd(.12, .3), pan: -.4 + i * .05 });
    }
    noise(t + .1, .46, { f0: 900, f1: 6000, q: .9, peak: .26, pan: .1 });
    tone(t + .1, 140, .14, { peak: .18, to: 60 });
    vibrate([8, 30, 14]);
  },
  // le carte escono dalla busta
  whoosh() {
    const t = now();
    const { p } = noise(t, .75, { f0: 380, f1: 2600, q: 1.4, peak: .16, attack: .25 });
    if (p) { p.pan.setValueAtTime(-.6, t); p.pan.linearRampToValueAtTime(.6, t + .8); }
  },
  // scatto di una carta che si apre a ventaglio
  flick(i = 0) {
    const t = now();
    noise(t, .018, { type: 'highpass', f0: 3500, q: .7, peak: .16, pan: -.45 + i * .3 });
    tone(t, 1900 + i * 120, .03, { peak: .03, type: 'triangle', pan: -.45 + i * .3 });
  },
  // la lamina che brilla quando la carta arriva sotto i riflettori
  shimmer(i = 0) {
    const t = now();
    const base = [523.25, 587.33, 659.25, 783.99][i % 4];
    tone(t, base, 1.6, { type: 'triangle', peak: .05 });
    tone(t, base * 2, 1.2, { peak: .04 });
    tone(t + .02, base * 3, .9, { peak: .02 });
    for (let k = 0; k < 7; k++) tone(t + .05 + k * rnd(.04, .09), rnd(2600, 6200), rnd(.08, .2), { peak: rnd(.012, .03), pan: rnd(-.8, .8) });
    noise(t, .5, { f0: 7000, f1: 9000, q: 4, peak: .03 });
  },
  // carta che torna nel mazzetto
  swish() {
    const t = now();
    noise(t, .26, { f0: 1600, f1: 600, q: 1.2, peak: .07, attack: .05, pan: .3 });
  },
  // le quattro carte allineate: accordo finale
  reveal() {
    const t = now();
    [440, 554.37, 659.25, 880].forEach((f, k) => tone(t + k * .06, f, 1.8, { type: 'triangle', peak: .045 }));
  },
  // interfaccia
  coin() {
    const t = now();
    tone(t, 987.77, .08, { type: 'square', peak: .03 });
    tone(t + .07, 1318.5, .35, { type: 'triangle', peak: .06 });
    vibrate(12);
  },
  open() { const t = now(); noise(t, .3, { f0: 500, f1: 2200, q: 1, peak: .06, attack: .08 }); tone(t + .05, 880, .25, { peak: .025 }); },
  close() { const t = now(); noise(t, .22, { f0: 1800, f1: 500, q: 1, peak: .05, attack: .03 }); },
  tap() { const t = now(); tone(t, 1400, .03, { type: 'triangle', peak: .025 }); },
  pop() { const t = now(); tone(t, 520, .12, { peak: .1, to: 980 }); },
};

export const audio = {
  get enabled() { return enabled; },
  setEnabled(v) {
    enabled = !!v;
    if (enabled) { ensure(); startPad(); } else { stopPad(); }
  },
  play(kind, arg) {
    if (!enabled) return;
    ensure();
    (SFX[kind] || SFX.pop)(arg);
  },
  // il sottofondo si ferma quando la scheda non è visibile
  init() {
    document.addEventListener('visibilitychange', () => {
      if (!enabled) return;
      if (document.hidden) stopPad(); else { ensure(); startPad(); }
    });
  },
};

// KOMMO — la busta del giorno.
// Si apre a mano (trascinando la striscia) o col bottone; escono 5 carte da girare una per una.
// Ogni carta holo trovata porta un codice sconto sulle Elite Trainer Box: più è rara, più vale (1–10%).
import { byId, TYPES, euro } from './data.js';

export const ETB_IDS = ['prismatic-etb', 'surging-etb', '30th-etb'];

// rarità holo: sconto e probabilità sono dichiarati in pagina
export const TIERS = {
  reverse: { label: 'Reverse holo', pct: 1, rank: 0 },
  holo:    { label: 'Holo rara', pct: 2, rank: 1 },
  double:  { label: 'Rara doppia', pct: 3, rank: 2 },
  vintage: { label: 'Holo vintage', pct: 5, rank: 3, card: 'charizard-base' },
  alt:     { label: 'Alternate art', pct: 7, rank: 4, card: ['gengar-vmax', 'rayquaza-vmax'] },
  gold:    { label: 'Hyper rare oro', pct: 10, rank: 5, card: 'mew-ex-gold' },
};
const SLOT_REVERSE = [['reverse', 80], ['holo', 20]];
const SLOT_HIT = [['holo', 30], ['double', 30], ['vintage', 20], ['alt', 14], ['gold', 6]];
const TOKEN_TYPES = ['fire', 'electric', 'psychic', 'ghost', 'dragon', 'fairy', 'normal'];
const CODE_DAYS = 7;

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage non disponibile */ } },
};
const today = () => new Date().toISOString().slice(0, 10);
const pickW = (table) => { let r = Math.random() * table.reduce((s, [, w]) => s + w, 0); for (const [k, w] of table) { if ((r -= w) < 0) return k; } return table[0][0]; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const codeFor = (pct) => `KOMMO-${pct}-${Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')}`;

// ——— portafoglio codici (validi 7 giorni, nel carrello si usa il migliore)
export function walletCodes() {
  const now = Date.now();
  return store.get('kommo-v2-codes', []).filter((c) => c && c.exp > now);
}
export function bestCode() {
  return walletCodes().sort((a, b) => b.pct - a.pct)[0] || null;
}

function rollPack() {
  const cards = [];
  for (let i = 0; i < 3; i++) cards.push({ tier: 'common', type: pick(TOKEN_TYPES) });
  cards.push({ tier: pickW(SLOT_REVERSE), type: pick(TOKEN_TYPES) });
  cards.push({ tier: pickW(SLOT_HIT), type: pick(TOKEN_TYPES) });
  return cards.map((c) => {
    const t = TIERS[c.tier];
    if (t?.card) { const id = Array.isArray(t.card) ? pick(t.card) : t.card; c.product = id; c.type = byId[id].type; }
    if (t) { c.pct = t.pct; c.code = codeFor(t.pct); }
    return c;
  });
}

// ——— carta gettone KOMMO (disegno originale) per le carte senza prodotto
function tokenHTML(c) {
  const type = TYPES[c.type];
  const t = TIERS[c.tier];
  const sym = { common: '●', reverse: '◆', holo: '★', double: '★★' }[c.tier] || '●';
  return `<div class="tok tok--${c.tier}" style="--hue:${type.hue}">
    <div class="tok__head"><b>${type.label}</b><span>${sym}</span></div>
    <div class="tok__art"><svg aria-hidden="true"><use href="#t-${c.type}"/></svg></div>
    <div class="tok__foot"><span>Collezione KOMMO</span><span>${t ? t.label : 'Comune'}</span></div>
  </div>`;
}
function faceHTML(c) {
  if (c.product) {
    const p = byId[c.product];
    return `<div class="holo pull__holo" data-holo="${p.card.holo}"><img src="${p.img}" alt="${p.name}"><span class="holo__foil"></span><span class="holo__sparkle"></span><span class="holo__glare"></span></div>`;
  }
  return tokenHTML(c);
}
const nameOf = (c) => (c.product ? byId[c.product].name : `Gettone ${TYPES[c.type].label}`);

export function initOpener({ root, gsap, sound, onCodes, openSheet, goEtb, reduce }) {
  const $ = (s) => root.querySelector(s);
  const stage = $('[data-stage]'), pk = $('[data-pk]'), deck = $('[data-deck]'), pulls = $('[data-pulls]');
  const btn = $('[data-open-pack]'), hint = $('[data-pack-hint]'), result = $('[data-result]');
  const segWrap = $('[data-strip]');
  const N = 9;
  let state = 'idle', pack = null, revealed = 0, tearX = 0;

  // striscia divisa in segmenti verticali: si staccano uno dopo l'altro
  segWrap.innerHTML = Array.from({ length: N }, (_, k) => `<span class="pk__seg" style="--k:${k};--n:${N}"><img src="assets/img/pack-front.webp?v=32" alt=""></span>`).join('');
  const segs = [...segWrap.children];
  // bordo seghettato del corpo della busta
  const zig = Array.from({ length: 31 }, (_, i) => `${(i / 30) * 100}% ${11.5 + (i % 2 ? 1.1 : 0) + Math.sin(i * 2.3) * .4}%`).join(',');
  $('.pk__body').style.clipPath = `polygon(${zig}, 100% 100%, 0% 100%)`;

  function renderWallet() {
    const w = walletCodes();
    const best = bestCode();
    $('[data-wallet]').innerHTML = w.length
      ? `<h3>I tuoi codici</h3><ul>${w.sort((a, b) => b.pct - a.pct).map((c) => `<li class="${best && c.code === best.code ? 'is-best' : ''}"><code>${c.code}</code><span>−${c.pct}% sulle ETB</span><small>${c.card}</small></li>`).join('')}</ul><p>Nel carrello si applica il codice migliore, uno per ordine.</p>`
      : '';
  }

  function setTear(x) {
    tearX = Math.max(0, Math.min(1.2, x));
    segs.forEach((s, k) => {
      const d = Math.max(0, tearX - k / N);           // quanto il segmento è già staccato
      const p = Math.min(1, d * 2.4);
      const lift = p * (8 + (N - k) * 5);
      s.style.transform = `translate(${-p * 4}px, ${-lift}px) rotate(${-p * (6 + (N - k) * 2.2)}deg)`;
      s.style.filter = p > 0 ? `brightness(${1 + p * .25})` : '';
    });
    pk.style.setProperty('--tear', tearX.toFixed(3));
  }

  function canPlay() {
    return store.get('kommo-v2-pack-day', '') !== today();
  }

  function tear(done = true) {
    if (state !== 'idle') return;
    state = 'tearing';
    sound('crinkle', .6);
    const o = { x: tearX };
    gsap.to(o, {
      x: 1.2, duration: reduce ? .01 : .85, ease: 'power1.inOut',
      onUpdate: () => { const d = o.x - tearX; setTear(o.x); if (d > 0) sound('tear', Math.min(1, d * 30)); },
      onComplete: () => done && openUp(),
    });
  }

  function openUp() {
    state = 'opening';
    sound('tearPop');
    pack = rollPack();
    store.set('kommo-v2-pack-day', today());
    btn.hidden = true; hint.hidden = true;
    deck.innerHTML = pack.map((c, i) => ({ c, i })).reverse().map(({ c, i }) => `<div class="pull" style="--i:${i}" data-k="${i}"><div class="pull__inner"><div class="pull__back"><img src="assets/img/card-back.webp?v=32" alt=""></div><div class="pull__face">${faceHTML(c)}</div></div></div>`).join('');
    const cards = [...deck.children];
    pk.classList.add('is-open'); pk.dataset.cursor = 'Gira la carta';
    const tl = gsap.timeline({ onComplete: () => { state = 'reveal'; deck.classList.add('is-ready'); deck.setAttribute('aria-label', 'Gira la prossima carta'); deck.focus({ preventScroll: true }); } });
    tl.to(segs, { y: -160, x: 90, rotate: -40, opacity: 0, duration: .6, ease: 'power2.in', stagger: .02 }, 0)
      .call(() => sound('slide'), null, .25)
      .fromTo(deck, { yPercent: 40 }, { yPercent: -62, duration: .9, ease: 'power3.out' }, .25)
      .to(pk.querySelector('.pk__body'), { yPercent: 70, rotate: 4, opacity: 0, duration: .8, ease: 'power2.in' }, .9)
      .to(deck, { yPercent: -30, scale: 1.08, duration: .6, ease: 'power2.inOut' }, 1.1)
      .fromTo(cards, { x: 0 }, { x: (i) => (i - 2) * 2, rotate: (i) => (i - 2) * 1.5, duration: .4, ease: 'power2.out' }, 1.3);
  }

  function revealNext() {
    if (state !== 'reveal' || revealed >= pack.length) return;
    const idx = revealed;
    const c = pack[idx];
    const el = deck.querySelector(`[data-k="${idx}"]`);
    const slot = pulls.children[idx];
    revealed++;
    state = 'flipping';
    const last = idx === pack.length - 1;
    const tier = TIERS[c.tier];
    // suspense sull'ultima carta se è rara
    if (last && tier && tier.rank >= 3) { deck.classList.add('is-rare'); deck.style.setProperty('--hue', TYPES[c.type].hue); sound('crinkle', 1); }
    const a = el.getBoundingClientRect(), b = slot.getBoundingClientRect();
    const tl = gsap.timeline({ onComplete: () => land(c, el, idx, last) });
    if (last && tier && tier.rank >= 3) tl.to(el, { x: '+=0', duration: .55 });
    tl.call(() => sound('flip', idx))
      .to(el.querySelector('.pull__inner'), { rotateY: 180, duration: .55, ease: 'power3.inOut' })
      .to(el, { x: `+=${b.left - a.left}`, y: `+=${b.top - a.top}`, scale: b.width / a.width, rotate: 0, duration: .55, ease: 'power3.inOut' }, '<');
  }

  function land(c, el, idx, last) {
    const slot = pulls.children[idx];
    slot.appendChild(el);
    gsap.set(el, { clearProps: 'x,y,scale,rotate,transform' });
    el.classList.add('is-out');
    const tier = TIERS[c.tier];
    if (tier) {
      el.classList.add('is-holo');
      slot.insertAdjacentHTML('beforeend', `<span class="pull__code">−${tier.pct}%</span>`);
      sound('rarity', tier.rank);
      if (tier.rank >= 3) confetti(TYPES[c.type].hue);
      const exp = Date.now() + CODE_DAYS * 864e5;
      const codes = store.get('kommo-v2-codes', []).filter((x) => x && x.exp > Date.now());
      codes.push({ code: c.code, pct: tier.pct, card: `${nameOf(c)}, ${tier.label}`, exp, product: c.product || null });
      store.set('kommo-v2-codes', codes);
      renderWallet(); onCodes?.();
    }
    if (last) { finish(); return; }
    state = 'reveal';
  }

  function finish() {
    state = 'done';
    deck.classList.remove('is-ready', 'is-rare');
    delete pk.dataset.cursor;
    const holos = pack.filter((c) => TIERS[c.tier]);
    const best = holos.sort((a, b) => TIERS[b.tier].rank - TIERS[a.tier].rank)[0];
    const t = TIERS[best.tier];
    // la carta migliore torna grande al centro, dove c'era il mazzo
    deck.hidden = true;
    const feat = document.createElement('div');
    feat.className = 'featured pull is-holo'; feat.style.setProperty('--hue', TYPES[best.type].hue);
    feat.innerHTML = `<div class="pull__inner" style="transform:rotateY(180deg)"><div class="pull__face">${faceHTML(best)}</div></div>`;
    pk.appendChild(feat);
    gsap.from(feat, { scale: .4, y: 260, rotateZ: -8, opacity: 0, duration: 1, ease: 'expo.out' });
    result.innerHTML = `
      <p class="result__kicker">${t.label}</p>
      <h3 class="display">${nameOf(best)}: −${t.pct}% sulle Elite Trainer Box</h3>
      <p>Codice <code>${best.code}</code>, già attivo nel carrello per 7 giorni.${holos.length > 1 ? ` In questa busta hai trovato ${holos.length} carte holo, si usa la migliore.` : ''}</p>
      <div class="result__btns">
        <button class="btn btn--yellow" type="button" data-go-etb>Vedi le Elite Trainer Box</button>
        ${best.product ? `<button class="btn btn--ghost" type="button" data-see-card>La carta è in vendita</button>` : ''}
        <button class="btn btn--ghost" type="button" data-share>Condividi</button>
      </div>
      <p class="result__next">La prossima busta si apre domani. <button type="button" class="linklike" data-replay>Riapri ora (solo demo)</button></p>`;
    result.hidden = false;
    gsap.from(result.children, { y: 24, opacity: 0, duration: .7, stagger: .07, ease: 'expo.out' });
    result.querySelector('[data-go-etb]').addEventListener('click', () => goEtb?.());
    result.querySelector('[data-see-card]')?.addEventListener('click', () => openSheet?.(byId[best.product]));
    result.querySelector('[data-share]').addEventListener('click', () => share(best));
    result.querySelector('[data-replay]').addEventListener('click', () => { store.set('kommo-v2-pack-day', ''); reset(); });
  }

  function reset() {
    state = 'idle'; revealed = 0; pack = null;
    pk.classList.remove('is-open'); pk.dataset.cursor = 'Trascina la striscia';
    deck.innerHTML = ''; deck.removeAttribute('style'); deck.className = 'deck'; deck.hidden = false;
    pk.querySelector('.featured')?.remove();
    [...pulls.children].forEach((s) => { s.innerHTML = ''; });
    result.hidden = true; result.innerHTML = '';
    gsap.set(pk.querySelector('.pk__body'), { clearProps: 'transform,opacity' }); gsap.set(segs, { clearProps: 'transform,opacity,filter' });
    setTear(0);
    if (canPlay()) { btn.hidden = false; hint.hidden = false; pk.classList.remove('is-locked'); }
    else { btn.hidden = true; hint.hidden = false; hint.textContent = 'Hai già aperto la busta di oggi. Torna domani.'; pk.classList.add('is-locked'); }
  }

  // ——— trascinare la striscia
  let drag = null;
  pk.addEventListener('pointerdown', (e) => {
    if (state !== 'idle' || !canPlay()) return;
    const r = pk.getBoundingClientRect();
    if (e.clientY - r.top > r.height * .3) return;     // si afferra dalla parte alta
    drag = { x: e.clientX, w: r.width, t0: tearX };
    pk.setPointerCapture(e.pointerId);
    pk.classList.add('is-grab');
  });
  pk.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const x = drag.t0 + Math.abs(e.clientX - drag.x) / (drag.w * .9);
    const d = x - tearX;
    if (d > 0) { setTear(x); sound('tear', Math.min(1, d * 30)); }
    if (tearX >= 1.15) { drag = null; pk.classList.remove('is-grab'); state = 'tearing'; openUp(); }
  });
  const end = () => { if (!drag) return; drag = null; pk.classList.remove('is-grab'); if (tearX > .55) tear(); else { const o = { x: tearX }; gsap.to(o, { x: 0, duration: .35, onUpdate: () => setTear(o.x) }); } };
  pk.addEventListener('pointerup', end); pk.addEventListener('pointercancel', end);
  btn.addEventListener('click', () => tear());
  deck.addEventListener('click', revealNext);
  deck.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); revealNext(); } });

  // ——— coriandoli per le carte più rare
  const cv = $('[data-confetti]'), cx = cv.getContext('2d');
  function confetti(hue) {
    if (reduce) return;
    const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = r.width * dpr; cv.height = r.height * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = [hue, '#f4c430', '#ffffff', '#7ad7ff', '#ff7ac8'];
    const ps = Array.from({ length: 140 }, () => ({ x: r.width / 2, y: r.height * .55, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, s: 4 + Math.random() * 6, c: pick(cols), a: Math.random() * 6, va: (Math.random() - .5) * .3 }));
    let f = 0;
    (function step() {
      cx.clearRect(0, 0, r.width, r.height);
      ps.forEach((p) => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.globalAlpha = Math.max(0, 1 - f / 110); cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore(); });
      if (++f < 120) requestAnimationFrame(step); else cx.clearRect(0, 0, r.width, r.height);
    })();
  }

  // ——— immagine da condividere (leggera: un clic, si condivide o si scarica)
  async function share(c) {
    const t = TIERS[c.tier];
    const W = 1080, H = 1350, cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H;
    const g = cvs.getContext('2d');
    const bg = g.createRadialGradient(W / 2, H * .42, 50, W / 2, H * .42, H * .8);
    bg.addColorStop(0, TYPES[c.type].hue); bg.addColorStop(.45, '#1d47a6'); bg.addColorStop(1, '#0a1a46');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f4c430'; g.font = '800 64px Bricolage, sans-serif'; g.textAlign = 'center';
    g.fillText('KOMMO', W / 2, 120);
    const img = new Image(); img.src = c.product ? byId[c.product].img : 'assets/img/card-back.webp?v=32';
    await img.decode().catch(() => {});
    const cw = 560, ch = cw * 1.397;
    g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 60; g.shadowOffsetY = 30;
    g.drawImage(img, (W - cw) / 2, 190, cw, ch); g.restore();
    g.fillStyle = '#fff'; g.font = '800 76px Bricolage, sans-serif';
    g.fillText(nameOf(c), W / 2, 190 + ch + 110);
    g.fillStyle = '#dbe6ff'; g.font = '600 40px Geist, sans-serif';
    g.fillText(`${t.label} trovata nella busta del giorno · −${t.pct}%`, W / 2, 190 + ch + 175);
    const blob = await new Promise((res) => cvs.toBlob(res, 'image/png'));
    const file = new File([blob], 'kommo-busta.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: 'KOMMO', text: `Ho trovato ${nameOf(c)} nella busta del giorno di KOMMO` }).catch(() => {});
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kommo-busta.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  }

  // tabella probabilità (trasparenza: è una promozione)
  const hitOdds = Object.fromEntries(SLOT_HIT);
  $('[data-odds]').innerHTML = Object.entries(TIERS).map(([k, t]) => {
    const pr = k === 'reverse' ? 'quasi sempre' : `${hitOdds[k] ?? 0}%${k === 'holo' ? ' + 20% nello slot reverse' : ''}`;
    return `<tr><th scope="row">${t.label}${t.card ? `<small>${Array.isArray(t.card) ? t.card.map((id) => byId[id].name).join(' o ') : byId[t.card].name}</small>` : ''}</th><td>−${t.pct}%</td><td>${pr}</td></tr>`;
  }).join('');

  renderWallet();
  reset();
  return { renderWallet };
}

export { euro };

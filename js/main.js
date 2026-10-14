import Lenis from '../vendor/lenis.js';
import { PRODUCTS, HERO_CARDS, CATEGORIES, TYPES, byId, euro } from './data.js';
import { audio } from './audio.js?v=31';
import { initOpener, bestCode, ETB_IDS } from './opener.js?v=31';

const { gsap, ScrollTrigger, Flip, SplitText } = window;
gsap.registerPlugin(ScrollTrigger, Flip, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = document.documentElement;
const REDUCE = root.classList.contains('reduce');
const HAS3D = root.classList.contains('has-3d');
const FREE_SHIP = 9900;
const isTouch = matchMedia('(hover: none)').matches;

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage non disponibile */ } },
};

// l'esperienza parte sempre dall'inizio della busta
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!location.hash) window.scrollTo(0, 0);

// ————————————————————————————————————————— smooth scroll
let lenis = null;
if (!REDUCE) {
  lenis = new Lenis({ lerp: .085, wheelMultiplier: .9, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToEl = (el) => {
  if (!el) return;
  if (el.id === 'top') {
    if (lenis) lenis.scrollTo(0, { duration: 1.6 });
    else window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' });
    return;
  }
  const offset = el.id === 'contatti' ? -$('[data-bar]').offsetHeight - 24 : 0;
  if (lenis) lenis.scrollTo(el, { offset, duration: 1.6 });
  else el.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' });
};

// ————————————————————————————————————————— suoni (sintetizzati in tempo reale, vedi audio.js)
audio.init();
const soundBtn = $('[data-sound]');
const syncSound = () => soundBtn.setAttribute('aria-pressed', String(audio.enabled));
function setSound(on, announce = false) {
  audio.setEnabled(on); store.set('trex-tcg-v2-sound', on); syncSound();
  if (on && announce) { audio.play('pop'); toast('Suoni attivi'); }
}
soundBtn.addEventListener('click', () => setSound(!audio.enabled, true));
syncSound();
const sound = (kind, arg) => audio.play(kind, arg);

// ————————————————————————————————————————— toast
let toastTimer;
function toast(msg) {
  const el = $('[data-toast]');
  el.textContent = msg; el.classList.add('is-on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

// ————————————————————————————————————————— rendering prodotti
const hueOf = (p) => TYPES[p.type]?.hue ?? '#cbd5e1';
const mediaHTML = (p, cls = '') => p.slab
  ? `<div class="slab ${cls}"><div class="slab__label"><span>${p.card.set.replace(/ \(.*/, '')} ${p.name.split(' ')[0]}</span><b>${p.slab.grade}</b><small>${p.slab.grader} ${p.slab.label}, cert. demo</small></div><img src="${p.img}" alt="" loading="lazy"></div>`
  : `<img class="${cls}" src="${p.img}" alt="" loading="lazy">`;

function tileHTML(p) {
  const flag = p.stock === 1 ? '<span class="tile__flag tile__flag--last">Ultimo pezzo</span>'
    : p.anniversary ? '<span class="tile__flag">30 anni</span>' : '';
  return `<li class="tile tile--${p.cat}" data-id="${p.id}" style="--hue:${hueOf(p)}">
    <button class="tile__open" type="button" data-open="${p.id}" data-cursor="Vedi" aria-label="${p.name}, ${p.line}, ${euro(p.price)}. Apri la scheda"></button>
    <div class="tile__media">${flag}${p.cat === 'single' ? `<span class="tile__type" title="Tipo ${TYPES[p.type].label}"><svg aria-hidden="true"><use href="#t-${p.type}"/></svg></span>` : ''}${mediaHTML(p)}${p.cat === 'single' ? '<span class="foil" aria-hidden="true"></span>' : ''}</div>
    <div class="tile__body">
      <h3 class="tile__name">${p.name}</h3>
      <p class="tile__line">${p.line}</p>
      <p class="tile__price">${euro(p.price)}</p>
      <button class="tile__add" type="button" data-add="${p.id}">Aggiungi<span class="tile__add-long"> al carrello</span></button>
    </div>
  </li>`;
}

// ——— hero: capitoli, rail, fallback statico
const heroCards = HERO_CARDS.map((id) => ({ ...byId[id], glow: hueOf(byId[id]) }));
$('[data-chapters]').innerHTML = heroCards.map((p, i) => `
  <article class="chapter" data-chapter style="--hue:${p.glow}" aria-label="${p.name}">
    <img class="chapter__img" src="${p.img}" alt="${p.name}, ${p.card.set}" loading="lazy">
    <div>
      <p class="chapter__step">Carta ${i + 1} di ${heroCards.length}</p>
      <span class="type-pill"><svg aria-hidden="true"><use href="#t-${p.type}"/></svg>${TYPES[p.type].label}</span>
      <h2 class="display">${p.name}</h2>
      <dl class="specs">
        <dt>Set</dt><dd>${p.card.set}</dd>
        <dt>Numero</dt><dd>${p.card.number}</dd>
        <dt>Rarità</dt><dd>${p.card.rarity}</dd>
        <dt>Condizione</dt><dd>${p.card.condition}</dd>
      </dl>
      <div class="chapter__buy">
        <span class="price" data-odo="${p.price}">${euro(p.price)}</span>
        <button class="btn btn--yellow" type="button" data-add="${p.id}">Aggiungi al carrello</button>
        <button class="btn btn--ghost" type="button" data-open="${p.id}">Dettagli</button>
      </div>
    </div>
  </article>`).join('');
$('[data-rail]').innerHTML = heroCards.map((p) => `<li>${p.name}</li>`).join('');

// ——— nastro dei set
const SETS = ['Set Base', 'Evolving Skies', 'Fusion Strike', '151', 'Prismatic Evolutions', 'Surging Sparks', '30th Celebration'];
const setsHTML = SETS.map((n) => `<span class="sets__item"><b>${n}</b><svg aria-hidden="true"><use href="#t-fairy"/></svg></span>`).join('');
$('[data-sets]').innerHTML = setsHTML + setsHTML;

// ——— reparti
const deptDefs = [
  { key: 'sealed', label: CATEGORIES.sealed, img: 'assets/img/product-booster.webp' },
  { key: 'single', label: CATEGORIES.single, img: 'assets/img/card-gengar.webp' },
  { key: 'acc', label: CATEGORIES.acc, img: 'assets/img/product-binder.webp' },
  { key: '30', label: '30th Celebration', img: 'assets/img/30th-etb.webp' },
];
$('[data-depts]').innerHTML = deptDefs.map((d) => {
  const items = d.key === '30' ? PRODUCTS.filter((p) => p.anniversary) : PRODUCTS.filter((p) => p.cat === d.key);
  const n = items.length;
  const fan = items.filter((p) => !p.slab).slice(0, 3).map((p, i) => `<img src="${p.img}" alt="" loading="lazy" style="--i:${i - 1}">`).join('');
  return `<li><button class="dept" type="button" data-dept="${d.key}" data-cursor="Esplora">
    <span class="dept__name">${d.label}</span><span class="dept__fan" aria-hidden="true">${fan}</span><span class="dept__meta">${n} ${n === 1 ? 'prodotto' : 'prodotti'}</span></button></li>`;
}).join('');

// ——— griglia
const grid = $('[data-grid]');
grid.innerHTML = PRODUCTS.filter((p) => !p.anniversary).concat(PRODUCTS.filter((p) => p.anniversary)).map(tileHTML).join('');
const tiles = $$('.tile', grid);

// ——— 30 anni
$('[data-thirty]').innerHTML = PRODUCTS.filter((p) => p.anniversary).map((p) => `
  <li class="thirty__item">
    <div class="thirty__card">
      <button class="tile__open" type="button" data-open="${p.id}" aria-label="${p.name}, ${p.line}. Apri la scheda"></button>
      <figure><img src="${p.img}" alt="" loading="lazy"></figure>
      <div class="thirty__row">
        <div><h3>${p.name === '30th Celebration' ? p.line.split(',')[0] : p.name}</h3><p>${euro(p.price)}</p></div>
        <button class="tile__add" type="button" data-add="${p.id}">Aggiungi</button>
      </div>
    </div>
  </li>`).join('');

// ————————————————————————————————————————— filtri, ricerca, ordinamento (con Flip)
const state = { filter: 'all', q: '', sort: 'featured' };
let pillReady = false;
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
let refreshTimer;
const refreshLater = (ms = 80) => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => ScrollTrigger.refresh(), ms); };
function applyCatalog(animate = true) {
  const flipState = animate && !REDUCE ? Flip.getState(tiles) : null;
  const h0 = grid.offsetHeight;
  const q = norm(state.q.trim());
  const visible = [];
  tiles.forEach((el) => {
    const p = byId[el.dataset.id];
    const hay = norm([p.name, p.line, p.card?.set, p.card?.number, CATEGORIES[p.cat]].join(' '));
    const show = (state.filter === 'all' || p.cat === state.filter) && (!q || hay.includes(q));
    el.hidden = !show;
    if (show) visible.push(el);
  });
  const order = [...visible];
  if (state.sort !== 'featured') order.sort((a, b) => (byId[a.dataset.id].price - byId[b.dataset.id].price) * (state.sort === 'asc' ? 1 : -1));
  tiles.forEach((el) => { el.style.order = ''; });
  order.forEach((el, i) => { el.style.order = i; });
  const n = visible.length;
  $('[data-count]').textContent = `${n} ${n === 1 ? 'prodotto' : 'prodotti'}`;
  $('[data-empty]').hidden = n > 0;
  $('[data-empty-q]').textContent = `“${state.q}”`;
  $$('[data-filter]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.filter === state.filter)));
  if (pillReady) movePill(animate);
  // le piastrelle visibili contano come già rivelate: niente seconda entrata quando ci si scorre sopra
  visible.forEach((el) => { el.dataset.revealed = '1'; gsap.set(el, { clearProps: 'opacity' }); });
  if (flipState) {
    // durante l'animazione la griglia tiene l'altezza più grande: niente salti delle sezioni sotto
    const h1 = grid.offsetHeight;
    grid.style.minHeight = `${Math.max(h0, h1)}px`;
    Flip.from(flipState, {
      duration: .6, ease: 'power3.inOut', absolute: true, nested: true,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: .92 }, { opacity: 1, scale: 1, duration: .5, stagger: .03 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: .92, duration: .3 }),
      onComplete: () => { grid.style.minHeight = ''; refreshLater(); },
    });
  } else {
    refreshLater();
  }
}
$('[data-tabs]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]'); if (!b) return;
  sound('tap');
  state.filter = b.dataset.filter; applyCatalog();
});
$('[data-tabs]').addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const tabs = $$('[data-filter]'); const i = tabs.indexOf(document.activeElement);
  const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
  next.focus(); next.click();
});
let qTimer;
$('[data-search]').addEventListener('input', (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value; applyCatalog(); }, 140); });
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName) && !$$('dialog').some((d) => d.open)) {
    e.preventDefault(); scrollToEl($('#catalogo')); setTimeout(() => $('[data-search]').focus({ preventScroll: true }), lenis ? 900 : 0);
  }
});
$('[data-sort]').addEventListener('change', (e) => { state.sort = e.target.value; applyCatalog(); });
$('[data-reset]').addEventListener('click', () => { state.q = ''; state.filter = 'all'; $('[data-search]').value = ''; applyCatalog(); });
applyCatalog(false);
tiles.forEach((el) => { delete el.dataset.revealed; });

function goFilter(key) {
  if (key === '30') { scrollToEl($('#trenta')); return; }
  state.filter = key; applyCatalog(false);
  scrollToEl($('#catalogo'));
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-filter-link]');
  if (a) { e.preventDefault(); goFilter(a.dataset.filterLink); }
  const d = e.target.closest('[data-dept]');
  if (d) goFilter(d.dataset.dept);
});

// ——— pillola che scivola sotto il filtro attivo
const tabsEl = $('[data-tabs]');
const pill = document.createElement('span'); pill.className = 'tabs__pill'; pill.setAttribute('aria-hidden', 'true');
tabsEl.prepend(pill);
function movePill(animate = true) {
  const b = tabsEl.querySelector('[aria-selected="true"]'); if (!b) return;
  const props = { x: b.offsetLeft, y: b.offsetTop, width: b.offsetWidth, height: b.offsetHeight };
  if (animate && !REDUCE) gsap.to(pill, { ...props, duration: .55, ease: 'elastic.out(1, .75)' }); else gsap.set(pill, props);
}
pillReady = true;
new ResizeObserver(() => movePill(false)).observe(tabsEl);
movePill(false);

// ——— piastrelle: inclinazione 3D col mouse, l'immagine si stacca dal fondo
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !REDUCE) {
  grid.addEventListener('pointermove', (e) => {
    const t = e.target.closest('.tile'); if (!t) return;
    const m = t.querySelector('.tile__media'), r = m.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    m.style.setProperty('--ry', `${x * 14}deg`); m.style.setProperty('--rx', `${-y * 14}deg`);
    m.style.setProperty('--lx', `${(x + .5) * 100}%`); m.style.setProperty('--ly', `${(y + .5) * 100}%`);
  });
  grid.addEventListener('pointerout', (e) => {
    const t = e.target.closest('.tile'); if (!t || t.contains(e.relatedTarget)) return;
    const m = t.querySelector('.tile__media'); m.style.setProperty('--ry', '0deg'); m.style.setProperty('--rx', '0deg');
  });
}

// ——— foil sulle singole e anteprima dei reparti che segue il cursore
grid.addEventListener('pointermove', (e) => {
  const t = e.target.closest('.tile--single'); if (!t) return;
  const r = t.getBoundingClientRect();
  t.style.setProperty('--fx', `${((e.clientX - r.left) / r.width) * 100}%`);
  t.style.setProperty('--fy', `${((e.clientY - r.top) / r.height) * 100}%`);
});
// ————————————————————————————————————————— carrello
let cart = store.get('trex-tcg-v2-cart', []);
if (!Array.isArray(cart)) cart = [];
cart = cart.filter((l) => l && byId[l.id] && Number.isInteger(l.qty) && l.qty > 0);
const cartEl = $('[data-cart]');
function saveCart() { store.set('trex-tcg-v2-cart', cart); renderCart(); }
function renderCart() {
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const code = bestCode();
  const lineDisc = (l) => (code && ETB_IDS.includes(l.id) ? Math.round(byId[l.id].price * l.qty * code.pct / 100) : 0);
  const gross = cart.reduce((s, l) => s + l.qty * byId[l.id].price, 0);
  const disc = cart.reduce((s, l) => s + lineDisc(l), 0);
  const total = gross - disc;
  const c = $('[data-cart-count]'); c.textContent = count; c.dataset.n = count;
  $('[data-cart-open]').setAttribute('aria-label', `Apri il carrello, ${count} ${count === 1 ? 'articolo' : 'articoli'}`);
  $('[data-cart-total]').textContent = euro(total);
  $('[data-cart-disc]').innerHTML = disc
    ? `<span>Codice <code>${code.code}</code>, −${code.pct}% sulle ETB</span><b>−${euro(disc)}</b>`
    : (code ? `<span>Hai un codice −${code.pct}% sulle Elite Trainer Box: aggiungine una.</span>` : '');
  $('[data-cart-disc]').hidden = !code;
  cartEl.classList.toggle('is-empty', !cart.length);
  const missing = FREE_SHIP - total;
  $('[data-ship]').innerHTML = cart.length
    ? `${missing > 0 ? `Mancano <b>${euro(missing)}</b> alla spedizione gratuita.` : 'La spedizione assicurata è gratuita.'}<div class="meter"><i style="width:${Math.min(100, (total / FREE_SHIP) * 100)}%"></i></div>`
    : '';
  const needsProtection = cart.some((l) => byId[l.id].cat === 'single' && !byId[l.id].slab) && !cart.some((l) => l.id === 'toploader-25');
  $('[data-upsell]').innerHTML = needsProtection
    ? `<img src="${byId['toploader-25'].img}" alt=""><p><b>Proteggi le tue singole</b><span>Toploader 35 pt, 25 pezzi, ${euro(byId['toploader-25'].price)}</span></p><button class="btn btn--ghost" type="button" data-add="toploader-25">Aggiungi</button>`
    : '';
  $('[data-upsell]').hidden = !needsProtection;
  $('[data-cart-list]').innerHTML = cart.map((l) => {
    const p = byId[l.id];
    return `<li class="line">
      <img src="${p.img}" alt="">
      <div><h3>${p.name}</h3><p>${p.line}</p>
        <div class="qty" aria-label="Quantità di ${p.name}">
          <button type="button" data-q="${p.id}" data-d="-1" aria-label="Togli uno">−</button>
          <output>${l.qty}</output>
          <button type="button" data-q="${p.id}" data-d="1" aria-label="Aggiungi uno">+</button>
        </div></div>
      <div class="line__price">${lineDisc(l) ? `<s>${euro(p.price * l.qty)}</s>${euro(p.price * l.qty - lineDisc(l))}` : euro(p.price * l.qty)}<button class="line__rm" type="button" data-rm="${p.id}">Rimuovi</button></div>
    </li>`;
  }).join('');
}
function addToCart(id, qty = 1, fromEl) {
  const p = byId[id];
  const line = cart.find((l) => l.id === id);
  const have = line ? line.qty : 0;
  if (have + qty > p.stock) { toast(p.stock === 1 ? `${p.name}: è un pezzo unico ed è già nel carrello.` : `${p.name}: ne restano solo ${p.stock}.`); return; }
  if (line) line.qty += qty; else cart.push({ id, qty });
  saveCart();
  sound('coin');
  fly(fromEl, p.img);
  if (fromEl?.matches?.('.tile__add, [data-sheet-add]')) {
    const old = fromEl.dataset.label || fromEl.innerHTML; fromEl.dataset.label = old;
    fromEl.classList.add('is-done'); fromEl.innerHTML = 'Aggiunto <span aria-hidden="true">✓</span>';
    clearTimeout(fromEl._t); fromEl._t = setTimeout(() => { fromEl.classList.remove('is-done'); fromEl.innerHTML = old; }, 1500);
  }
  toast(`Aggiunto al carrello: ${p.name}`);
}
function fly(fromEl, src) {
  const btn = $('[data-cart-open]');
  const bump = () => gsap.fromTo('[data-cart-count]', { scale: 1.6 }, { scale: 1, duration: .5, ease: 'back.out(3)' });
  const img = fromEl?.closest('.tile, .thirty__card, .chapter, .sheet')?.querySelector('img');
  if (!img || REDUCE) { bump(); return; }
  const a = img.getBoundingClientRect(), b = btn.getBoundingClientRect();
  if (!a.width) { bump(); return; }
  const f = document.createElement('img'); f.src = src; f.className = 'flyer';
  Object.assign(f.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  document.body.appendChild(f);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  gsap.timeline({ onComplete: () => { f.remove(); bump(); } })
    .to(f, { x: dx, duration: .8, ease: 'power2.inOut' }, 0)
    .to(f, { y: dy, duration: .8, ease: 'back.in(1.4)' }, 0)
    .to(f, { scale: .12, rotate: 18, duration: .8, ease: 'power2.in' }, 0)
    .to(f, { opacity: 0, duration: .15 }, .7);
}
cartEl.addEventListener('click', (e) => {
  const q = e.target.closest('[data-q]');
  if (q) {
    const l = cart.find((x) => x.id === q.dataset.q);
    const p = byId[l.id];
    const nq = l.qty + Number(q.dataset.d);
    if (nq > p.stock) { toast(`${p.name}: ne restano solo ${p.stock}.`); return; }
    if (nq <= 0) cart = cart.filter((x) => x !== l); else l.qty = nq;
    saveCart();
  }
  const rm = e.target.closest('[data-rm]');
  if (rm) { cart = cart.filter((x) => x.id !== rm.dataset.rm); saveCart(); }
  if (e.target === cartEl) closeDialog(cartEl);
});
$('[data-checkout]').addEventListener('click', () => toast('Il pagamento non è ancora collegato in questa demo. Il carrello resta salvato.'));
renderCart();

// ————————————————————————————————————————— dialoghi
function openDialog(d) { if (!d.open) d.showModal(); lenis?.stop(); }
function closeDialog(d) { d.close(); sound('close'); }
$$('dialog').forEach((d) => d.addEventListener('close', () => { if (!$$('dialog').some((x) => x.open)) lenis?.start(); }));
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-close]');
  if (c) { const d = c.closest('dialog'); if (d) { closeDialog(d); if (c.getAttribute('href')) { e.preventDefault(); scrollToEl($(c.getAttribute('href'))); } } }
  if (e.target.closest('[data-cart-open]')) openDialog(cartEl);
  const add = e.target.closest('[data-add]');
  if (add) { e.preventDefault(); addToCart(add.dataset.add, 1, add); }
  const op = e.target.closest('[data-open]');
  if (op) openSheet(byId[op.dataset.open], op.closest('.tile, .thirty__card')?.querySelector('img'));
});

// ——— scheda prodotto
function relatedHTML(p) {
  const pool = PRODUCTS.filter((x) => x.id !== p.id && (x.cat === p.cat || (p.cat === 'single' && x.cat === 'acc')));
  const pick = pool.sort((a, b) => Math.abs(a.price - p.price) - Math.abs(b.price - p.price)).slice(0, 3);
  if (!pick.length) return '';
  return `<div class="related"><h3>${p.cat === 'single' ? 'Da vedere insieme' : 'Nello stesso reparto'}</h3><ul>${pick.map((x) => `
    <li><button type="button" data-open="${x.id}"><img src="${x.img}" alt="" loading="lazy"><span><b>${x.name}</b><small>${euro(x.price)}</small></span></button></li>`).join('')}</ul></div>`;
}
const sheet = $('[data-sheet]');
let sheetQty = 1;
function openSheet(p, fromImg) {
  sheetQty = 1;
  const media = $('[data-sheet-media]');
  media.style.setProperty('--hue', hueOf(p));
  const isCard = p.cat === 'single';
  media.innerHTML = isCard && !p.slab
    ? `<div class="holo" data-holo="${p.card.holo}"><img src="${p.img}" alt="${p.name}, ${p.card.set}, ${p.card.number}"><span class="holo__foil"></span><span class="holo__sparkle"></span><span class="holo__glare"></span><span class="loupe" aria-hidden="true"></span></div><button class="lens-btn" type="button" data-lens aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Lente</button><p class="sheet__hint">${isTouch ? 'Trascina o inclina il telefono' : 'Muovi il puntatore sulla carta'} per vedere la lamina</p>`
    : p.slab ? `${mediaHTML(p)}<p class="sheet__hint">Muovi il puntatore per inclinare</p>`
      : `<img src="${p.img}" alt="${p.name}, ${p.line}">`;
  const specs = p.card
    ? `<dl class="specs"><dt>Set</dt><dd>${p.card.set}</dd><dt>Numero</dt><dd>${p.card.number}</dd><dt>Rarità</dt><dd>${p.card.rarity}</dd><dt>Lingua</dt><dd>${p.card.lang}</dd><dt>Condizione</dt><dd>${p.card.condition}</dd></dl>`
    : `<dl class="specs"><dt>Reparto</dt><dd>${CATEGORIES[p.cat]}</dd><dt>Formato</dt><dd>${p.line}</dd><dt>Stato</dt><dd>${p.cat === 'acc' ? 'Nuovo' : 'Sigillato di fabbrica'}</dd></dl>`;
  const ref = p.ref
    ? `<p class="sheet__ref">Prezzo allineato al riferimento <a href="${p.ref.url}" target="_blank" rel="noopener">${p.ref.name}</a> del 13 ottobre 2026.</p>`
    : '<p class="sheet__ref">Prezzo dimostrativo.</p>';
  const stock = p.stock === 1 ? '<span class="stock stock--low">Pezzo unico</span>' : p.stock <= 3 ? `<span class="stock stock--low">Ne restano ${p.stock}</span>` : '<span class="stock">Disponibile, spedito in 24 ore</span>';
  $('[data-sheet-info]').innerHTML = `
    <p class="sheet__crumb">${CATEGORIES[p.cat]}${p.type && TYPES[p.type] && p.cat === 'single' ? `, tipo ${TYPES[p.type].label}` : ''}</p>
    <h2 class="display" id="sheet-title">${p.name}</h2>
    <p class="sheet__line">${p.line}</p>
    <div class="sheet__price"><span class="price">${euro(p.price)}</span>${stock}</div>
    ${ref}
    ${specs}
    <p class="sheet__desc">${p.desc}</p>
    <div class="sheet__buy">
      ${p.stock > 1 ? `<div class="qty" aria-label="Quantità"><button type="button" data-sq="-1" aria-label="Togli uno">−</button><output data-sq-out>1</output><button type="button" data-sq="1" aria-label="Aggiungi uno">+</button></div>` : ''}
      <button class="btn btn--ink" type="button" data-sheet-add="${p.id}">Aggiungi al carrello</button>
    </div>
    ${relatedHTML(p)}`;
  openDialog(sheet);
  sheet.scrollTop = 0;
  setupTilt(media);
  // FLIP: l'immagine parte dalla posizione della miniatura
  const target = media.firstElementChild;
  if (fromImg && target && !REDUCE) {
    const a = fromImg.getBoundingClientRect(), b = target.getBoundingClientRect();
    if (a.width && b.width) {
      gsap.fromTo(target, { x: a.left + a.width / 2 - (b.left + b.width / 2), y: a.top + a.height / 2 - (b.top + b.height / 2), scale: a.height / b.height },
        { x: 0, y: 0, scale: 1, duration: .8, ease: 'expo.out', clearProps: 'transform' });
    }
  }
  sound(isCard ? 'shimmer' : 'open', Math.max(0, HERO_CARDS.indexOf(p.id)));
}
sheet.addEventListener('click', (e) => {
  if (e.target === sheet) { closeDialog(sheet); return; }
  const q = e.target.closest('[data-sq]');
  if (q) { const id = $('[data-sheet-add]', sheet).dataset.sheetAdd; sheetQty = Math.max(1, Math.min(byId[id].stock, sheetQty + Number(q.dataset.sq))); $('[data-sq-out]', sheet).textContent = sheetQty; }
  const a = e.target.closest('[data-sheet-add]');
  if (a) { addToCart(a.dataset.sheetAdd, sheetQty, a); }
});

// inclinazione con puntatore / dito / giroscopio
let tiltCleanup = null;
function setupTilt(media) {
  tiltCleanup?.();
  const el = media.querySelector('.holo, .slab, :scope > img');
  if (!el) return;
  const set = (x, y) => { // x,y in 0..1
    const dx = x - .5, dy = y - .5;
    el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`);
    el.style.setProperty('--ry', `${dx * 32}deg`); el.style.setProperty('--rx', `${-dy * 32}deg`);
    el.style.setProperty('--o', Math.min(1, Math.hypot(dx, dy) * 2.4).toFixed(3));
  };
  const reset = () => { el.classList.remove('is-active'); set(.5, .5); el.style.setProperty('--o', 0); el.querySelector('.loupe')?.classList.remove('is-on'); };
  media.dataset.cursor = 'Inclina';
  const loupe = el.querySelector('.loupe');
  const lensBtn = media.querySelector('[data-lens]');
  let lens = false;
  if (loupe) loupe.style.backgroundImage = `url("${el.querySelector('img').src}")`;
  lensBtn?.addEventListener('click', () => {
    lens = !lens; lensBtn.setAttribute('aria-pressed', String(lens));
    el.classList.toggle('is-lens', lens); media.dataset.cursor = lens ? 'Ispeziona' : 'Inclina';
    reset(); sound('tap');
  });
  const move = (e) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    if (lens && loupe) {
      const Z = 2.8, size = loupe.offsetWidth;
      loupe.style.left = `${x * r.width - size / 2}px`; loupe.style.top = `${y * r.height - size / 2}px`;
      loupe.style.backgroundSize = `${r.width * Z}px ${r.height * Z}px`;
      loupe.style.backgroundPosition = `${-(x * r.width * Z - size / 2)}px ${-(y * r.height * Z - size / 2)}px`;
      loupe.classList.toggle('is-on', e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
      return;
    }
    el.classList.add('is-active');
    set(x, y);
  };
  const orient = (e) => { if (e.gamma == null || lens) return; el.classList.add('is-active'); set(.5 + Math.max(-.5, Math.min(.5, e.gamma / 50)), .5 + Math.max(-.5, Math.min(.5, (e.beta - 45) / 50))); };
  media.addEventListener('pointermove', move);
  media.addEventListener('pointerleave', reset);
  window.addEventListener('deviceorientation', orient);
  reset();
  // piccola dimostrazione automatica all'apertura
  if (!REDUCE && el.classList.contains('holo')) {
    const o = { t: 0 };
    gsap.to(o, { t: 1, duration: 1.6, delay: .5, ease: 'power1.inOut', onUpdate: () => { if (!el.matches(':hover')) set(.5 + Math.sin(o.t * Math.PI * 2) * .35, .5 - Math.sin(o.t * Math.PI) * .25); }, onComplete: () => { if (!el.matches(':hover')) reset(); } });
  }
  tiltCleanup = () => { media.removeEventListener('pointermove', move); media.removeEventListener('pointerleave', reset); window.removeEventListener('deviceorientation', orient); };
}
sheet.addEventListener('close', () => tiltCleanup?.());

// iOS: permesso per il giroscopio al primo tocco
if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
  window.addEventListener('touchend', function ask() { DeviceOrientationEvent.requestPermission().catch(() => {}); window.removeEventListener('touchend', ask); }, { once: true });
}

// ————————————————————————————————————————— newsletter
$('[data-news]').addEventListener('submit', (e) => {
  e.preventDefault();
  $('[data-news-msg]').textContent = 'Fatto. Ti scriveremo solo quando arriva un set nuovo. (Iscrizione dimostrativa, nessuna email inviata.)';
  e.target.reset();
});

// ————————————————————————————————————————— barra in alto
const bar = $('[data-bar]');
ScrollTrigger.create({ start: 40, end: 'max', onToggle: (s) => bar.classList.toggle('is-solid', s.isActive) });
$$('.shop, .thirty, .ship').forEach((sec) => ScrollTrigger.create({
  trigger: sec, start: () => `top top+=${bar.offsetHeight / 2}`, end: () => `bottom top+=${bar.offsetHeight / 2}`,
  toggleClass: { targets: bar, className: 'is-light' },
}));
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.hasAttribute('data-filter-link') || a.hasAttribute('data-close')) return;
  const t = $(a.getAttribute('href')); if (!t) return;
  e.preventDefault(); scrollToEl(t);
});

// ————————————————————————————————————————— animazioni di sezione
if (!REDUCE) {
  // titoli che salgono da una maschera, una volta sola
  $$('[data-split]').forEach((el) => SplitText.create(el, {
    type: 'lines', mask: 'lines', linesClass: 'line-mask-inner', autoSplit: true,
    onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: .09, scrollTrigger: { trigger: el, start: 'top 86%', once: true } }),
  }));

  // On phones and short screens, use a native swipe carousel: no scroll lock,
  // skewed text or viewport-height cards. Desktop keeps its scroll scene.
  gsap.matchMedia().add('(min-width: 721px) and (min-height: 701px)', () => {
    const track = $('[data-thirty]');
    const items = $$('.thirty__item', track);
    const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.thirty', start: 'top top', end: () => `+=${dist() + window.innerHeight * .6}`,
        pin: '.thirty__pin', scrub: .6, invalidateOnRefresh: true, refreshPriority: 1,
      },
    });
    gsap.from(items, {
      y: 60, opacity: 0, duration: .8, ease: 'expo.out', stagger: .06, clearProps: 'transform,opacity',
      scrollTrigger: { trigger: '.thirty', start: 'top 60%', once: true },
    });
  });

  // nastro dei set: scorre da solo, accelera e cambia verso con lo scroll
  const setsTrack = $('[data-sets]');
  let setsX = 0, setsBoost = 0, setsDir = -1, setsVisible = false, setsHalf = 0;
  const measureSets = () => { setsHalf = setsTrack.scrollWidth / 2; };
  new ResizeObserver(measureSets).observe(setsTrack);
  document.fonts.ready.then(measureSets);
  ScrollTrigger.create({
    trigger: '.sets', start: 'top bottom', end: 'bottom top',
    onToggle: (self) => { setsVisible = self.isActive; },
    onUpdate: (self) => { const v = self.getVelocity(); setsBoost = Math.min(14, Math.abs(v) / 120); if (Math.abs(v) > 40) setsDir = v > 0 ? -1 : 1; },
  });
  gsap.ticker.add((t, dt) => {
    if (!setsVisible || document.hidden || !setsHalf) return;
    setsBoost *= .93;
    setsX += setsDir * (1.1 + setsBoost) * dt * .06;
    setsX = gsap.utils.wrap(-setsHalf, 0, setsX);
    setsTrack.style.transform = `translate3d(${setsX}px,0,0)`;
  });

  // piastrelle del catalogo: una sola entrata a cascata
  ScrollTrigger.batch(tiles, {
    start: 'top 92%', once: true,
    onEnter: (els) => {
      const fresh = els.filter((el) => !el.dataset.revealed);
      fresh.forEach((el) => { el.dataset.revealed = '1'; });
      if (fresh.length) gsap.from(fresh, { y: 60, opacity: 0, duration: .9, ease: 'expo.out', stagger: .06, clearProps: 'transform,opacity' });
    },
  });
} else {
  $$('.layer').forEach((l, i) => { l.style.transform = `translateZ(${i * 70}px)`; });
  $$('.layer span').forEach((s) => { s.style.opacity = 1; });
}

// ————————————————————————————————————————— salta l'apertura (sempre raggiungibile da tastiera)
$('[data-skip]').addEventListener('click', () => {
  const target = $('.sets');
  if (lenis) lenis.scrollTo(target, { immediate: true, force: true }); else target.scrollIntoView();
  $('#reparti').querySelector('button, a')?.focus({ preventScroll: true });
});
if (!REDUCE) {
  ScrollTrigger.create({
    trigger: '.hero', start: 'top top', end: 'bottom top',
    onUpdate: (self) => { $('[data-skip]').style.opacity = self.progress > .92 ? 0 : 1; },
  });
}

// ————————————————————————————————————————— busta del giorno
function syncCodePrices() {
  const code = bestCode();
  tiles.forEach((el) => {
    if (!ETB_IDS.includes(el.dataset.id)) return;
    const p = byId[el.dataset.id], price = el.querySelector('.tile__price');
    price.innerHTML = code ? `<s>${euro(p.price)}</s>${euro(Math.round(p.price * (100 - code.pct) / 100))}<em>−${code.pct}% col tuo codice</em>` : euro(p.price);
    el.classList.toggle('has-code', !!code);
  });
}
initOpener({
  root: $('#busta'), gsap, sound, reduce: REDUCE,
  onCodes: () => { renderCart(); syncCodePrices(); },
  openSheet: (p) => openSheet(p),
  goEtb: () => { state.q = 'Elite Trainer'; $('[data-search]').value = 'Elite Trainer'; state.filter = 'sealed'; applyCatalog(false); scrollToEl($('#catalogo')); },
});
syncCodePrices();

// ————————————————————————————————————————— contatore dei prezzi nei capitoli
function odometer(i) {
  const el = $$('[data-chapter]')[i]?.querySelector('[data-odo]');
  if (!el || REDUCE) return;
  const target = +el.dataset.odo, o = { v: target * .55 };
  gsap.killTweensOf(o);
  gsap.to(o, { v: target, duration: 1, ease: 'expo.out', onUpdate: () => { el.textContent = euro(Math.round(o.v)); } });
}

// ————————————————————————————————————————— cursore contestuale e bottoni magnetici (solo mouse)
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !REDUCE) {
  const cur = document.createElement('div');
  cur.className = 'cursor'; cur.setAttribute('aria-hidden', 'true');
  cur.innerHTML = '<span class="cursor__ring"></span><span class="cursor__label"></span>';
  document.body.appendChild(cur);
  const label = cur.querySelector('.cursor__label');
  const cx = gsap.quickTo(cur, 'x', { duration: .45, ease: 'power3' });
  const cy = gsap.quickTo(cur, 'y', { duration: .45, ease: 'power3' });
  let lastTarget = null;
  window.addEventListener('pointermove', (e) => {
    cx(e.clientX); cy(e.clientY);
    cur.classList.add('is-on');
    const t = e.target;
    if (t === lastTarget && !t.closest?.('.hero')) return;
    lastTarget = t;
    const host = t.closest?.('[data-cursor]');
    const txt = host?.dataset.cursor || '';
    label.textContent = txt;
    cur.classList.toggle('has-label', !!txt);
    cur.classList.toggle('is-link', !txt && !!t.closest?.('a, button, select, input, label'));
  }, { passive: true });
  document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
  // la sezione 30 anni dice cosa fare
  $('.thirty').dataset.cursor = 'Scorri';

  $$('.btn--yellow, .cart-btn, .btn--ghost').forEach((b) => {
    const mx = gsap.quickTo(b, 'x', { duration: .5, ease: 'power3' });
    const my = gsap.quickTo(b, 'y', { duration: .5, ease: 'power3' });
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      mx((e.clientX - r.left - r.width / 2) * .28); my((e.clientY - r.top - r.height / 2) * .38);
    });
    b.addEventListener('pointerleave', () => { mx(0); my(0); });
  });
}

// ————————————————————————————————————————— dati strutturati per i motori di ricerca
(() => {
  const abs = (u) => new URL(u, location.href).href;
  const data = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: 'Catalogo T-REX TCG',
    itemListElement: PRODUCTS.map((p, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: {
        '@type': 'Product', name: `${p.name}, ${p.line}`, image: abs(p.img), description: p.desc,
        category: CATEGORIES[p.cat], brand: { '@type': 'Brand', name: 'Pokémon TCG' },
        offers: { '@type': 'Offer', price: (p.price / 100).toFixed(2), priceCurrency: 'EUR', availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: p.cat === 'single' ? 'https://schema.org/UsedCondition' : 'https://schema.org/NewCondition' },
      },
    })),
  };
  const sc = document.createElement('script'); sc.type = 'application/ld+json'; sc.textContent = JSON.stringify(data);
  document.head.appendChild(sc);
})();

// Packaging: fixed 2D labels, connected to their actual projected 3D layers.
const shippingStage = $('.ship__stage');
if (shippingStage) {
  const stackLayers = $$('.layer', shippingStage);
  const leaders = $('[data-ship-leaders]', shippingStage);
  const links = stackLayers.map((layer) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '2.5');
    leaders.append(path, dot);
    return { anchor: $('.layer__anchor', layer), label: $(`[data-layer-label="${layer.dataset.layer}"] b`, shippingStage), path, dot };
  });
  gsap.matchMedia().add({ all: 'all', small: '(max-width: 720px)', reduced: '(prefers-reduced-motion: reduce)' }, (context) => {
    const { small, reduced } = context.conditions;
    const gap = small ? 42 : 58;
    let scheduled = 0, alive = true;
    function draw() {
      scheduled = 0;
      if (!alive) return;
      const stage = shippingStage.getBoundingClientRect();
      const geometry = links.map(({ anchor, label }) => {
        const a = anchor.getBoundingClientRect(), b = label.getBoundingClientRect();
        return { x: a.left + a.width / 2 - stage.left, y: a.top + a.height / 2 - stage.top, endX: b.left - stage.left - 7, endY: b.top + b.height / 2 - stage.top };
      });
      leaders.setAttribute('viewBox', `0 0 ${stage.width} ${stage.height}`);
      geometry.forEach(({ x, y, endX, endY }, i) => {
        const bend = Math.max(x + 12, endX - 34);
        links[i].path.setAttribute('d', `M${x},${y} C${bend},${y} ${endX - 18},${endY} ${endX},${endY}`);
        links[i].dot.setAttribute('cx', x);
        links[i].dot.setAttribute('cy', y);
      });
    }
    function schedule() { if (alive && !scheduled) scheduled = requestAnimationFrame(draw); }
    gsap.set(stackLayers, { z: (i) => i * (reduced ? gap : 18) });
    if (!reduced) gsap.to(stackLayers, {
      z: (i) => i * gap, ease: 'power1.out', onUpdate: schedule,
      scrollTrigger: { trigger: shippingStage, start: 'top 85%', end: 'top 24%', scrub: .65, onRefresh: schedule },
    });
    const observer = new ResizeObserver(schedule);
    observer.observe(shippingStage);
    ScrollTrigger.addEventListener('refresh', schedule);
    document.fonts.ready.then(schedule);
    schedule();
    return () => { alive = false; cancelAnimationFrame(scheduled); observer.disconnect(); ScrollTrigger.removeEventListener('refresh', schedule); };
  });
}

// ————————————————————————————————————————— banner finale, dal precedente sito
const anniversary = $('#trenta');
const anniversaryMotion = $('[data-thirty-motion]');
if (anniversary && anniversaryMotion) {
  let visible = false, paused = false;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const update = () => anniversary.classList.toggle('is-animating', visible && !paused && !preference.matches && !document.hidden);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }).observe(anniversary);
  anniversaryMotion.addEventListener('click', () => {
    paused = !paused;
    anniversaryMotion.setAttribute('aria-pressed', String(paused));
    anniversaryMotion.setAttribute('aria-label', paused ? 'Riprendi lo sfondo animato' : 'Metti in pausa lo sfondo animato');
    anniversaryMotion.querySelector('span').textContent = paused ? '▷' : 'Ⅱ';
    update();
  });
  preference.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
}

const nightBanner = $('#notturno');
if (nightBanner) {
  const nightObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    nightObserver.disconnect();
    import('./night.js?v=31')
      .then(({ createNight }) => createNight(nightBanner))
      .catch((err) => console.warn('[T-REX TCG] Banner statico disponibile', err));
  }, { rootMargin: '450px' });
  nightObserver.observe(nightBanner);
}

// ————————————————————————————————————————— hero
const loaderEl = $('.loader');
const loadPct = $('[data-load-pct]');
function progress(v) {
  const p = Math.round(Math.min(1, v) * 100);
  loaderEl.style.setProperty('--p', `${p}%`);
  if (loadPct) loadPct.textContent = p;
}
progress(.05);
let hero = null;
function reveal() {
  root.classList.add('is-loaded');
  lenis?.start();
  hero?.enter?.();
  introTitle();
  ScrollTrigger.sort(); ScrollTrigger.refresh();
}
// pronto: con la scena 3D si entra scegliendo se avere il suono (il clic sblocca l'audio del browser)
function loaded(h) {
  hero = h || null;
  progress(1);
  if (!HAS3D || !root.classList.contains('has-3d')) { reveal(); return; }
  const gate = $('[data-gate]');
  loaderEl.classList.add('is-ready');
  gate.hidden = false;
  const prev = store.get('trex-tcg-v2-sound', null);
  gate.querySelector(prev === false ? '[data-enter="off"]' : '[data-enter="on"]').focus({ preventScroll: true });
  gate.addEventListener('click', (e) => {
    const b = e.target.closest('[data-enter]'); if (!b) return;
    setSound(b.dataset.enter === 'on');
    sound('open');
    reveal();
  }, { once: true });
}
lenis?.stop();
function introTitle() {
  if (REDUCE) return;
  SplitText.create('.hero__title', {
    type: 'words', mask: 'words',
    onSplit: (self) => gsap.from(self.words, { yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: .045, delay: .2 }),
  });
  gsap.from(['.hero__lede', '.hero__cta'], { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: .1, delay: .7 });
}

if (HAS3D) {
  import('./hero3d.js?v=31')
    .then(({ initHero }) => initHero({
      section: $('.hero'), canvas: $('.hero__gl'), cards: heroCards, gsap,
      onPick: (p) => openSheet(p), sfx: (k, i) => sound(k, i), onProgress: progress,
      onChapter: (i) => odometer(i),
      scroller: (y, o = {}) => (lenis ? lenis.scrollTo(y, { force: true, ...o }) : window.scrollTo(0, y)),
    }))
    .then((h) => loaded(h))
    .catch((err) => {
      console.warn('[T-REX TCG] 3D non disponibile, uso la versione statica', err);
      root.classList.replace('has-3d', 'no-3d');
      loaded();
    });
} else {
  loaded();
}

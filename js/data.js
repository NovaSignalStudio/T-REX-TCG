// Catalogo di test. Prezzi: riferimenti di mercato raccolti il 13/10/2026 (vedi `ref`),
// i prodotti senza `ref` hanno prezzi demo.
export const CATEGORIES = {
  sealed: 'Box e buste',
  single: 'Carte singole',
  acc: 'Accessori',
};

export const TYPES = {
  fire:     { label: 'Fuoco',   hue: '#ff6a2b' },
  ghost:    { label: 'Spettro', hue: '#8b5cf6' },
  dragon:   { label: 'Drago',   hue: '#16a37f' },
  psychic:  { label: 'Psico',   hue: '#f472b6' },
  electric: { label: 'Elettro', hue: '#ffcc33' },
  fairy:    { label: 'Folletto',hue: '#f9a8d4' },
  normal:   { label: 'Incolore',hue: '#cbd5e1' },
};

const cm = (url) => ({ name: 'Cardmarket, trend', url, checked: '2026-10-13' });
const shop = (name, url) => ({ name, url, checked: '2026-10-13' });

export const PRODUCTS = [
  // ——— Carte singole
  {
    id: 'charizard-base', cat: 'single', type: 'fire',
    name: 'Charizard', line: 'Set Base, holo',
    img: 'assets/img/card-charizard.webp', price: 95064,
    card: { set: 'Set Base (1999)', number: '4/102', rarity: 'Holo rara', lang: 'Inglese', condition: 'Excellent', holo: 'classic' },
    desc: 'La carta che ha acceso la passione di una generazione. Holo originale del Set Base, foto fronte e retro su richiesta prima della spedizione.',
    ref: cm('https://www.cardmarket.com/en/Pokemon/Products/Singles/Base-Set/Charizard-V1-BS4'),
    stock: 1,
  },
  {
    id: 'charizard-psa8', cat: 'single', type: 'fire', slab: { grader: 'PSA', grade: '8', label: 'NM-MT' },
    name: 'Charizard gradata PSA 8', line: 'Set Base, holo, in slab',
    img: 'assets/img/card-charizard.webp', price: 149000,
    card: { set: 'Set Base (1999)', number: '4/102', rarity: 'Holo rara', lang: 'Inglese', condition: 'PSA 8 NM-MT', holo: 'classic' },
    desc: 'Stessa carta, certificata e sigillata da PSA. Il numero di certificato è verificabile sul registro PSA prima dell’acquisto.',
    stock: 1,
  },
  {
    id: 'gengar-vmax', cat: 'single', type: 'ghost',
    name: 'Gengar VMAX', line: 'Fusion Strike, alternate art',
    img: 'assets/img/card-gengar.webp', price: 76880,
    card: { set: 'Fusion Strike (2021)', number: '271/264', rarity: 'Secret rare, alt art', lang: 'Inglese', condition: 'Near Mint', holo: 'full' },
    desc: 'Una delle alternate art più cercate dell’era Spada e Scudo. Texture in rilievo su tutta l’illustrazione.',
    ref: cm('https://www.cardmarket.com/en/Pokemon/Products/Singles/Fusion-Strike/Gengar-VMAX-V2'),
    stock: 1,
  },
  {
    id: 'rayquaza-vmax', cat: 'single', type: 'dragon',
    name: 'Rayquaza VMAX', line: 'Evolving Skies, alternate art',
    img: 'assets/img/card-rayquaza.webp', price: 99199,
    card: { set: 'Evolving Skies (2021)', number: '218/203', rarity: 'Secret rare, alt art', lang: 'Inglese', condition: 'Near Mint', holo: 'full' },
    desc: 'Il drago di Evolving Skies, il set che i collezionisti citano per primo quando si parla di alternate art.',
    ref: cm('https://www.cardmarket.com/en/Pokemon/Products/Singles/Evolving-Skies/Rayquaza-VMAX-V3-EVS218'),
    stock: 2,
  },
  {
    id: 'mew-ex-gold', cat: 'single', type: 'psychic',
    name: 'Mew ex', line: '151, hyper rare oro',
    img: 'assets/img/card-mew.webp', price: 2715,
    card: { set: 'Scarlatto e Violetto 151 (2023)', number: '205/165', rarity: 'Hyper rare', lang: 'Inglese', condition: 'Near Mint', holo: 'gold' },
    desc: 'La versione oro di Mew ex dal set 151. Lamina dorata su tutta la carta.',
    ref: cm('https://www.cardmarket.com/en/Pokemon/Products/Singles/151/Mew-ex-V3-MEW205'),
    stock: 4,
  },

  // ——— Box e buste
  {
    id: 'prismatic-etb', cat: 'sealed', type: 'normal',
    name: 'Prismatic Evolutions', line: 'Elite Trainer Box, inglese',
    img: 'assets/img/product-prismatic.webp', price: 17999,
    desc: 'Eevee e tutte le sue evoluzioni. Nove buste, sleeve a tema, dadi e segnalini. Sigillato di fabbrica.',
    ref: shop('Card Corner', 'https://www.card-corner.de/Pokemon-Prismatic-Evolutions-Elite-Trainer-Box'),
    stock: 3,
  },
  {
    id: 'surging-etb', cat: 'sealed', type: 'electric',
    name: 'Surging Sparks', line: 'Elite Trainer Box, inglese',
    img: 'assets/img/product-etb.webp', price: 14000,
    desc: 'Nove buste di Scintille Folgoranti con accessori da gioco. Sigillato di fabbrica.',
    ref: shop('Three for One Trading', 'https://shop.threeforonetrading.com/de/products/pokemon-surging-sparks-elite-trainer-box'),
    stock: 5,
  },
  {
    id: 'surging-display', cat: 'sealed', type: 'electric',
    name: 'Surging Sparks', line: 'Booster display da 36 buste, inglese',
    img: 'assets/img/product-booster.webp', price: 34999,
    desc: 'Il box completo da 36 buste. Per chi apre in serie o vuole conservarlo sigillato.',
    ref: shop('BesCards', 'https://www.bescards.com/products/sv08-pkm-scarlet-violet-8-surging-sparks-booster-display-36-booster-en'),
    stock: 2,
  },
  {
    id: '151-upc', cat: 'sealed', type: 'psychic',
    name: 'Pokémon 151', line: 'Ultra-Premium Collection, inglese',
    img: 'assets/img/product-151.webp', price: 99995,
    desc: 'Sedici buste 151, carte promo in metallo e una moneta. Il pezzo sigillato più ambito dell’era Scarlatto e Violetto.',
    ref: shop('Lichcards', 'https://lichcards.nl/products/151-ultra-premium-collection-151'),
    stock: 1,
  },
  {
    id: '151-pack-jp', cat: 'sealed', type: 'psychic',
    name: 'Pokémon 151', line: 'Busta singola, giapponese',
    img: 'assets/img/product-pack.webp', price: 2495,
    desc: 'Una busta giapponese del set 151, sette carte. Stampa e cartoncino giapponesi, molto apprezzati dai collezionisti.',
    ref: shop('Crazy Cards', 'https://www.crazycards.eu/products/pokemon-s-v-pokemon-card-151-booster-jap'),
    stock: 24,
  },
  {
    id: '151-file-jp', cat: 'sealed', type: 'psychic',
    name: 'Pokémon 151', line: 'Card File Set, giapponese',
    img: 'assets/img/product-file.webp', price: 21999,
    desc: 'Raccoglitore ufficiale con buste e promo, edizione giapponese. Sigillato.',
    ref: shop('Pokeprinz', 'https://pokeprinz.de/en/products/pokemon-card-151-card-file-set-pokeball-japanisch-sealed'),
    stock: 1,
  },

  // ——— 30° anniversario
  {
    id: '30th-etb', cat: 'sealed', type: 'electric', anniversary: true,
    name: '30th Celebration', line: 'Elite Trainer Box, inglese',
    img: 'assets/img/30th-etb.webp', price: 17999,
    desc: 'La Elite Trainer Box che celebra trent’anni di Pokémon. Sigillata di fabbrica.',
    ref: shop('TCG Vault', 'https://tcgvault.be/en/product/pokemon-tcg-30th-celebration-elite-trainer-box'),
    stock: 4,
  },
  {
    id: '30th-sylveon', cat: 'sealed', type: 'fairy', anniversary: true,
    name: 'Sylveon ex Box', line: '30th Celebration, inglese',
    img: 'assets/img/30th-sylveon.webp', price: 6999,
    desc: 'Box speciale con Sylveon ex promo e buste 30th Celebration.',
    ref: shop('TCG Vault', 'https://tcgvault.be/nl/pokemon-winkel-west-vlaanderen'),
    stock: 6,
  },
  {
    id: '30th-bundle', cat: 'sealed', type: 'electric', anniversary: true,
    name: '30th Celebration', line: 'Booster Bundle da 6 buste, inglese',
    img: 'assets/img/30th-booster.webp', price: 9499,
    desc: 'Sei buste 30th Celebration in un unico box. Il modo più diretto per aprire il set.',
    ref: shop('TCG Vault', 'https://tcgvault.be/en/product/pokemon-tcg-30th-celebration-booster-bundle'),
    stock: 8,
  },
  {
    id: '30th-poster', cat: 'sealed', type: 'electric', anniversary: true,
    name: '30th Celebration', line: 'Poster Collection, inglese',
    img: 'assets/img/30th-poster.webp', price: 3500,
    desc: 'Poster, carte promo e buste del trentesimo anniversario.',
    ref: shop('Gator Cards', 'https://gatorcards.pt/en/products/30th-celebration-poster-collection'),
    stock: 6,
  },

  // ——— Accessori
  {
    id: 'binder-9', cat: 'acc', type: 'normal',
    name: 'Portfolio 9 tasche', line: 'Ultra PRO, 180 carte',
    img: 'assets/img/product-binder.webp', price: 1499,
    desc: 'Pagine senza acidi, inserimento laterale. Per le carte che vuoi sfogliare spesso.',
    ref: shop('Ultra PRO Europe', 'https://www.shopultrapro.eu/products/pok-ball-9-pocket-portfolio-for-pokemon'),
    stock: 12,
  },
  {
    id: 'sleeves-65', cat: 'acc', type: 'normal',
    name: 'Sleeves', line: 'Ultra PRO Deck Protector, 65 pezzi',
    img: 'assets/img/product-sleeves.webp', price: 899,
    desc: 'Bustine opache formato standard per proteggere un mazzo intero.',
    ref: shop('Ultra PRO Europe', 'https://www.shopultrapro.eu/de-de/products/pokeball-standard-deck-protector-sleeves-65ct-for-pokemon'),
    stock: 20,
  },
  {
    id: 'toploader-25', cat: 'acc', type: 'normal',
    name: 'Toploader 35 pt', line: 'Rigidi, 25 pezzi',
    img: 'assets/img/acc-toploader.svg', price: 399,
    desc: 'Il modo standard per spedire e conservare una singola. Usali con una penny sleeve.',
    stock: 40,
  },
  {
    id: 'magnetic-35', cat: 'acc', type: 'normal',
    name: 'Custodia magnetica 35 pt', line: 'Con bordo anti-UV',
    img: 'assets/img/acc-magnetic.svg', price: 449,
    desc: 'Acrilico spesso con chiusura magnetica. Per esporre le carte migliori senza gradarle.',
    stock: 30,
  },
];

// Le quattro carte della scena 3D, in ordine di apparizione.
export const HERO_CARDS = ['charizard-base', 'gengar-vmax', 'rayquaza-vmax', 'mew-ex-gold'];

export const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export const euro = (cents) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);

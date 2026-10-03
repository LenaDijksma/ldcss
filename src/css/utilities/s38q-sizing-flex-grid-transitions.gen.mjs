// §38q — sizing, flex, grid and transition utilities (new in v3.1.0)
//
// Generated, so every responsive copy (ld-sm:*, ld-md:*, …) uses the one
// breakpoint table in build/config.mjs. A class that already exists in the
// hand-written sections is skipped, never redefined.
//
// Naming follows the rest of ldcss:  ld-{property}-{value}, responsive as
// ld-{bp}:{property}-{value}. Negative numbers use an n prefix (ld-translate-y-n2).

const SPACE = { 0: '0', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '24px', 6: '32px', 8: '48px' };
const PCT = [10, 20, 25, 30, 33, 40, 50, 60, 66, 70, 75, 80, 90, 100];
const MS = [0, 75, 100, 150, 200, 300, 500, 700, 1000];

export default function ({ breakpoints, has }) {
  const table = new Map(); // className → declarations (a later add() of the same name wins)
  const add = (name, decl) => table.set(name, decl);

  // -- sizing ----------------------------------------------------------------
  const keywords = { auto: 'auto', full: '100%', screen: '100vw', min: 'min-content', max: 'max-content', fit: 'fit-content' };
  for (const [k, v] of Object.entries(keywords)) add(`w-${k}`, `width: ${v};`);
  for (const [k, v] of Object.entries({ ...keywords, screen: '100vh' })) add(`h-${k}`, `height: ${v};`);
  add('h-screen', 'height: 100vh;\n  height: 100dvh;');
  for (const n of PCT) add(`w-${n}`, `width: ${n}%;`);
  for (const n of PCT) add(`h-${n}`, `height: ${n}%;`);
  for (const [k, v] of Object.entries({ 0: '0', full: '100%', min: 'min-content', max: 'max-content', fit: 'fit-content', screen: '100vw' })) add(`min-w-${k}`, `min-width: ${v};`);
  for (const [k, v] of Object.entries({ none: 'none', xs: '320px', '2xl': '1024px', '3xl': '1280px', prose: '65ch', min: 'min-content', max: 'max-content', fit: 'fit-content', screen: '100vw' })) add(`max-w-${k}`, `max-width: ${v};`);
  for (const [k, v] of Object.entries({ 0: '0', full: '100%', screen: '100vh', min: 'min-content', max: 'max-content', fit: 'fit-content' })) add(`min-h-${k}`, `min-height: ${v};`);
  add('min-h-screen', 'min-height: 100vh;\n  min-height: 100dvh;');
  for (const [k, v] of Object.entries({ none: 'none', full: '100%', screen: '100vh', min: 'min-content', max: 'max-content', fit: 'fit-content' })) add(`max-h-${k}`, `max-height: ${v};`);
  for (const [k, v] of Object.entries(SPACE)) add(`size-${k}`, `width: ${v};\n  height: ${v};`);
  add('size-full', 'width: 100%;\n  height: 100%;');
  add('size-auto', 'width: auto;\n  height: auto;');

  // -- flex ------------------------------------------------------------------
  add('grow', 'flex-grow: 1;');
  add('grow-0', 'flex-grow: 0;');
  add('shrink', 'flex-shrink: 1;');
  add('shrink-0', 'flex-shrink: 0;');
  add('flex-initial', 'flex: 0 1 auto;');
  add('flex-wrap-reverse', 'flex-wrap: wrap-reverse;');
  for (const [k, v] of Object.entries({ 0: '0px', auto: 'auto', full: '100%' })) add(`basis-${k}`, `flex-basis: ${v};`);
  for (const n of [25, 33, 50, 66, 75]) add(`basis-${n}`, `flex-basis: ${n}%;`);
  for (const [k, v] of Object.entries({ start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around', evenly: 'space-evenly', stretch: 'stretch' })) add(`content-${k}`, `align-content: ${v};`);
  for (const [k, v] of Object.entries({ start: 'start', center: 'center', end: 'end', stretch: 'stretch' })) {
    add(`justify-items-${k}`, `justify-items: ${v};`);
    add(`justify-self-${k}`, `justify-self: ${v};`);
    add(`place-items-${k}`, `place-items: ${v};`);
    add(`place-content-${k}`, `place-content: ${v};`);
  }
  add('justify-self-auto', 'justify-self: auto;');
  add('self-auto', 'align-self: auto;');
  add('self-baseline', 'align-self: baseline;');
  add('place-center', 'place-content: center;\n  place-items: center;');
  add('order-0', 'order: 0;');
  add('order-none', 'order: 0;');

  // -- grid ------------------------------------------------------------------
  for (let n = 7; n <= 12; n++) add(`grid-cols-${n}`, `grid-template-columns: repeat(${n}, minmax(0, 1fr));`);
  add('grid-cols-none', 'grid-template-columns: none;');
  for (let n = 1; n <= 6; n++) add(`grid-rows-${n}`, `grid-template-rows: repeat(${n}, minmax(0, 1fr));`);
  add('grid-rows-none', 'grid-template-rows: none;');
  // as many columns as fit, each at least this wide — the one-liner for card grids
  for (const [k, v] of Object.entries({ xs: '9rem', sm: '12rem', md: '16rem', lg: '20rem', xl: '24rem' })) {
    add(`grid-fit-${k}`, `grid-template-columns: repeat(auto-fit, minmax(min(${v}, 100%), 1fr));`);
    add(`grid-fill-${k}`, `grid-template-columns: repeat(auto-fill, minmax(min(${v}, 100%), 1fr));`);
  }
  for (let n = 1; n <= 12; n++) add(`span-${n}`, `grid-column: span ${n} / span ${n};`);
  add('span-full', 'grid-column: 1 / -1;');
  for (let n = 1; n <= 13; n++) { add(`col-start-${n}`, `grid-column-start: ${n};`); add(`col-end-${n}`, `grid-column-end: ${n};`); }
  for (let n = 1; n <= 6; n++) add(`row-span-${n}`, `grid-row: span ${n} / span ${n};`);
  add('row-span-full', 'grid-row: 1 / -1;');
  for (const [k, v] of Object.entries({ row: 'row', col: 'column', dense: 'dense', 'row-dense': 'row dense', 'col-dense': 'column dense' })) add(`grid-flow-${k}`, `grid-auto-flow: ${v};`);
  for (const [k, v] of Object.entries({ auto: 'auto', min: 'min-content', max: 'max-content', fr: 'minmax(0, 1fr)' })) {
    add(`auto-rows-${k}`, `grid-auto-rows: ${v};`);
    add(`auto-cols-${k}`, `grid-auto-columns: ${v};`);
  }

  // -- transitions & transforms ----------------------------------------------
  const timing = 'var(--ld-transition-duration, 150ms) var(--ld-transition-ease, ease)';
  const props = {
    transition: 'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, translate, scale, rotate',
    'transition-colors': 'color, background-color, border-color, text-decoration-color, fill, stroke',
    'transition-opacity': 'opacity',
    'transition-shadow': 'box-shadow',
    'transition-transform': 'transform, translate, scale, rotate',
    'transition-all': 'all',
  };
  for (const [name, list] of Object.entries(props)) add(name, `transition-property: ${list};\n  transition-duration: var(--ld-transition-duration, 150ms);\n  transition-timing-function: var(--ld-transition-ease, ease);`);
  add('transition-none', 'transition-property: none;');
  void timing;
  for (const ms of MS) {
    add(`duration-${ms}`, `--ld-transition-duration: ${ms}ms;\n  transition-duration: ${ms}ms;`);
    add(`delay-${ms}`, `transition-delay: ${ms}ms;`);
  }
  for (const [k, v] of Object.entries({ linear: 'linear', in: 'cubic-bezier(0.4, 0, 1, 1)', out: 'cubic-bezier(0, 0, 0.2, 1)', 'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)' })) {
    add(`ease-${k}`, `--ld-transition-ease: ${v};\n  transition-timing-function: ${v};`);
  }
  // Transforms use the individual `scale`, `rotate` and `translate` properties
  // (every current browser), so they combine on one element without a shared
  // `transform` declaration. translate-x and translate-y meet in custom
  // properties.
  for (const n of [0, 50, 75, 90, 95, 100, 105, 110, 125, 150]) add(`scale-${n}`, `scale: ${n / 100};`);
  for (const d of [0, 1, 2, 3, 6, 12, 45, 90, 180]) {
    add(`rotate-${d}`, `rotate: ${d}deg;`);
    if (d) add(`rotate-n${d}`, `rotate: -${d}deg;`);
  }
  const move = 'translate: var(--ld-tx, 0) var(--ld-ty, 0);';
  for (const [k, v] of Object.entries(SPACE)) {
    add(`translate-x-${k}`, `--ld-tx: ${v};\n  ${move}`);
    add(`translate-y-${k}`, `--ld-ty: ${v};\n  ${move}`);
    if (k !== '0') {
      add(`translate-x-n${k}`, `--ld-tx: -${v};\n  ${move}`);
      add(`translate-y-n${k}`, `--ld-ty: -${v};\n  ${move}`);
    }
  }
  add('translate-x-full', `--ld-tx: 100%;\n  ${move}`);
  add('translate-y-full', `--ld-ty: 100%;\n  ${move}`);
  add('translate-x-nfull', `--ld-tx: -100%;\n  ${move}`);
  add('translate-y-nfull', `--ld-ty: -100%;\n  ${move}`);
  for (const [k, v] of Object.entries({ center: 'center', top: 'top', bottom: 'bottom', left: 'left', right: 'right' })) add(`origin-${k}`, `transform-origin: ${v};`);
  add('will-change-transform', 'will-change: transform;');
  add('will-change-opacity', 'will-change: opacity;');

  const fresh = [...table].filter(([name]) => !has(`ld-${name}`));

  const rule = (selector, decl) => `${selector} {\n  ${decl}\n}\n`;
  const esc = (name) => name.replace(/[:/.]/g, (c) => '\\' + c);
  const out = [`/* ==========================================================================
   38q. Sizing, flex, grid & transition utilities (generated)
   w/h/min/max/size · grow/shrink/basis/content/place · cols/rows/span/start/
   end/flow/auto-fit · transition/duration/delay/ease · scale/rotate/translate
   ========================================================================== */\n`];
  out.push(...fresh.map(([name, decl]) => rule(`.ld-${esc(name)}`, decl)));

  // responsive copies for the layout-shaped groups
  // (kept to the groups people actually flip at a breakpoint — all of them
  // would add ~70 KB)
  const responsive = fresh.filter(([name]) =>
    /^(w-(auto|full|25|33|50|66|75|100)$|grid-cols-|grid-fit-|grid-fill-|span-|basis-|grow|shrink|order-)/.test(name));
  for (const [bp, px] of Object.entries(breakpoints)) {
    out.push(`@media (min-width: ${px}px) {\n${responsive.map(([name, decl]) => rule(`  .ld-${bp}\\:${esc(name)}`, decl.replace(/\n/g, '\n  ')).replace(/\n$/, '')).join('\n')}\n}\n`);
  }
  return out.join('\n');
}

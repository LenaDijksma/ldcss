#!/usr/bin/env node
// ldcss build — no dependencies, Node 18+.
//
//   npm run build      one build
//   npm run watch      rebuild whenever something in src/ or build/ changes
//
// What it does
//   1. Reads every file in src/css/<layer>/ (sorted by file name) and wraps
//      each folder in `@layer ld.<layer> { … }`. Layer order comes from
//      build/config.mjs.
//   2. Runs every *.gen.mjs file and splices in the CSS it returns (the
//      sidebar's per-breakpoint rules, the hover:/focus: variants).
//   3. Writes dist/ldcss.css, dist/ldcss.min.css, dist/ldcss.js,
//      dist/ldcss.min.js, dist/ldcss-theme.js and copies the fonts to dist/fonts/.
//      Every [data-ld-theme='dark'] rule also gets a prefers-color-scheme copy
//      (withAutoDark), so dark mode works with no JavaScript and no flash.
//   4. JavaScript: src/js/ldcss.js is the core; every file in src/js/modules/
//      is inlined at its `/* @ldcss-modules */` marker (so modules share the
//      core's private helpers), in file-name order.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, rmSync, watch } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

/* ---------------------------------------------------------------------------
   Reading sources
   ------------------------------------------------------------------------- */

const read = (p) => readFileSync(p, 'utf8');
const files = (dir) => (existsSync(dir) ? readdirSync(dir).sort() : []);

/** Add every top-level `.ld-name { … }` rule in `css` to `index` (name → body). */
function indexCss(css, index) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  let prelude = '';
  let bodyStart = -1;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      if (depth === 0) {
        bodyStart = i + 1;
        prelude = prelude.trim();
      }
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        if (/^\.ld-[a-z0-9\\:/.-]+$/.test(prelude)) index.set(prelude.slice(1).replace(/\\/g, ''), css.slice(bodyStart, i));
        prelude = '';
      }
    } else if (depth === 0) {
      prelude += c;
    }
  }
}

function indexUtilities(layers) {
  const index = new Map();
  for (const layer of layers) {
    for (const f of files(join(SRC, 'css', layer))) {
      if (extname(f) === '.css') indexCss(read(join(SRC, 'css', layer, f)), index);
    }
  }
  return index;
}


/* ---------------------------------------------------------------------------
   Dark mode without JavaScript
   Every rule whose selector starts with [data-ld-theme='dark'] is copied,
   right after itself, into a prefers-color-scheme media query for pages that
   have no data-ld-theme attribute at all. The copy uses
   :where(:root):not([data-ld-theme]), which has the same specificity as
   [data-ld-theme='dark'], so the cascade between rules does not change.
   One source of truth: edit the dark rules, the automatic ones follow.
   ------------------------------------------------------------------------- */

const DARK = /\[data-ld-theme=(['"])dark\1\]/;
const AUTO = ':where(:root):not([data-ld-theme])';

function splitTopLevel(css) {
  // → [{ prelude, body | null, raw }] where raw is the exact source text of the item
  const items = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    const start = i;
    let depth = 0;
    let bodyStart = -1;
    let preludeEnd = -1;
    while (i < n) {
      const c = css[i];
      if (c === '/' && css[i + 1] === '*') { const e = css.indexOf('*/', i + 2); i = e === -1 ? n : e + 2; continue; }
      if (c === '"' || c === "'") { let j = i + 1; while (j < n && css[j] !== c) j += css[j] === '\\' ? 2 : 1; i = j + 1; continue; }
      if (c === '{') { if (depth === 0) { bodyStart = i + 1; preludeEnd = i; } depth++; }
      else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
      else if (c === ';' && depth === 0) { i++; break; }
      i++;
    }
    items.push({
      raw: css.slice(start, i),
      prelude: preludeEnd === -1 ? css.slice(start, i) : css.slice(start, preludeEnd),
      body: bodyStart === -1 ? null : css.slice(bodyStart, i - 1),
    });
  }
  return items;
}

function splitSelectors(list) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const c of list) {
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

export function withAutoDark(css) {
  let out = '';
  for (const item of splitTopLevel(css)) {
    out += item.raw;
    if (item.body === null) continue;
    const prelude = item.prelude.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (prelude.startsWith('@')) {
      if (/^@(media|supports|layer)\b/.test(prelude) && !/prefers-color-scheme/.test(prelude)) {
        const inner = withAutoDark(item.body);
        if (inner !== item.body) out = out.slice(0, out.length - item.raw.length) + item.raw.slice(0, item.raw.indexOf('{') + 1) + inner + '}';
      }
      continue;
    }
    const dark = splitSelectors(prelude).map((sel) => sel.trim()).filter((sel) => DARK.test(sel) && sel.search(DARK) === 0);
    if (!dark.length) continue;
    const converted = dark.map((sel) => sel.replace(DARK, AUTO)).join(',\n    ');
    out += `\n@media (prefers-color-scheme: dark) {\n  ${converted} {${item.body}}\n}\n`;
  }
  return out;
}

async function buildCss(config) {
  const { breakpoints, layers } = config;
  const utilities = indexUtilities(layers);
  const ctx = {
    breakpoints,
    has: (name) => utilities.has(name),
    utility(name) {
      if (!utilities.has(name)) throw new Error(`generator asked for .${name}, which is not defined in src/css`);
      return utilities.get(name);
    },
  };

  const parts = [];
  parts.push(
    `/*!\n * ldcss v${pkg.version} — Lena Dijksma CSS\n * A small, opinionated framework: classes (ld-*) + custom attributes (data-ld-*)\n * License: MIT. Built from src/ — edit the files there, not this one.\n *\n * Cascade layers (lowest → highest priority): ${layers.map((l) => 'ld.' + l).join(' → ')}.\n * Anything you write outside a layer beats every one of them without\n * needing !important or a more specific selector.\n * Retired section numbers (kept so references stay stable): §16, §29.\n */\n`,
  );
  parts.push(`@layer ${layers.map((l) => 'ld.' + l).join(', ')};\n`);
  if (existsSync(join(SRC, 'css', 'head.css'))) parts.push(read(join(SRC, 'css', 'head.css')));

  for (const layer of layers) {
    const dir = join(SRC, 'css', layer);
    const chunks = [];
    for (const f of files(dir)) {
      if (f.endsWith('.gen.mjs')) {
        const mod = await import(pathToFileURL(join(dir, f)).href + `?t=${Date.now()}`);
        const generated = mod.default(ctx);
        indexCss(generated, utilities); // later generators (variants) can reuse these
        chunks.push(`/* generated by ${layer}/${f} */\n` + generated);
      } else if (f.endsWith('.css')) {
        chunks.push(read(join(dir, f)));
      }
    }
    if (chunks.length) parts.push(`@layer ld.${layer} {\n\n${withAutoDark(chunks.join('\n'))}\n}\n`);
  }
  return parts.join('\n');
}

/* ---------------------------------------------------------------------------
   Minifiers (deliberately conservative — they only remove what is certainly
   safe: comments, redundant whitespace, the last semicolon in a block)
   ------------------------------------------------------------------------- */

export function minifyCss(css) {
  let out = '';
  let i = 0;
  const n = css.length;
  let pendingSpace = false;

  const push = (s) => {
    if (pendingSpace) {
      const prev = out[out.length - 1];
      const next = s[0];
      // drop the space next to structural characters
      const noSpaceBefore = '{};,>~)'.includes(next);
      const noSpaceAfter = '{};,>~(:'.includes(prev);
      if (!noSpaceBefore && !noSpaceAfter && prev !== undefined) out += ' ';
      pendingSpace = false;
    }
    out += s;
  };

  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      if (css[i + 2] === '!') push(css.slice(i, stop) + '\n'); // keep /*! license */
      else if (out.length && /\s/.test(css[i - 1] || '')) pendingSpace = true;
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && css[j] !== c) j += css[j] === '\\' ? 2 : 1;
      push(css.slice(i, j + 1));
      i = j + 1;
    } else if (c === 'u' && css.startsWith('url(', i) && !/^['"]/.test(css[i + 4] || '')) {
      const end = css.indexOf(')', i);
      push(css.slice(i, end + 1));
      i = end + 1;
    } else if (/\s/.test(c)) {
      pendingSpace = true;
      i++;
    } else if (c === '}') {
      if (out.endsWith(';')) out = out.slice(0, -1); // last ; in a block is optional
      pendingSpace = false;
      out += '}';
      i++;
    } else {
      push(c);
      i++;
    }
  }
  return out.trim() + '\n';
}

export function minifyJs(js) {
  // Only whole-line comments, blank lines and indentation. Trailing `//`
  // comments are left alone because telling them apart from `//` inside a
  // string or regex needs a real parser.
  const noBlock = js.replace(/^[ \t]*\/\*(?!!)[\s\S]*?\*\/[ \t]*\r?\n/gm, '');
  return (
    noBlock
      .split('\n')
      .map((l) => l.replace(/^\s+/, '').replace(/\s+$/, ''))
      .filter((l) => l !== '' && !l.startsWith('//'))
      .join('\n') + '\n'
  );
}

/* ---------------------------------------------------------------------------
   Checks
   ------------------------------------------------------------------------- */

function check(css, breakpoints) {
  const problems = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""');
  const open = (stripped.match(/{/g) || []).length;
  const close = (stripped.match(/}/g) || []).length;
  if (open !== close) problems.push(`unbalanced braces: ${open} "{" vs ${close} "}"`);
  if (/@import/.test(stripped)) problems.push('contains @import — the font is meant to be self-hosted');
  const known = new Set(Object.values(breakpoints));
  const odd = new Set();
  for (const m of stripped.matchAll(/@media[^{]*?min-width:\s*(\d+)px/g)) if (!known.has(+m[1])) odd.add(+m[1]);
  if (odd.size) problems.push(`media queries use min-width values not in build/config.mjs: ${[...odd].join(', ')}px (warning only)`);
  return problems;
}

/* ---------------------------------------------------------------------------
   Main
   ------------------------------------------------------------------------- */

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1).padStart(6) + ' KB';
const gz = (s) => (gzipSync(s).length / 1024).toFixed(1).padStart(5) + ' KB gz';

async function build() {
  const t0 = performance.now();
  const config = await import(pathToFileURL(join(ROOT, 'build', 'config.mjs')).href + `?t=${Date.now()}`);

  const css = await buildCss(config);
  const minCss = minifyCss(css);
  const modulesDir = join(SRC, 'js', 'modules');
  const modules = files(modulesDir).filter((f) => f.endsWith('.js')).map((f) => read(join(modulesDir, f))).join('\n');
  const jsSrc = read(join(SRC, 'js', 'ldcss.js'))
    .replace('/* @ldcss-modules */', () => modules)
    .replace('__VERSION__', pkg.version);
  const banner = `/*! ldcss.js v${pkg.version} — MIT */\n`;
  const js = banner + jsSrc;
  const minJs = banner + minifyJs(jsSrc);

  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(join(DIST, 'fonts'), { recursive: true });
  writeFileSync(join(DIST, 'ldcss.css'), css);
  writeFileSync(join(DIST, 'ldcss.min.css'), minCss);
  writeFileSync(join(DIST, 'ldcss.js'), js);
  writeFileSync(join(DIST, 'ldcss.min.js'), minJs);
  for (const f of files(join(SRC, 'fonts'))) copyFileSync(join(SRC, 'fonts', f), join(DIST, 'fonts', f));
  // tiny blocking script for <head>: applies the saved theme before first paint
  const themeInit = `/*! ldcss-theme.js v${pkg.version} — MIT */\n` + minifyJs(read(join(SRC, 'js', 'theme-init.js')));
  writeFileSync(join(DIST, 'ldcss-theme.js'), themeInit);

  const rows = [
    ['ldcss.css', css],
    ['ldcss.min.css', minCss],
    ['ldcss.js', js],
    ['ldcss.min.js', minJs],
    ['ldcss-theme.js', themeInit],
  ];
  console.log(`ldcss v${pkg.version} built in ${Math.round(performance.now() - t0)} ms`);
  for (const [name, body] of rows) console.log(`  dist/${name.padEnd(14)} ${kb(body)}  ${gz(body)}`);

  const problems = check(css, config.breakpoints);
  for (const p of problems) console.warn('  ! ' + p);
  return problems.filter((p) => !p.endsWith('(warning only)')).length === 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--watch')) {
    let timer;
    const run = () => build().catch((e) => console.error('build failed:', e.message));
    await run();
    console.log('watching src/ and build/ …');
    for (const dir of ['src', 'build']) {
      watch(join(ROOT, dir), { recursive: true }, () => {
        clearTimeout(timer);
        timer = setTimeout(run, 100);
      });
    }
  } else {
    const ok = await build().catch((e) => {
      console.error('build failed:', e.message);
      return false;
    });
    process.exit(ok ? 0 : 1);
  }
}

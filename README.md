# ldcss

Lena Dijksma CSS: `ld-*` classes for structure, `data-ld-*` attributes for state and variants.

## Use it

Link the built files. No dependencies, no build needed to *use* ldcss.

```html
<link rel="stylesheet" href="dist/ldcss.css">   <!-- or dist/ldcss.min.css -->
<script src="dist/ldcss-theme.js"></script>     <!-- optional, in <head>: no theme flash -->
<script src="dist/ldcss.js"></script>           <!-- end of <body>; or dist/ldcss.min.js -->
```

Dark mode follows the operating system with no attribute and no JavaScript. Choose a theme with
`data-ld-theme="light|dark"` on `<html>`, or `ldcss.theme.set('dark')` (`'auto'` goes back to the OS).
`ldcss-theme.js` only applies a choice the visitor made earlier before the first paint.

Keep `dist/fonts/` next to the CSS file (JetBrains Mono is self-hosted).

## Edit it

```
src/css/<layer>/sNN-name.css    one file per section, one folder per cascade layer
src/css/**/*.gen.mjs            generated CSS (sidebar breakpoints, hover:/focus: variants)
src/css/head.css                @font-face (outside the layers)
src/js/ldcss.js                 core: shared helpers, original components, public API
src/js/modules/NN-name.js       newer components, inlined into the core by the build
src/fonts/                      JetBrains Mono (WOFF) + OFL license
build/config.mjs                breakpoints and layer order
build/build.mjs                 the build
```

```
npm run build     # once
npm run watch     # rebuild on every change
```

Needs Node 18+. There are no packages to install.

- **New component:** add `src/css/components/sNN-name.css`. Files are joined in
  file-name order inside their layer.
- **New utility:** add it to `src/css/utilities/`. To give it `hover:`/`focus:`
  variants, add its name to the lists in `src/css/variants/s40-state-variants.gen.mjs`.
- **Change a breakpoint:** edit `build/config.mjs` (affects generated CSS only; the
  hand-written responsive utilities in §38h still have their widths written out).

## Layers

`@layer ld.tokens, ld.base, ld.components, ld.utilities, ld.escape, ld.variants`

Later layers win no matter how specific the selectors are. CSS you write outside a
layer beats all of them, so overriding ldcss never needs `!important`:

```css
.ld-btn { border-radius: 0; }   /* beats ldcss as-is */
```

## Sidebar

See `demo-sidebar.html`. Short version:

```html
<div class="ld-shell" data-ld-collapse-at="sm">
  <aside class="ld-sidebar">…</aside>
  <main class="ld-shell-main">…</main>
</div>
```

## Pages

- `index.html` — landing page; every page's brand link goes here
- `demo.html` — everything, live (v3.1 section near the end)
- `demo-sidebar.html` — the sidebar shell
- `cheat-sheet.html` — every class, attribute and JavaScript call, with explanations, examples and search

## JavaScript

```js
ldcss.on('toast:show', (e, detail) => console.log(detail.id));   // one event system
ldcss.toast({ message: 'Saved', variant: 'success' });
ldcss.notify({ title: 'Build finished', message: 'main passed' });
ldcss.fuzzy.search('btn', items, { keys: ['name'] });
ldcss.a11y.audit();
```

Markup added after load is initialised automatically. See the cheat sheet's
"JavaScript API & events" page.

## Upgrading from 2.x

See `CHANGELOG.md` → 3.0.0 → Breaking. In short: use `dist/`, add
`data-ld-mark="$"` to any brand link that should keep its `$`, and expect utility
classes to beat component rules.

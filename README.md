# ldcss

Lena Dijksma CSS: `ld-*` classes for structure, `data-ld-*` attributes for state and variants.

## Use it

Link the built files. No dependencies, no build needed to *use* ldcss.

```html
<link rel="stylesheet" href="dist/ldcss.css">   <!-- or dist/ldcss.min.css -->
<script src="dist/ldcss.js"></script>           <!-- or dist/ldcss.min.js -->
```

Keep `dist/fonts/` next to the CSS file (JetBrains Mono is self-hosted).

## Edit it

```
src/css/<layer>/sNN-name.css    one file per section, one folder per cascade layer
src/css/**/*.gen.mjs            generated CSS (sidebar breakpoints, hover:/focus: variants)
src/css/head.css                @font-face (outside the layers)
src/js/ldcss.js                 behavior
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

- `demo.html` — everything, live
- `demo-sidebar.html` — the sidebar shell
- `cheat-sheet.html` — every class and attribute

## Upgrading from 2.x

See `CHANGELOG.md` → 3.0.0 → Breaking. In short: use `dist/`, add
`data-ld-mark="$"` to any brand link that should keep its `$`, and expect utility
classes to beat component rules.

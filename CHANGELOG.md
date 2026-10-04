# Changelog

## 3.1.1

Search bar (`data-ld-search`), one module.

- The search input was unstyled when you left off `ld-input`, and the magnifier was drawn over the
  placeholder text. The input now always gets `ld-input`.
- The magnifier is now a search button next to the field, joined to it (same height, one border,
  one focus ring). Clicking it does what Enter does.
- New `ld:search:submit` event (`{ query, source: 'enter' | 'button' }`, cancelable) and
  `ldcss.search.submit(el)`. A dropdown opens its results on submit; Enter with a result highlighted
  still chooses it. Inside a `<form>` the button is a real submit button, so the form submits (and a
  cancelled `ld:search:submit` stops it).
- `data-ld-search-button="false"` keeps a compact style with the icon inside the field.
  `data-ld-search-label` names the button (default "Search"); `data-ld-search-variant` sets its
  `data-ld-variant`.
- Fixed: Escape closed the dropdown and the browser's own "clear search" immediately reopened it,
  because `type="search"` inputs clear themselves on Escape and fire `input`. The first Escape now only
  closes the list; the second clears the field. This also affected the cheat sheet's search box.

## 3.1.0

**Fixed (builds on 3.0.1)**

- Carousel arrows jumped when pressed. Root cause: they were centred with
  `transform: translateY(-50%)`, and `.ld-btn:active` sets its own `transform` for the 1px press
  nudge, which replaced the centring. 3.0.1 hid it by hand-tuning `top: 40%` /
  `translateY(-15%)`, which is only centred for one carousel height (14px off in a short
  carousel, 14px off in a tall one) and still moved 6px on press. The arrows are now centred with
  `inset-block: 0; margin-block: auto`, so they stay centred at any height and move only by the
  intended 1px.
- `.ld-btn:active` now nudges with `translate: 0 1px` instead of `transform`, so it adds to any
  transform on a button (a centring transform, a hover lift) rather than replacing it.

**Docs and pages**

- `index.html` (your landing page) is part of the project now. It uses the framework's
  `ld-section` classes instead of local copies, has a skip link and `<main>`, lists the files that
  are really in the project, and the command palette links are relative (`goto:demo.html`), so they
  work from `file://` and from any folder.
- Demo: second notification dot shows a count, the password demo uses a longer value (your edits).
- LICENSE added to the project.

**New in 3.1.0**

**New components**

- Context menu: `data-ld-context-menu="#menu"`, `ld-context-menu`, `ld-context-item`. Right-click,
  long-press and Shift+F10 / menu key; arrow keys, type-ahead, Escape returns focus.
- Toast queue: `ldcss.toast({ title, message, variant, duration, id, actions, progress })`. At most
  `data-ld-toast-max` visible, the rest wait; hover or focus pauses; an existing `id` updates the toast.
- Notification centre: `ldcss.notify()`, `data-ld-notification-center`, `data-ld-notification-count`.
  Unread count, history, mark read, dismiss, clear; optional `localStorage` persistence.
- Resizable panels: `data-ld-resizable` with `ld-panel` children. Pointer and keyboard, min/max,
  collapse, reset, persistence.
- Disclosure: `data-ld-disclosure="#panel"` with `ld-disclosure` / `ld-disclosure-inner`. Animated,
  `inert` while closed, groups, label swap.
- Search bar: `data-ld-search` with fuzzy matching. Dropdown results (with the combobox) or
  `data-ld-search-filter` to filter content on the page; clear button, shortcut key, result count.
- Easy tables: `data-ld-table` adds keyboard-accessible sorting (numbers and dates detected),
  `data-ld-search`, `data-ld-page-size`, `data-ld-select`, an empty state and announcements.
- Fuzzy matching API: `ldcss.fuzzy.match / search / highlight`.

**Combobox**

- Remote sources (`data-ld-source="/api?q={q}"`), local JSON sources (`data-ld-source="#id"`) and
  `ldcss.combobox.source()`.
- Debounce, minimum characters, loading indicator, empty state, error state with retry.
- Typing again aborts the request in flight; late answers to old queries are discarded; per-query cache.
- Result templates (`data-ld-template`), `ldcss.combobox.render()`, groups, descriptions, matched-letter
  highlighting, `data-ld-limit`, `data-ld-group-limit`.
- Full ARIA combobox pattern: `aria-activedescendant`, `aria-busy`, a live region for result counts,
  PageUp / PageDown, Escape closes then clears.

**Utilities** (generated from `build/config.mjs` breakpoints)

- Sizing: `ld-w-*` (keywords and 10-100%), `ld-h-*`, `ld-min-w/h-*`, `ld-max-w/h-*`, `ld-size-*`.
- Flex: `ld-grow`, `ld-shrink`, `ld-basis-*`, `ld-content-*`, `ld-justify-items/self-*`, `ld-place-*`.
- Grid: `ld-grid-cols-7..12`, `ld-grid-rows-*`, `ld-grid-fit-*` / `ld-grid-fill-*`, `ld-span-*`,
  `ld-col-start/end-*`, `ld-row-span-*`, `ld-grid-flow-*`, `ld-auto-rows/cols-*`.
- Transitions and transforms: `ld-transition-*`, `ld-duration-*`, `ld-delay-*`, `ld-ease-*`,
  `ld-scale-*`, `ld-rotate-*`, `ld-translate-x/y-*`, `ld-origin-*`.
- `ld-hover:` / `ld-focus:` variants now also cover `scale-*` and `translate-*`.

**JavaScript**

- Unified event API: `ldcss.on(type, fn, { target, once, root })`, `ldcss.off`, `ldcss.once`,
  `ldcss.emit(el, name, detail, cancelable)`; `"*"` listens to every event. All events follow
  `ld:{component}:{event}`; `before-` events are cancelable.
- Mutation-aware initialiser: ldcss watches `<body>` and initialises markup added later.
  `data-ld-observe="false"` and `data-ld-no-observe` opt out; `ldcss.observe()` / `ldcss.unobserve()`.
- `ldcss.refresh(root)` now also initialises `root` itself. `ldcss.destroy()` also stops the observer
  and carousel timers.
- `ldcss.announce(message, politeness)` for screen-reader announcements; `ldcss.version`.
- JavaScript is split into `src/js/modules/` and inlined by the build.

**Accessibility**

- `aria-current` follows `data-ld-active` on nav, sidebar and pager links.
- Dropdown menus: `role="menu"`, arrow keys, Home / End, type-ahead.
- Page behind a modal, offcanvas or command palette is `inert`; dialogs are named from their heading.
- Tooltips become the accessible name or description and can be dismissed with Escape.
- `role="progressbar"` and `aria-pressed` filled in; carousel slide labels; autoplay stops for
  reduced motion and on focus; `aria-invalid` in `ld-validate` forms; command palette combobox roles.
- Small controls keep their size but get a 24 x 24px hit area.
- `forced-colors` rules for focus, borders and selected items.
- `ldcss.a11y.audit(root?)` lists common mistakes (missing alt, names, labels, duplicate ids, broken
  `aria-*` references, heading order, landmarks).

**Docs**

- `cheat-sheet.html` rewritten: 16 pages with a sidebar, sections with explanations and examples,
  previous / next paging, live examples, and fuzzy search across every class, attribute and page
  (`/` or Ctrl+K).

**Behaviour changes**

- The old `ldcss.js` toast function is replaced by the queued one; `showToast`-style calls and
  `data-ld-toggle="toast"` still work.
- Combobox static options now get `role="option"` and ARIA wiring automatically.
- Sortable `th[data-ld-sort]` headers on plain tables are focusable; tables with `data-ld-table`
  use buttons inside the header instead.

## 3.0.2

- The nav brand links to the landing page (`index.html`) on the demo, the sidebar demo and the
  cheat sheet. It is a relative link rather than `/`, so it also works when the files are opened
  straight from disk or hosted in a sub-folder.

## 3.0.1

- Minor fixes to the pages and the carousel arrows (see 3.1.0 for the root-cause fix).
- New `index.html` landing page.

## 3.0.0

**Breaking**

- `ldcss.css` is now built from `src/` into `dist/`. Link `dist/ldcss.css` (or
  `dist/ldcss.min.css`) and `dist/ldcss.js`; keep `dist/fonts/` next to the CSS.
- The framework sits in cascade layers: `ld.tokens → ld.base → ld.components →
  ld.utilities → ld.escape → ld.variants`. Utilities (and escape hatches) now beat
  component rules regardless of selector specificity. Visible effect: a shadow
  utility such as `ld-shadow-soft` also wins over a button's `:active` shadow and
  an interactive card's hover shadow. CSS you write outside any layer beats all of
  ldcss without `!important`.
- `.ld-nav-brand` no longer shows a `$` by default. Opt in with
  `data-ld-mark="$"` (any text works; empty or `true` means `$`; `none` still
  shows nothing).

**New**

- `ld-shell` + `ld-sidebar` (+ `-header`, `-toggle`, `-body`, `-links`, `-link`,
  `-heading`, `-footer`, `ld-shell-main`): sidebar app shell. Sticky column at
  and above a breakpoint, sticky top bar with a dropdown menu below it.
  `data-ld-collapse-at` on `ld-shell`: `sm` (default) · `md` · `lg` · `xl`. The
  menu closes on link click and Escape. Token: `--ld-sidebar-width`.
- `ld-hero`, `ld-section`, `ld-section-title`, `ld-section-sub`, `ld-row`
  (`data-ld-size="sm"` for compact hero/section). The demo pages no longer need
  local styles for them.
- `ld-hover:*`, `ld-focus:*`, `ld-focus-visible:*` variants of text/background
  colors, opacity, shadows, underline and ring. `hover:` only applies on devices
  that can hover. Generated by the build from the base utilities.
- Utilities: `ld-underline`, `ld-no-underline`, `ld-ring`.
- Tokens: `--ld-shadow-soft`, `--ld-shadow-soft-lg`, `--ld-sidebar-width`.
- `data-ld-theme="light"` now works on a subtree inside a dark page.
- Build script (`npm run build` / `npm run watch`): per-section sources, layer
  wrapping, generated CSS, minified CSS/JS, font copy, sanity checks.

**Fixed**

- `data-ld-notheme` was a hand-copied duplicate of the light tokens and had
  drifted (wrong `--ld-code-text`, `--ld-success` and `--ld-success-text`). It now
  shares one token block with `:root`.
- `data-ld-shadow="soft"` re-hardcoded both themes' shadow values; it now points
  at `--ld-shadow-soft`.
- Stale comments: the `--ld-code-text` "darker mint" note, the "success mirrors
  accent" note, and the escape-hatch note about `:active`/`:disabled`.
- `ld-row` was used in the demo pages but only defined in `demo.html`'s local
  styles, so it was missing in `cheat-sheet.html`. It is part of the framework now.
- `initTheme()` ran twice at the end of `ldcss.js`.
- `prefers-contrast: more` now also reaches `data-ld-theme="light"` and
  `data-ld-notheme` subtrees.
- JetBrains Mono is self-hosted (Latin subset, regular + bold, WOFF) instead of
  being loaded from Google Fonts. Weight 500 falls back to regular.

**Notes**

- Section numbers §16 and §29 are retired; the rest keep their numbers so
  existing references stay valid.

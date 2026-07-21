# ldcss

**Lena Dijksma CSS** — a small, dependency-free framework built on two ideas:

- **`ld-*` classes** handle structure (buttons, cards, nav, forms...)
- **`data-ld-*` attributes** handle variants, sizes, and state (`data-ld-variant="primary"`, `data-ld-size="lg"`, `data-ld-active="true"`...)

No build step, no npm install, no compiler. Two files, plain HTML.

```html
<link rel="stylesheet" href="ldcss.css">
<script src="ldcss.js" defer></script>
```

Everything is monospace (JetBrains Mono), sharp-edged (zero border-radius), and shadows are hard offsets rather than blurs — buttons and cards visibly "press" on click.

---

## Quick start

```html
<button class="ld-btn" data-ld-variant="primary" data-ld-size="lg">
  Run
</button>
```

That's the whole pattern. Structure comes from the class, everything else — color, size, state — comes from attributes sitting right next to it.

---

## Theming

Set `data-ld-theme="dark"` or `data-ld-theme="light"` on `<html>` (or any container) to theme that subtree. Toggle it from a button:

```html
<button class="ld-btn" data-ld-toggle="theme">Toggle theme</button>
```

`ldcss.js` remembers the choice in `localStorage` and reapplies it on load.

**`data-ld-notheme`** freezes an element (and everything inside it) at its light appearance, ignoring whatever theme an ancestor is set to. Useful for embeds, brand marks, or anything that shouldn't shift when the page theme changes.

```html
<div class="ld-card" data-ld-notheme>
  This card always looks the same, light or dark page.
</div>
```

---

## Components

### Buttons — `ld-btn`
```html
<button class="ld-btn" data-ld-variant="primary" data-ld-size="lg">Primary</button>
```
- `data-ld-variant`: `primary` · `outline` · `ghost` · `danger`
- `data-ld-size`: `sm` · `md` (default) · `lg`
- `data-ld-disabled="true"` (pair with the `disabled` attribute)
- `data-ld-prompt="true"` prefixes the label with `>`

### Badges — `ld-badge`
```html
<span class="ld-badge" data-ld-variant="primary">active</span>
```

### Cards — `ld-card`
```html
<div class="ld-card" data-ld-interactive="true" data-ld-shadow="lg">
  <div class="ld-card-eyebrow">Label</div>
  <div class="ld-card-title">Title</div>
  <div class="ld-card-body">Body copy.</div>
  <div class="ld-card-footer"><button class="ld-btn" data-ld-size="sm">Open</button></div>
</div>
```
- `data-ld-interactive="true"` lifts the card on hover
- Works with the `data-ld-shadow` / `data-ld-border` utilities below

### Nav — `ld-nav`
```html
<nav class="ld-nav">
  <a href="#" class="ld-nav-brand">brand</a>
  <ul class="ld-nav-links">
    <li><a href="#" class="ld-nav-link" data-ld-active="true">Home</a></li>
  </ul>
</nav>
```

### Forms — `ld-input`, `ld-textarea`, `ld-select`, `ld-checkbox`
```html
<div class="ld-form-group">
  <label class="ld-label" for="email">Email</label>
  <input class="ld-input" id="email" type="email" data-ld-error="true">
  <div class="ld-form-error">Enter a valid email address.</div>
</div>
```
- `data-ld-error="true"` on `.ld-input` / `.ld-textarea` switches to the error state

### Dropdown
```html
<div data-ld-dropdown>
  <button class="ld-btn" data-ld-toggle="dropdown">Menu ▾</button>
  <div data-ld-dropdown-menu>
    <a href="#">Profile</a>
    <button type="button">Sign out</button>
  </div>
</div>
```

### Tabs
```html
<div data-ld-tabs data-ld-panels="#panels">
  <button data-ld-toggle="tab" data-ld-target="#tab-1" data-ld-active="true">One</button>
  <button data-ld-toggle="tab" data-ld-target="#tab-2">Two</button>
</div>
<div id="panels">
  <div id="tab-1" data-ld-tab-panel class="ld-show">…</div>
  <div id="tab-2" data-ld-tab-panel>…</div>
</div>
```

### Modal
```html
<button class="ld-btn" data-ld-toggle="modal" data-ld-target="#my-modal">Open</button>

<div class="ld-modal-backdrop" id="my-modal">
  <div class="ld-modal">
    <div class="ld-modal-header">
      <h3>Title</h3>
      <button class="ld-modal-close" data-ld-dismiss="modal">×</button>
    </div>
    <p>Content.</p>
  </div>
</div>
```
Closes on Escape, backdrop click, or any `[data-ld-dismiss="modal"]`.

### Alerts — `ld-alert`
```html
<div class="ld-alert" data-ld-variant="success">
  <div class="ld-alert-body"><div class="ld-alert-title">Saved</div>Your changes were written.</div>
  <button class="ld-alert-close" data-ld-dismiss="alert">×</button>
</div>
```
- `data-ld-variant`: `info` · `success` · `warning` · `danger`

### Accordion
```html
<div data-ld-accordion="single">
  <div class="ld-accordion-item">
    <button class="ld-accordion-trigger" data-ld-toggle="accordion" data-ld-target="#a1" data-ld-active="true">Question</button>
    <div id="a1" data-ld-accordion-panel class="ld-show">Answer.</div>
  </div>
</div>
```
- `data-ld-accordion="single"` makes items mutually exclusive; omit for independent items

### Breadcrumbs — `ld-breadcrumbs`
```html
<ul class="ld-breadcrumbs">
  <li><a href="#">Home</a></li>
  <li data-ld-active="true">Docs</li>
</ul>
```

### Tooltip
```html
<button class="ld-btn" data-ld-tooltip="Shown on hover or focus" data-ld-tooltip-pos="bottom">Hover me</button>
```
- `data-ld-tooltip-pos`: `top` (default) · `bottom` · `left` · `right`

### Progress — `ld-progress`
```html
<div class="ld-progress">
  <div class="ld-progress-bar" data-ld-progress data-ld-value="72"></div>
</div>
```
`ldcss.js` reads `data-ld-value` (0–100) into the bar width on load.

### Kbd
```html
Press <span class="ld-kbd">⌘</span> + <span class="ld-kbd">K</span>
```

### Copy to clipboard
```html
<button class="ld-btn" data-ld-toggle="copy" data-ld-target="#snippet">Copy</button>
<pre id="snippet" class="ld-code">npm install ldcss</pre>
```
Or copy a literal string with `data-ld-copy="some text"` instead of `data-ld-target`.

### Terminal window — `ld-terminal`
```html
<div class="ld-terminal">
  <div class="ld-terminal-bar">
    <span class="ld-terminal-dot"></span><span class="ld-terminal-dot"></span><span class="ld-terminal-dot"></span>
    <span class="ld-terminal-title">install.sh</span>
  </div>
  <div class="ld-terminal-body">$ npm install ldcss</div>
</div>
```

### Spinner — `ld-spinner`
```html
<span class="ld-spinner"></span>
<span class="ld-spinner" data-ld-variant="dots"></span>
```

### Toast
```html
<button class="ld-btn" data-ld-toggle="toast" data-ld-toast-message="Build finished" data-ld-toast-variant="success">Notify</button>
```
Or call it from your own JS: `showToast(message, variant, durationMs)`.
- `data-ld-toast-variant`: `success` · `danger` (omit for neutral)
- `data-ld-toast-duration`: milliseconds before auto-dismiss (default `3000`)

### Table — `ld-table`
```html
<table class="ld-table" data-ld-striped="true" data-ld-bordered="false">
  <thead><tr><th>Name</th></tr></thead>
  <tbody><tr data-ld-interactive="true"><td>Row</td></tr></tbody>
</table>
```

### Pagination — `ld-pagination`

**Auto-generated** (recommended) — point it at a table or list and give it a page size; it builds the right number of page buttons and shows/hides items itself:
```html
<table id="demo-table">…9 rows…</table>
<ul class="ld-pagination" data-ld-paginate="#demo-table" data-ld-page-size="3"></ul>
```
9 rows at 3 per page builds 3 page buttons automatically — resize the data and the page count updates on next load. Works on a `<table>` (paginates its `<tbody>` rows) or any other container (paginates its direct children, e.g. a `<ul>` of cards).

**Manual** — write the buttons yourself if you want full control over labels/behavior:
```html
<ul class="ld-pagination">
  <li data-ld-page="prev"><button disabled>‹</button></li>
  <li data-ld-active="true"><button>1</button></li>
  <li><button>2</button></li>
  <li data-ld-page="next"><button>›</button></li>
</ul>
```
Mark the previous/next `<li>` with `data-ld-page="prev"` / `data-ld-page="next"` — everything else is treated as a page number. In manual mode you still get click handling and auto-disable at the ends, but you're responsible for showing/hiding your own content on page change.

### List group — `ld-list`
```html
<ul class="ld-list">
  <li class="ld-list-item" data-ld-interactive="true">Row</li>
  <li class="ld-list-item" data-ld-active="true">Selected row</li>
</ul>
```
Clicking any `.ld-list-item[data-ld-interactive="true"]` selects it (`data-ld-active="true"`) and deselects its siblings within the same `.ld-list`.

### Switch — `ld-switch`
```html
<label class="ld-switch">
  <input type="checkbox" checked> Email notifications
</label>
```

### Avatar — `ld-avatar`
```html
<span class="ld-avatar" data-ld-size="sm" data-ld-variant="accent">LD</span>
```
- `data-ld-size`: `sm` · `md` (default) · `lg`

### Popover
```html
<div data-ld-popover>
  <button class="ld-btn" data-ld-toggle="popover">Info ▾</button>
  <div data-ld-popover-content>
    <div class="ld-popover-title">Title</div>
    <p>Content.</p>
  </div>
</div>
```
Shares open/close/outside-click behavior with dropdown, just with richer content.

### Skeleton loader — `ld-skeleton`
```html
<div class="ld-skeleton" data-ld-shape="circle" style="width:40px;height:40px;"></div>
<div class="ld-skeleton" data-ld-shape="text"></div>
```

### Offcanvas / sidebar drawer
```html
<button class="ld-btn" data-ld-toggle="offcanvas" data-ld-target="#side-left">Open</button>

<div class="ld-offcanvas-backdrop" id="side-left">
  <div class="ld-offcanvas">
    <div class="ld-offcanvas-header">
      <strong>Navigation</strong>
      <button class="ld-offcanvas-close" data-ld-dismiss="offcanvas">×</button>
    </div>
    …
  </div>
</div>
```
Add `data-ld-pos="right"` on the `.ld-offcanvas-backdrop` to slide in from the right instead of the left. Closes on Escape, backdrop click, or `[data-ld-dismiss="offcanvas"]`, and returns focus to the button that opened it.

### Stepper — `ld-stepper`
```html
<ul class="ld-stepper">
  <li class="ld-step" data-ld-complete="true"><span class="ld-step-index">✓</span> Account</li>
  <li class="ld-step" data-ld-active="true"><span class="ld-step-index">2</span> Details</li>
  <li class="ld-step"><span class="ld-step-index">3</span> Review</li>
</ul>
```

### Command palette
```html
<button data-ld-toggle="command" data-ld-target="#cmdk">⌘K</button>

<div class="ld-command-backdrop" id="cmdk">
  <div class="ld-command">
    <input class="ld-command-input" type="text" placeholder="Type a command…" data-ld-autofocus>
    <ul class="ld-command-list" data-ld-command-list>
      <li class="ld-command-item" data-ld-command-item>Open dashboard</li>
    </ul>
    <div class="ld-command-empty">No matching commands.</div>
  </div>
</div>
```
Opens with the trigger button *or* <kbd>⌘/Ctrl</kbd>+<kbd>K</kbd> from anywhere on the page (as long as one `.ld-command-backdrop` exists). Type to filter, arrow keys to move the highlight, Enter to select.

Give an item something to actually do with `data-ld-command-action="type:arg"`:
```html
<li data-ld-command-item data-ld-command-action="theme">Toggle theme</li>
<li data-ld-command-item data-ld-command-action="toast:Created new-file.txt">Create new file</li>
<li data-ld-command-item data-ld-command-action="offcanvas:#side-left">Open dashboard</li>
<li data-ld-command-item data-ld-command-action="modal:#some-modal">Open settings</li>
```
Supported types: `theme` · `toast:message` · `offcanvas:#id` · `modal:#id`. For anything else, listen for clicks on `[data-ld-command-item]` yourself.

### Range slider — `ld-range`
```html
<input type="range" class="ld-range" min="0" max="100" value="65">
```

### Dropzone / file upload
```html
<label data-ld-dropzone>
  <input type="file">
  Drop a file here, or click to browse
  <div data-ld-dropzone-filename>No file selected</div>
</label>
```
Handles click-to-browse and drag-and-drop, and updates the element flagged `data-ld-dropzone-filename` with the selected filename(s). Point `data-ld-dropzone-label="#some-id"` at the zone if you'd rather the filename go somewhere else.

### Rating — `data-ld-rating`
```html
<div data-ld-rating data-ld-value="3">
  <button type="button" data-ld-star>★</button>
  <button type="button" data-ld-star>★</button>
  <button type="button" data-ld-star>★</button>
  <button type="button" data-ld-star>★</button>
  <button type="button" data-ld-star>★</button>
</div>
```
`data-ld-value` sets the initial rating; clicking a star updates it and reflects the new value back onto the wrapper's `data-ld-value`.

### Tag input — `data-ld-tags`
```html
<div data-ld-tags>
  <span class="ld-tag"><span>design</span><button type="button" class="ld-tag-remove">×</button></span>
  <input type="text" data-ld-tags-input placeholder="Add a tag, press Enter">
</div>
```
Enter or comma adds a tag from the input's current text; Backspace on an empty input removes the last tag; the × button on any tag removes it.

---

## Escape hatches

ldcss defaults to sharp corners, hard offset shadows, and monospace type — but any element can opt out individually. These are plain utility classes, mix and match freely.

**Rounded corners**
```html
<div class="ld-card ld-round">…</div>       <!-- 8px -->
<div class="ld-card ld-round-sm">…</div>    <!-- 4px -->
<div class="ld-card ld-round-lg">…</div>    <!-- 16px -->
<div class="ld-card ld-round-xl">…</div>    <!-- 24px -->
<div class="ld-avatar ld-round-full">…</div> <!-- pill / circle -->
```

**Border width × style**
```html
<div class="ld-border-1px-solid">…</div>
<div class="ld-border-2px-dashed">…</div>
<div class="ld-border-3px-dotted">…</div>
<div class="ld-border-2px-double">…</div>
<div class="ld-border-0">…</div> <!-- remove border entirely -->
```
Pattern is `ld-border-{1,2,3,4}px-{solid,dashed,dotted,double}`. Color defaults to the standard border token — override with inline `border-color` if you need something else.

**Soft shadows** (blurred, instead of the hard offset default)
```html
<div class="ld-card ld-shadow-soft">…</div>
<div class="ld-card ld-shadow-soft-sm">…</div>
<div class="ld-card ld-shadow-soft-lg">…</div>
<div class="ld-card ld-shadow-none">…</div>
```
These also win on `:hover`/`:active`/`:disabled`/`:focus` — a `ld-shadow-soft` button, card, or input stays soft through every interaction state instead of snapping back to the hard offset shadow mid-click.

**Type**
```html
<body class="ld-font-sans">…</body>
<p class="ld-font-serif">…or serif, for a different register.</p>
```
`ld-font-sans`/`ld-font-serif` set an inheritable `--ld-font-family` token, so applying it once to `<body>` (or any wrapper) cascades to every component underneath — buttons, inputs, headings, tabs, everything that reads the token. You don't need to repeat it per element. `code`, `pre`, and `ld-kbd` stay monospace regardless, since that's semantic rather than thematic.

**Nav brand mark**
```html
<a href="#" class="ld-nav-brand" data-ld-mark="none">brand</a> <!-- no "$" prefix -->
```
`.ld-nav-brand` normally prefixes a `$` (terminal-style branding); `data-ld-mark="none"` removes it while keeping the rest of the component's styling (weight, size, no-underline). For a bare link with none of `.ld-nav-brand`'s styling at all, use `ld-link-reset` (`text-decoration: none; color: inherit;`) instead.

**Density scale** — override spacing tokens for a whole subtree
```html
<div class="ld-scale-compact">…tighter padding throughout…</div>
<div class="ld-scale-spacious">…looser padding throughout…</div>
```
`ld-scale-cozy` is the (identical) default — useful if you need to reset back to it inside a `compact`/`spacious` ancestor.

**Per-element accent** — swap the brand color without touching the theme
```html
<div class="ld-card ld-accent-blue">
  <button class="ld-btn" data-ld-variant="primary">Blue in here</button>
</div>
```
Options: `ld-accent-mint` (default) · `blue` · `purple` · `pink` · `orange` · `yellow` · `red`.

**Surface registers** — alternatives to the bordered/shadowed default
```html
<div class="ld-card ld-glass">Frosted, translucent background</div>
<div class="ld-flat">No border, shadow, or padding — just content</div>
```

---

## Utility attributes

Available on most components:

| Attribute | Values | Effect |
|---|---|---|
| `data-ld-shadow` | `none` · `sm` · `md` · `lg` | Hard offset shadow depth |
| `data-ld-border` | `none` · `thin` · `thick` · `accent` | Border weight/color |

## Layout

```html
<div class="ld-container">…</div>
<div class="ld-grid" data-ld-cols="3">…</div>
<div class="ld-stack">…</div> <!-- vertical spacing between children -->
```
`data-ld-cols` accepts `2`, `3`, or `4` and is responsive (collapses to 1 column on small screens).

## Spacing utilities

Bootstrap-style, generated once into `ldcss.css` (no build step — every class already exists in the file).

**Pattern:** `ld-{pad|mar}-{side}-{size}`

| Part | Options |
|---|---|
| `pad` / `mar` | padding / margin |
| side | `a` all · `t` top · `r` right · `b` bottom · `l` left · `v` vertical (top+bottom) · `h` horizontal (left+right) |
| size | `0` `1` `2` `3` `4` `5` `6` `8` — maps to `--ld-space-{size}` (same scale used everywhere else in ldcss, so it stays in sync with `ld-scale-compact` / `ld-scale-spacious`) |

```html
<div class="ld-pad-a-4">padding on all sides, --ld-space-4</div>
<div class="ld-mar-v-6">margin-top + margin-bottom, --ld-space-6</div>
<div class="ld-pad-h-3 ld-mar-t-2">horizontal padding + top margin</div>
```

Negative margins follow the same pattern with an `n` before the size (skip `0`, there's no such thing as `-0`):

```html
<div class="ld-mar-t-n3">pulls the element up by --ld-space-3</div>
```

Gap, for flex/grid containers, uses the same size scale:

```html
<div class="ld-d-flex ld-gap-3">…</div>       <!-- gap on both axes -->
<div class="ld-d-grid ld-gap-x-4 ld-gap-y-2">…</div>
```

## Display & flex utilities

```html
<div class="ld-d-flex ld-flex-row ld-items-center ld-justify-between ld-gap-3">
  <span>Left</span>
  <span>Right</span>
</div>
```

- `ld-d-{block, inline, inline-block, flex, inline-flex, grid, none}`
- `ld-flex-{row, row-rev, col, col-rev}`, `ld-flex-{wrap, nowrap}`, `ld-flex-{1, auto, none}`
- `ld-items-{start, center, end, stretch, baseline}` (`align-items`)
- `ld-justify-{start, center, end, between, around, evenly}` (`justify-content`)
- `ld-text-{left, center, right}`
- `ld-w-{25, 50, 75, 100}` (percentage width)
- `ld-max-w-{sm, md, lg, xl, full}` (480 / 640 / 800 / 1000px / 100%)
- `ld-aspect-{square, video, 4-3, 3-2}` (1/1, 16/9, 4/3, 3/2)
- `ld-mx-auto` / `ld-my-auto` — auto-margin centering

These live in `ldcss.css` §38a–38b and are plain generated CSS — inspect the source if you want to extend the pattern (e.g. add a `9` size, or a `ld-pad-t-7`) yourself; there's no build tool involved, just find-and-extend the block.

## Typography utilities

```html
<h3 class="ld-text-xl ld-font-bold ld-uppercase ld-tracking-wide">Section title</h3>
<p class="ld-truncate" style="max-width: 200px;">This will get cut off with an ellipsis…</p>
<p class="ld-line-clamp-2">Clamped to 2 lines, overflow hidden, works in every evergreen browser.</p>
<p class="ld-italic">Emphasis without reaching for &lt;em&gt;.</p>
```

- `ld-text-{xs, sm, base, lg, xl, 2xl}` — font-size, maps to the same `--ld-text-*` tokens used throughout the file
- `ld-font-{normal, medium, bold}` — font-weight
- `ld-uppercase` / `ld-lowercase` / `ld-capitalize`
- `ld-italic` / `ld-not-italic`
- `ld-tracking-wide` — `letter-spacing: 0.05em`
- `ld-truncate` — single-line ellipsis (needs a constrained width)
- `ld-line-clamp-{2, 3}` — multi-line ellipsis

Note: `ld-text-*` is reused for three different jobs across the file (alignment `left/center/right`, size `xs…2xl`, color `muted/accent/danger`) — same convention Tailwind uses. The value vocabularies don't overlap, so there's no collision, but don't expect `ld-text-lg` to also center anything.

## Color utilities

```html
<span class="ld-text-danger">Something went wrong</span>
<div class="ld-bg-raised ld-pad-a-4">Card-like surface without the .ld-card component</div>
```

- `ld-text-{muted, accent, danger}` — `ld-text-muted` and `ld-text-accent` already existed in §37 (Misc); `ld-text-danger` is new
- `ld-bg-{surface, raised, transparent}`

## Position & z-index utilities

```html
<div class="ld-relative">
  <span class="ld-absolute ld-top-0 ld-right-0 ld-z-tooltip">badge</span>
</div>
```

- `ld-{static, relative, absolute, fixed, sticky}`
- `ld-inset-0`, `ld-top-0`, `ld-right-0`, `ld-bottom-0`, `ld-left-0`
- `ld-z-{0, 10, 20, 30, 40, 50}` — generic numeric scale
- `ld-z-{dropdown, popover, tooltip, modal, offcanvas, toast, command}` — named aliases that match the *exact* stacking order ldcss's own components already use (20 / 25 / 30 / 50 / 55 / 60 / 70), so custom overlays can slot in between them predictably

## Flex extras & grid columns

```html
<div class="ld-d-flex">
  <div class="ld-self-center ld-order-last">moved to the end, centered on cross axis</div>
</div>
<div class="ld-d-grid ld-grid-cols-3 ld-gap-3">…</div>
```

- `ld-self-{start, center, end, stretch}` — per-item `align-self`, overrides `ld-items-*`
- `ld-order-{1..5}`, `ld-order-first`, `ld-order-last`
- `ld-grid-cols-{1..6}` — general-purpose grid columns, independent of `.ld-grid`/`data-ld-cols` (which is capped at 2/3/4). Pair with `ld-d-grid`.

## Visibility & interaction utilities

```html
<button class="ld-cursor-pointer">
  <span class="ld-sr-only">Close</span>
  ✕
</button>
```

- `ld-sr-only` — visually hidden but readable by screen readers; good for icon-only buttons
- `ld-cursor-{pointer, not-allowed, default}`
- `ld-select-none` — disables text selection (drag handles, steppers, tabs)
- `ld-overflow-{hidden, auto, scroll, visible}`

## Responsive variants

A small set of breakpoint-prefixed utilities, using the same breakpoints `.ld-grid` already uses internally (`sm` = 640px, `md` = 960px):

```html
<div class="ld-d-none ld-md:d-flex">Hidden until 960px, then flex</div>
<div class="ld-grid-cols-1 ld-sm:grid-cols-2 ld-md:grid-cols-3">…</div>
```

- `ld-sm:d-*`, `ld-md:d-*` — responsive display
- `ld-sm:grid-cols-{1..6}`, `ld-md:grid-cols-{1..6}` — responsive grid columns

Only `display` and `grid-cols` got responsive variants for now — those are the two utilities layout most often needs to flip at a breakpoint. If you need e.g. `ld-md:pad-a-6`, copy the pattern in `ldcss.css` §38h; it's a mechanical extension (wrap the class in the relevant `@media (min-width: …)` block and escape the colon with `\:`).

## Code blocks

```html
<pre class="ld-code">…</pre>
<code class="ld-code-inline">…</code>
```
Uses `--ld-code-text`, a token tuned separately per theme so mint-on-white stays readable in light mode.

---

## Accessibility

- **Focus management** — modal, offcanvas, and command palette trap Tab within themselves while open, and return focus to whatever triggered them on close.
- **ARIA state** — dropdown/popover/accordion triggers get `aria-expanded`; accordion/tab panels get `aria-hidden`; tabs get `aria-selected`; modal/offcanvas get `role="dialog"` + `aria-modal="true"`.
- **Live region** — the toast container is `role="status"` / `aria-live="polite"`, so screen readers announce new toasts without stealing focus.
- **`prefers-contrast: more`** — muted text and soft borders switch to full-contrast values automatically when the user has requested higher contrast at the OS/browser level.

This covers the common cases but isn't a substitute for testing with a real screen reader on your actual markup — always verify in your specific context.

## JavaScript API

`ldcss.js` is a single IIFE, no globals except one helper function:

```js
showToast('Saved.', 'success', 4000);
```

Everything else is wired through delegated click/keydown/input listeners reading `data-ld-toggle`:

`theme` · `dropdown` · `popover` · `tab` · `modal` · `offcanvas` · `command` · `accordion` · `copy` · `toast`

Escape closes any open dropdown, popover, modal, offcanvas, or command palette. <kbd>⌘/Ctrl</kbd>+<kbd>K</kbd> opens the command palette from anywhere.

---

## Design tokens

All colors, spacing, and type live in CSS custom properties on `:root`, overridden by `[data-ld-theme='dark']` and `[data-ld-notheme]`. Override any of them yourself:

```css
:root {
  --ld-accent: #46E8B3;
  --ld-font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --ld-radius: 0px;
  --ld-border-width: 2px;
  --ld-shadow-offset: 4px;
}
```

See the top of `ldcss.css` for the full token list.

---

## Browser support

Modern evergreen browsers (CSS custom properties, `:focus-visible`, `prefers-reduced-motion`). No IE support.

## Files

- `ldcss.css` — all styles and tokens
- `ldcss.js` — interactive component behavior
- `demo.html` — every component in use, doubles as living docs

## License

MIT.

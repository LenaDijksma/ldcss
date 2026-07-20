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
```html
<ul class="ld-pagination">
  <li><button disabled>‹</button></li>
  <li data-ld-active="true"><button>1</button></li>
  <li><button>2</button></li>
</ul>
```

### List group — `ld-list`
```html
<ul class="ld-list">
  <li class="ld-list-item" data-ld-interactive="true">Row</li>
  <li class="ld-list-item" data-ld-active="true">Selected row</li>
</ul>
```

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

**Type**
```html
<p class="ld-font-sans">Long-form copy that doesn't need to be monospace.</p>
<p class="ld-font-serif">…or serif, for a different register.</p>
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

## Code blocks

```html
<pre class="ld-code">…</pre>
<code class="ld-code-inline">…</code>
```
Uses `--ld-code-text`, a token tuned separately per theme so mint-on-white stays readable in light mode.

---

## JavaScript API

`ldcss.js` is a single IIFE, no globals except one helper function:

```js
showToast('Saved.', 'success', 4000);
```

Everything else is wired through delegated click/keydown listeners reading `data-ld-toggle`:

`theme` · `dropdown` · `popover` · `tab` · `modal` · `accordion` · `copy` · `toast`

Escape closes any open dropdown, popover, or modal.

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

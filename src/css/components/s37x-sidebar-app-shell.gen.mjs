// Breakpoint-dependent half of the sidebar (§37x). The common rules live in
// s37x-sidebar-app-shell.css; this file repeats the "sidebar is a column"
// block once per breakpoint in the build's breakpoint table.
//
// Default (no data-ld-collapse-at) is the `sm` breakpoint.

export default function ({ breakpoints }) {
  const out = ['/* -- At and above the breakpoint: sticky sidebar column (generated) ---------- */\n'];

  for (const [name, px] of Object.entries(breakpoints)) {
    // `sm` also answers to "no attribute at all"
    const shell = name === 'sm'
      ? (rest = '') => `.ld-shell:not([data-ld-collapse-at])${rest},\n  .ld-shell[data-ld-collapse-at='sm']${rest}`
      : (rest = '') => `.ld-shell[data-ld-collapse-at='${name}']${rest}`;

    out.push(`@media screen and (min-width: ${px}px) {
  ${shell()} {
    display: grid;
    grid-template-columns: var(--ld-sidebar-width) minmax(0, 1fr);
    align-items: start;
  }

  ${shell(' > .ld-sidebar')} {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    overflow-y: auto;
    border-bottom: 0;
    border-inline-end: var(--ld-border-width) solid var(--ld-border);
  }

  ${shell(' .ld-sidebar-toggle')} {
    display: none;
  }

  ${shell(' .ld-sidebar-body')} {
    display: flex;
    position: static;
    flex: 1 1 auto;
    max-height: none;
    overflow: visible;
    padding: var(--ld-space-2) var(--ld-space-4) var(--ld-space-4);
    border: 0;
    box-shadow: none;
  }

  ${shell(' .ld-shell-main [id]')} {
    scroll-margin-top: 0;
  }
}
`);
  }
  return out.join('\n');
}

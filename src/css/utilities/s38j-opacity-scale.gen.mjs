// §38j — opacity scale (generated from the --ld-opacity-* tokens)
//
// ld-opacity-N reads var(--ld-opacity-N), so overriding a token (for example
// --ld-opacity-50: 0.45 on :root) changes every use of it. 0, 25, 50, 75 and
// 100 are the ones that existed before 3.3.0.

const SCALE = [0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100];

export default function () {
  const out = ['/* ==========================================================================\n   38j. Opacity scale\n   ========================================================================== */\n'];
  for (const n of SCALE) out.push(`.ld-opacity-${n} {\n  opacity: var(--ld-opacity-${n});\n}\n`);
  out.push('.ld-opacity-disabled {\n  opacity: var(--ld-opacity-disabled);\n}\n');
  return out.join('\n');
}

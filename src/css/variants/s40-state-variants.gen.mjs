// §40 State variants: ld-hover:*, ld-focus:*, ld-focus-visible:*
//
// Nothing here is written by hand. For every utility in the lists below the
// build looks up the utility's own declarations and re-emits them under the
// state, so `ld-hover:bg-accent` can never disagree with `ld-bg-accent`.
// Add a name to a list to get its variants; rebuild.
//
//   <a class="ld-text-muted ld-hover:text-accent ld-underline-none ld-hover:underline">
//   <button class="ld-btn ld-focus-visible:ring">
//
// Lives in the last cascade layer (ld.variants), so a variant also beats the
// escape-hatch utilities (ld-shadow-soft, …) that sit in an earlier layer.

const text = ['muted', 'accent', 'danger'].map((n) => `text-${n}`);
const bg = ['surface', 'raised', 'transparent', 'accent', 'danger', 'success', 'warning', 'info'].map((n) => `bg-${n}`);
const opacity = [0, 25, 50, 75, 100].map((n) => `opacity-${n}`);
const shadow = ['none', 'soft-sm', 'soft', 'soft-lg', 'up-sm', 'up', 'up-lg'].map((n) => `shadow-${n}`);
const decoration = ['underline', 'no-underline'];
const ring = ['ring'];
const motion = ['scale-95', 'scale-100', 'scale-105', 'scale-110', 'translate-y-n1', 'translate-y-n2', 'translate-y-0', 'translate-x-1'];

const VARIANTS = [
  // name,           pseudo-class,      wrapper
  ['hover', ':hover', '@media (hover: hover)'], // not on touch screens: no "stuck" hover
  ['focus', ':focus', null],
  ['focus-visible', ':focus-visible', null], // keyboard focus only
];

const UTILITIES = {
  hover: [...text, ...bg, ...opacity, ...shadow, ...decoration, ...motion],
  focus: [...text, ...bg, ...opacity, ...shadow, ...decoration, ...ring, ...motion.slice(0, 4)],
  'focus-visible': [...bg, ...opacity, ...shadow, ...decoration, ...ring],
};

export default function ({ utility }) {
  const blocks = [];
  for (const [variant, pseudo, wrapper] of VARIANTS) {
    const rules = UTILITIES[variant].map((name) => {
      const body = utility(`ld-${name}`); // throws if the base utility is gone
      return `.ld-${variant}\\:${name}${pseudo} {${body}}`;
    });
    const inner = rules.join('\n\n');
    blocks.push(wrapper ? `${wrapper} {\n${inner.replace(/^/gm, '  ')}\n}` : inner);
  }
  return blocks.join('\n\n') + '\n';
}

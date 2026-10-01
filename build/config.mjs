// One place for the numbers the rest of the framework should agree on.
// Generated CSS (sidebar breakpoints, …) reads this table, so changing a
// breakpoint here changes it everywhere the build generates CSS.
export const breakpoints = {
  sm: 640,
  md: 960,
  lg: 1200,
  xl: 1440,
};

// Cascade layers, lowest priority first. Each folder in src/css/ is one
// layer of the same name, and the build wraps its files in
// `@layer ld.<name> { … }`. Later layers beat earlier ones no matter how
// specific the selectors are.
export const layers = ['tokens', 'base', 'components', 'utilities', 'escape', 'variants'];

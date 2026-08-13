/**
 * Axinfra brand tokens — ported from the web app's `src/app/globals.css`
 * `:root` block (the "Obsidian Gold" theme, the default/only theme shown on
 * the logged-out login and register screens on web). Keep these two files in
 * sync if the web palette changes.
 */
export const Brand = {
  base: '#0a0c10',
  surface: '#0d0f13',
  input: '#1a1c22',
  inputBorder: 'rgba(255,255,255,0.1)',
  border: 'rgba(255,255,255,0.08)',
  overlay: 'rgba(255,255,255,0.03)',
  overlayHover: 'rgba(255,255,255,0.05)',

  accent: '#c4a35a',
  accentHover: '#b3943f',
  accentRgb: '196,163,90',
  btnText: '#0a0c10',

  text: '#e8e4dc',
  textRgb: '232,228,220',

  error: '#e06050',
  errorBg: 'rgba(220,80,60,0.1)',
  errorBorder: 'rgba(224,96,80,0.3)',
  success: '#22c55e',
} as const;

/** e.g. withAlpha(Brand.textRgb, 0.55) === 'rgba(232,228,220,0.55)' — mirrors
 * the web app's `rgba(var(--ax-text-rgb), N)` pattern. */
export function withAlpha(rgb: string, alpha: number): string {
  return `rgba(${rgb},${alpha})`;
}

export const BrandRadius = {
  card: 16,
  btn: 12,
  input: 10,
} as const;

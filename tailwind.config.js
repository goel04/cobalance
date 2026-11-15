/** @type {import('tailwindcss').Config} */

// Colours are CSS variables (RGB channels) so a subtree can be re-themed.
// Light values live on :root (the app); `.theme-space` (marketing + auth) overrides them. See src/index.css.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: v('forest'), deep: v('forest-deep'), 50: v('forest-50'), 100: v('forest-100') },
        sage: { DEFAULT: v('sage'), light: v('sage-light') },
        canvas: v('canvas'),
        surface: v('surface'),
        ink: { DEFAULT: v('ink'), muted: v('ink-muted') },
        // `line` carries its own alpha so the space theme can use a translucent hairline.
        line: 'rgb(var(--c-line) / var(--a-line, 1))',
        'on-forest': v('on-forest'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
    },
  },
  plugins: [],
};

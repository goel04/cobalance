/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: '#236B45', deep: '#174A32', 50: '#EEF5F0', 100: '#DCEBE1' },
        sage: { DEFAULT: '#A7C4A0', light: '#E4EEE1' },
        canvas: '#F7F9F6',
        surface: '#FFFFFF',
        ink: { DEFAULT: '#202923', muted: '#6B756E' },
        line: '#E3E9E2',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(32,41,35,0.04), 0 1px 3px rgba(32,41,35,0.06)',
        pop: '0 8px 24px rgba(32,41,35,0.10)',
      },
    },
  },
  plugins: [],
};

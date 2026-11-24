/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 全部走 CSS 变量，深浅主题在 index.css 里换值
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        accru: 'rgb(var(--c-accru) / <alpha-value>)',
        accru2: 'rgb(var(--c-accru2) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        fg: 'rgb(var(--c-fg) / <alpha-value>)',
        fg2: 'rgb(var(--c-fg2) / <alpha-value>)',
        fg3: 'rgb(var(--c-fg3) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        dangerline: 'rgb(var(--c-dangerline) / <alpha-value>)',
        dangerfg: 'rgb(var(--c-dangerfg) / <alpha-value>)',
        dangerfg2: 'rgb(var(--c-dangerfg2) / <alpha-value>)',
        dangericon: 'rgb(var(--c-dangericon) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

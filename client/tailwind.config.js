/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        sans: ['Source Sans 3', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
          deep: 'rgb(var(--surface-deep) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--ink-faint) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          dim: 'rgb(var(--accent-dim) / <alpha-value>)',
          glow: 'rgb(var(--accent-glow) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
        risk: {
          green: '#34d399',
          yellow: '#fbbf24',
          red: '#f87171',
        },
      },
      boxShadow: {
        card: '0 0 0 1px rgb(var(--line) / 0.55), 0 24px 48px -24px rgb(0 0 0 / 0.45)',
        'card-lg':
          '0 0 0 1px rgb(var(--line) / 0.5), 0 32px 64px -32px rgb(0 0 0 / 0.55)',
        glow: '0 0 48px -8px rgb(var(--accent-glow) / 0.35)',
        inset: 'inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, rgb(var(--surface-deep) / 0.92), rgb(var(--surface) / 0.98)), radial-gradient(rgb(var(--line) / 0.45) 1px, transparent 1px)',
        shimmer:
          'linear-gradient(90deg, transparent, rgb(var(--accent) / 0.08), transparent)',
      },
      backgroundSize: {
        grid: '24px 24px',
      },
      animation: {
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

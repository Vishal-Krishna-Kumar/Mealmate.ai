/** @type {import('tailwindcss').Config} */
//
// MealMate design system — inspired by Anthropic / Claude's warm,
// editorial palette. Cream canvas, deep ink type, terracotta accent.
// The `brand` scale is the accent itself so every existing
// `bg-brand-*` / `text-brand-*` utility re-themes automatically.
//
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Page surfaces
        canvas: '#F5EFE6',        // warm cream — main page background
        'canvas-soft': '#FAF6EF', // slightly lighter cream
        card: '#FFFDF9',          // off-white card surface

        // Ink (text)
        ink: '#2A2723',           // deep warm near-black
        'ink-soft': '#5B544A',    // secondary body
        'ink-mute': '#8B8479',    // captions / hints

        // Hairlines / dividers
        line: '#E6DDCC',
        'line-strong': '#CDC2AC',

        // Terracotta accent (Claude-orange family, tuned for food)
        brand: {
          50: '#FBF1EC',
          100: '#F4DDD0',
          200: '#EBC2AB',
          300: '#DDA382',
          400: '#CC8662',
          500: '#BD6D49',
          600: '#A85638',
          700: '#8C4528',
          800: '#6E3520',
          900: '#4F261A',
        },

        // Auxiliary green for sustainability / nutrition chips
        sage: {
          50: '#EFF3EC',
          100: '#D8E2D2',
          500: '#7E956C',
          600: '#5F7752',
          700: '#475A3D',
        },
      },
      fontFamily: {
        serif: ['"Fraunces"', '"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(42, 39, 35, 0.04), 0 8px 24px rgba(42, 39, 35, 0.06)',
        ring: '0 0 0 1px rgba(42, 39, 35, 0.06)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
    },
  },
  plugins: [],
};

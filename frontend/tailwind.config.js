/** @type {import('tailwindcss').Config} */

// The design system's single source of truth.
//
// Palette reasoning: a near-black base with a very slight blue cast (#0A0A0F
// rather than pure #000) because pure black on an OLED panel makes every
// border and shadow disappear, and the whole UI depends on soft elevation to
// read as calm rather than flat. Surfaces step up in small, even increments so
// depth is legible without a single hard line.
//
// Accent is indigo, not the usual SaaS purple gradient. Indigo reads as
// considered and institutional; purple reads as a launch announcement. This
// product is asking people to trust an assessment of their skills.

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base surfaces — each step is deliberately small.
        base: {
          DEFAULT: '#0A0A0F',
          50: '#16161D',
          100: '#12121A',
          200: '#0E0E15',
          900: '#050508',
        },
        surface: {
          DEFAULT: '#101018',
          raised: '#16161F',
          overlay: '#1C1C27',
          hover: '#1F1F2B',
        },
        line: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          strong: 'rgba(255,255,255,0.12)',
          focus: 'rgba(99,102,241,0.55)',
        },
        ink: {
          DEFAULT: '#F4F4F6',
          muted: '#A1A1B5',
          subtle: '#6E6E85',
          faint: '#4A4A5C',
        },
        brand: {
          50: '#EEF0FF',
          100: '#E0E3FF',
          300: '#A5B0FF',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          900: '#282566',
        },
        accent: {
          cyan: '#22D3EE',
          teal: '#2DD4BF',
        },
        // Semantic scoring colours. Used for score bands everywhere — the
        // report, the live rail, the dashboard — so a colour always means the
        // same thing to the user.
        band: {
          exceptional: '#34D399',
          strong: '#22D3EE',
          developing: '#FBBF24',
          emerging: '#FB7185',
        },
        success: '#34D399',
        warn: '#FBBF24',
        danger: '#FB7185',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Tightened tracking on display sizes — Inter needs it above ~32px.
        display: ['clamp(2.75rem, 6vw, 4.5rem)', { lineHeight: '1.02', letterSpacing: '-0.035em', fontWeight: '800' }],
        h1: ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.08', letterSpacing: '-0.03em', fontWeight: '700' }],
        h2: ['1.75rem', { lineHeight: '1.15', letterSpacing: '-0.022em', fontWeight: '650' }],
        h3: ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '600' }],
        lead: ['1.125rem', { lineHeight: '1.65', letterSpacing: '-0.005em' }],
        micro: ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.08em', fontWeight: '600' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        // Layered rather than single-blur: a tight contact shadow plus a wide
        // ambient one is what makes elevation read as physical.
        soft: '0 1px 2px rgba(0,0,0,0.4), 0 4px 16px -4px rgba(0,0,0,0.5)',
        raised: '0 2px 4px rgba(0,0,0,0.4), 0 12px 32px -8px rgba(0,0,0,0.6)',
        float: '0 8px 16px -4px rgba(0,0,0,0.5), 0 24px 64px -16px rgba(0,0,0,0.7)',
        glow: '0 0 0 1px rgba(99,102,241,0.2), 0 8px 32px -8px rgba(99,102,241,0.35)',
        'inset-line': 'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px)',
        'brand-sheen':
          'linear-gradient(135deg, rgba(99,102,241,0.16) 0%, rgba(34,211,238,0.09) 50%, transparent 100%)',
      },
      backgroundSize: { grid: '56px 56px' },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        // The AI thinking indicator. Slow and soft on purpose — a fast pulse
        // reads as urgency, and this screen is trying to lower a heart rate.
        breathe: {
          '0%, 100%': { opacity: '0.45', transform: 'scale(0.94)' },
          '50%': { opacity: '1', transform: 'scale(1.06)' },
        },
        'draw-ring': {
          from: { strokeDashoffset: 'var(--ring-circumference)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.8s infinite',
        breathe: 'breathe 2.4s ease-in-out infinite',
        'draw-ring': 'draw-ring 1.1s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      transitionTimingFunction: {
        // One easing curve for almost everything. Consistency in motion is
        // what makes an interface feel like a single product.
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */

/**
 * Every colour resolves to a CSS custom property defined in
 * `src/styles/tokens.css`. Components reference semantic names only
 * (`bg-surface`, `text-ink`, `border-line`) — never a literal — so swapping
 * theme swaps the tokens and no component code changes.
 *
 * `<alpha-value>` is what makes `bg-brand-500/20` work against a variable:
 * Tailwind substitutes the opacity into the `hsl()` call at build time. This
 * is why the tokens store raw HSL channels rather than complete colours.
 */

const withAlpha = (variable) => `hsl(var(${variable}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: withAlpha('--bg'),
          50: withAlpha('--bg-50'),
          100: withAlpha('--bg-100'),
          200: withAlpha('--bg-200'),
          900: withAlpha('--bg-900'),
        },
        surface: {
          DEFAULT: withAlpha('--surface'),
          raised: withAlpha('--surface-raised'),
          overlay: withAlpha('--surface-overlay'),
          hover: withAlpha('--surface-hover'),
        },
        line: {
          DEFAULT: withAlpha('--line'),
          strong: withAlpha('--line-strong'),
        },
        ink: {
          DEFAULT: withAlpha('--ink'),
          muted: withAlpha('--ink-muted'),
          subtle: withAlpha('--ink-subtle'),
          faint: withAlpha('--ink-faint'),
        },
        brand: {
          50: withAlpha('--brand-50'),
          100: withAlpha('--brand-100'),
          300: withAlpha('--brand-300'),
          400: withAlpha('--brand-400'),
          500: withAlpha('--brand-500'),
          600: withAlpha('--brand-600'),
          700: withAlpha('--brand-700'),
          900: withAlpha('--brand-900'),
        },
        accent: {
          cyan: withAlpha('--accent-cyan'),
          teal: withAlpha('--accent-teal'),
          // The bright pop in gradients. Green→cyan alone is a narrow ramp;
          // a yellow-green lime keeps the aurora from reading as one flat
          // wash of brand colour.
          lime: withAlpha('--accent-lime'),
          amber: withAlpha('--accent-amber'),
        },

        /**
         * Semantic scoring colours. A band colour means the same thing
         * everywhere — the live rail, the report, the dashboard — so these are
         * never used decoratively.
         */
        band: {
          exceptional: withAlpha('--band-exceptional'),
          strong: withAlpha('--band-strong'),
          developing: withAlpha('--band-developing'),
          emerging: withAlpha('--band-emerging'),
        },
        success: withAlpha('--success'),
        warn: withAlpha('--warn'),
        danger: withAlpha('--danger'),

        /**
         * The overlay token. Black in light mode, white in dark, so
         * `bg-tint/[0.06]` is a subtle wash in both themes rather than
         * invisible in one of them.
         */
        /** Primary CTA. A dedicated pair because the fill/text relationship
         *  INVERTS between themes: dark-green-on-white vs bright-green-with-
         *  dark-text. One colour cannot serve both and stay accessible. */
        cta: {
          DEFAULT: withAlpha('--cta-bg'),
          hover: withAlpha('--cta-bg-hover'),
          fg: withAlpha('--cta-fg'),
        },

        tint: withAlpha('--tint'),

        /** Modal/sheet backdrop. Dark in BOTH themes — a scrim's job is to
         *  dim the page, so it is deliberately not part of the surface scale. */
        scrim: withAlpha('--scrim'),
      },

      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Tightened tracking on display sizes — Inter needs it above ~32px.
        display: ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '1.02', letterSpacing: '-0.035em', fontWeight: '800' }],
        h1: ['clamp(1.875rem, 4vw, 3rem)', { lineHeight: '1.08', letterSpacing: '-0.03em', fontWeight: '700' }],
        h2: ['clamp(1.5rem, 3vw, 1.75rem)', { lineHeight: '1.15', letterSpacing: '-0.022em', fontWeight: '650' }],
        h3: ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '600' }],
        lead: ['clamp(1rem, 2vw, 1.125rem)', { lineHeight: '1.65', letterSpacing: '-0.005em' }],
        micro: ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.08em', fontWeight: '600' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },

      // Shadows are tokens too: light mode needs soft wide shadows in the
      // brand hue, dark mode needs near-black. A single shadow scale cannot
      // serve both.
      boxShadow: {
        soft: 'var(--shadow-soft)',
        raised: 'var(--shadow-raised)',
        float: 'var(--shadow-float)',
        'inset-line': 'var(--shadow-inset-line)',
        glow: '0 0 0 1px hsl(var(--brand-500) / 0.22), 0 8px 32px -8px hsl(var(--brand-500) / 0.4)',
        'glow-lg': '0 0 0 1px hsl(var(--brand-500) / 0.3), 0 12px 44px -8px hsl(var(--brand-500) / 0.5)',
      },

      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, hsl(var(--grid-line) / var(--grid-alpha)) 1px, transparent 1px), linear-gradient(to right, hsl(var(--grid-line) / var(--grid-alpha)) 1px, transparent 1px)',
        'brand-sheen':
          'linear-gradient(135deg, hsl(var(--brand-500) / 0.14) 0%, hsl(var(--accent-cyan) / 0.08) 50%, transparent 100%)',
      },
      backgroundSize: { grid: '56px 56px' },

      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
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
        // A single highlight sweeping across a surface. Used sparingly, on the
        // primary CTA only, so it stays an accent rather than noise.
        sheen: {
          '0%': { transform: 'translateX(-120%) skewX(-18deg)' },
          '100%': { transform: 'translateX(220%) skewX(-18deg)' },
        },
        'slide-up-fade': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s var(--ease-out-expo) both',
        'fade-in': 'fade-in 0.4s var(--ease-out-expo) both',
        'scale-in': 'scale-in 0.35s var(--ease-out-back) both',
        shimmer: 'shimmer 1.8s infinite',
        breathe: 'breathe 2.4s ease-in-out infinite',
        sheen: 'sheen 1.1s var(--ease-out-expo)',
        'slide-up-fade': 'slide-up-fade 0.3s var(--ease-out-expo) both',
      },

      transitionTimingFunction: {
        // One curve for almost everything — consistency in motion is what
        // makes an interface feel like a single product rather than a
        // collection of screens.
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
        // A gentle overshoot, for things that appear rather than move.
        back: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
        // Symmetric, for reversible state (toggles, expand/collapse).
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        250: '250ms',
        400: '400ms',
      },
    },
  },
  plugins: [],
}

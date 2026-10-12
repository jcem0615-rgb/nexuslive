import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Nexus Live brand — see docs/BRAND.md
        nexus: {
          50: '#f2f0ff',
          100: '#e6e1ff',
          200: '#cdc2ff',
          300: '#ab97ff',
          400: '#8b63ff',
          500: '#7036ff',
          600: '#6017f5',
          700: '#500fd4',
          800: '#4210ab',
          900: '#381189',
          950: '#200659',
        },
        live: {
          DEFAULT: '#ff2d6f',
          dark: '#d40f4e',
        },
        diamond: '#38d6ff',
        bean: '#ffc53d',
        ink: {
          900: '#07060f',
          800: '#0d0b18',
          700: '#141126',
          600: '#1d1934',
          500: '#2a2548',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 32px -8px rgb(112 54 255 / 0.65)',
        'glow-live': '0 0 28px -6px rgb(255 45 111 / 0.7)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
        'float-up': {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '0' },
          '15%': { opacity: '1' },
          '100%': { transform: 'translateY(-120px) scale(1.1)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        // --- gift effects ---
        'gift-enter': {
          '0%': { transform: 'scale(0.2) rotate(-18deg)', opacity: '0' },
          '55%': { transform: 'scale(1.18) rotate(4deg)', opacity: '1' },
          '70%': { transform: 'scale(0.96) rotate(-2deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        'gift-exit': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'particle-fly': {
          '0%': { transform: 'translate(0,0) scale(0.4)', opacity: '0' },
          '12%': { opacity: '1' },
          '100%': {
            transform: 'translate(var(--dx), var(--dy)) scale(var(--ps))',
            opacity: '0',
          },
        },
        'banner-sweep': {
          '0%': { transform: 'translateX(-120%) skewX(-12deg)', opacity: '0' },
          '18%': { transform: 'translateX(0) skewX(-12deg)', opacity: '1' },
          '82%': { transform: 'translateX(0) skewX(-12deg)', opacity: '1' },
          '100%': { transform: 'translateX(120%) skewX(-12deg)', opacity: '0' },
        },
        'ray-spin': {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '100%': { transform: 'rotate(360deg) scale(1.15)' },
        },
        'stage-shake': {
          '0%, 100%': { transform: 'translate(0,0)' },
          '20%': { transform: 'translate(calc(var(--amp) * -1px), calc(var(--amp) * 0.6px))' },
          '40%': { transform: 'translate(calc(var(--amp) * 1px), calc(var(--amp) * -0.5px))' },
          '60%': { transform: 'translate(calc(var(--amp) * -0.7px), calc(var(--amp) * -1px))' },
          '80%': { transform: 'translate(calc(var(--amp) * 0.8px), calc(var(--amp) * 0.7px))' },
        },
        'toast-in': {
          '0%': { transform: 'translateY(-130%) scale(0.92)', opacity: '0' },
          '60%': { transform: 'translateY(6%) scale(1.02)', opacity: '1' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'coin-rain': {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '0' },
          '10%': { opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(540deg)', opacity: '0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.24, 0, 0.38, 1) infinite',
        'float-up': 'float-up 1.6s ease-out forwards',
        shimmer: 'shimmer 2.4s linear infinite',
        'gift-enter': 'gift-enter 700ms cubic-bezier(0.22, 1.2, 0.36, 1) both',
        'gift-exit': 'gift-exit 500ms ease-in forwards',
        'particle-fly': 'particle-fly var(--dur, 1400ms) cubic-bezier(0.17, 0.67, 0.3, 1) forwards',
        'banner-sweep': 'banner-sweep var(--dur, 2600ms) cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'ray-spin': 'ray-spin 7s linear infinite',
        'stage-shake': 'stage-shake 620ms cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'toast-in': 'toast-in 520ms cubic-bezier(0.22, 1.2, 0.36, 1) both',
        'coin-rain': 'coin-rain var(--dur, 2600ms) linear forwards',
      },
    },
  },
  plugins: [],
} satisfies Config;

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
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.24, 0, 0.38, 1) infinite',
        'float-up': 'float-up 1.6s ease-out forwards',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;

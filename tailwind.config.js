/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070E22',
          900: '#0A1430',
          850: '#0D1A3A',
          800: '#111F45',
          750: '#152552',
          700: '#1A2D5E',
        },
        brand: {
          50: '#E8F7FF',
          100: '#C7EDFF',
          200: '#92DDFF',
          300: '#4FC7FA',
          400: '#1FADEC',
          500: '#0297DE',
          600: '#0280BE',
          700: '#056795',
          800: '#0A5375',
          900: '#0C4460',
        },
        accent: {
          50: '#FFF2ED',
          100: '#FFE1D6',
          200: '#FFC4AF',
          300: '#FFA183',
          400: '#FE8A67',
          500: '#FC734D',
          600: '#E95833',
          700: '#C24326',
          800: '#9B3A24',
          900: '#7D3422',
        },
        mist: {
          50: '#F4F8FD',
          100: '#E6EDF7',
          200: '#CBD7E9',
          300: '#A3B4CD',
          400: '#7C90AE',
          500: '#5C7091',
          600: '#465877',
          700: '#354463',
          800: '#263352',
          900: '#1B2643',
        },
        surface: {
          DEFAULT: '#0D1A3A',
          raised: '#111F45',
          sunken: '#0A1430',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(4, 10, 26, 0.24), 0 8px 24px -12px rgba(4, 10, 26, 0.55)',
        raised: '0 18px 48px -20px rgba(2, 12, 32, 0.9), 0 2px 8px rgba(2, 12, 32, 0.4)',
        glow: '0 0 0 1px rgba(2, 151, 222, 0.35), 0 12px 32px -12px rgba(2, 151, 222, 0.45)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}

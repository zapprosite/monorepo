/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0A0A0F',
        'bg-secondary': '#12121A',
        'bg-tertiary': '#1A1A25',
        'accent': '#39FF14',
        'accent-dim': '#2ECC71',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0B0',
        'text-muted': '#6B6B7B',
        'danger': '#FF4757',
        'warning': '#FFA502',
        'info': '#1E90FF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'kpi': ['48px', { lineHeight: '1.1', fontWeight: '700' }],
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
        'input': '8px',
      },
      boxShadow: {
        'glow': '0 0 12px rgba(57, 255, 20, 0.3)',
        'glow-lg': '0 0 24px rgba(57, 255, 20, 0.4)',
      },
    },
  },
  plugins: [],
};

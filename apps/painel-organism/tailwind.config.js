/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: '#00f5d4',
          green: '#39ff14',
          purple: '#bf40bf',
          blue: '#00a8e8',
          red: '#ef4444',
          amber: '#f59e0b',
        },
        dark: {
          900: '#0a0a0f',
          800: '#111827',
          700: '#1f2937',
          600: '#374151',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(0, 245, 212, 0.3)',
        'neon-green': '0 0 20px rgba(57, 255, 20, 0.3)',
        'neon-purple': '0 0 20px rgba(191, 64, 191, 0.3)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
        'neural': 'neural-pulse 2s ease-in-out infinite',
        'scan': 'scan-line 3s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { filter: 'drop-shadow(0 0 8px rgba(0, 245, 212, 0.6))' },
          '50%': { filter: 'drop-shadow(0 0 20px rgba(0, 245, 212, 0.9))' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'neural-pulse': {
          '0%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
          '100%': { opacity: '0.3', transform: 'scale(1)' },
        },
        'scan-line': {
          '0%': { left: '-10%' },
          '100%': { left: '110%' },
        },
      },
    },
  },
  plugins: [],
}

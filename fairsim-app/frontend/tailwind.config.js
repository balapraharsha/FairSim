/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy:   { DEFAULT: '#0F172A', 800: '#1E293B', 700: '#263348', 600: '#334155' },
        brand:  { DEFAULT: '#4F46E5', dark: '#1E3A8A', light: '#818CF8' },
        danger: { DEFAULT: '#EF4444', light: '#FCA5A5', dark: '#991B1B', bg: 'rgba(239,68,68,0.12)' },
        warn:   { DEFAULT: '#F59E0B', light: '#FCD34D', dark: '#92400E', bg: 'rgba(245,158,11,0.12)' },
        safe:   { DEFAULT: '#22C55E', light: '#86EFAC', dark: '#15803D', bg: 'rgba(34,197,94,0.12)' },
        cyan:   { DEFAULT: '#22D3EE', light: '#67E8F9', dark: '#0E7490', bg: 'rgba(34,211,238,0.12)' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        glow:        '0 0 20px rgba(99,102,241,0.35)',
        'glow-cyan': '0 0 20px rgba(34,211,238,0.35)',
        'glow-green':'0 0 20px rgba(34,197,94,0.35)',
        'glow-red':  '0 0 20px rgba(239,68,68,0.35)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-up':   'slideUp 0.35s ease forwards',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      }
    }
  },
  plugins: []
}

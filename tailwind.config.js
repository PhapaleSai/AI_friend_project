/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          deep: '#07070f',
          surface: 'rgba(255,255,255,0.04)',
          elevated: 'rgba(255,255,255,0.07)',
        },
        brand: {
          purple: '#8b5cf6',
          blue: '#3b82f6',
          teal: '#14b8a6',
          pink: '#ec4899',
          glow: '#a78bfa',
        },
      },
      animation: {
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
        'pulse-fast': 'pulse-fast 0.8s ease-in-out infinite',
        'spin-slow': 'spin 4s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'ripple': 'ripple 2s ease-out infinite',
        'ripple-delay': 'ripple 2s ease-out 0.6s infinite',
        'ripple-delay2': 'ripple 2s ease-out 1.2s infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 0.3s ease-out',
        'wave': 'wave 1.4s ease-in-out infinite',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.9' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
        },
        'pulse-fast': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.12)', opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'ripple': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 30px rgba(139,92,246,0.4), 0 0 60px rgba(59,130,246,0.2)' },
          '50%': { boxShadow: '0 0 50px rgba(139,92,246,0.7), 0 0 100px rgba(59,130,246,0.4)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'wave': {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(2)' },
        },
      },
      backgroundImage: {
        'orb-gradient': 'radial-gradient(circle at 40% 40%, #a78bfa, #6366f1, #3b82f6, #06b6d4)',
        'orb-listening': 'radial-gradient(circle at 40% 40%, #f472b6, #ec4899, #a855f7, #7c3aed)',
        'orb-thinking': 'conic-gradient(from 0deg, #6366f1, #3b82f6, #06b6d4, #8b5cf6, #6366f1)',
        'orb-speaking': 'radial-gradient(circle at 40% 40%, #34d399, #10b981, #0891b2, #3b82f6)',
        'chat-surface': 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(59,130,246,0.05) 100%)',
      },
    },
  },
  plugins: [],
};

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
        primary: {
          DEFAULT: '#7c3aed',
          dark: '#6d28d9',
        },
        accent: {
          DEFAULT: '#d4af37',
          dark: '#b79025',
        },
        ink: '#1f1b2c',
        cream: '#fdf9f3',
      },
      animation: {
        'spin-slow': 'spin-slow 8s linear infinite',
        'fly': 'fly 4s ease-in-out infinite',
        'fly-across': 'fly-across 1.5s ease-in-out',
        'sparkle': 'sparkle 2s ease-in-out infinite',
      },
      keyframes: {
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'fly': {
          '0%': { transform: 'translateX(-30px) translateY(5px) rotate(-30deg)', opacity: '0' },
          '25%': { transform: 'translateX(-10px) translateY(-8px) rotate(-10deg)', opacity: '0.8' },
          '50%': { transform: 'translateX(0) translateY(-12px) rotate(0deg)', opacity: '1' },
          '75%': { transform: 'translateX(10px) translateY(-8px) rotate(10deg)', opacity: '0.8' },
          '100%': { transform: 'translateX(30px) translateY(5px) rotate(30deg)', opacity: '0' },
        },
        'fly-across': {
          '0%': { transform: 'translateX(-100px) translateY(0) rotate(-45deg)', opacity: '0' },
          '50%': { transform: 'translateX(0) translateY(-15px) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateX(100px) translateY(0) rotate(45deg)', opacity: '0' },
        },
        'sparkle': {
          '0%, 100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
          '50%': { opacity: '0.7', transform: 'scale(1.2) rotate(180deg)' },
        },
      },
    },
  },
  plugins: [],
}



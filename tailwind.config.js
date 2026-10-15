/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,html}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      colors: {
        adphor: { navy: '#0F172A', blue: '#0284C7', emerald: '#059669', gold: '#D97706' },
      },
    },
  },
  plugins: [],
};
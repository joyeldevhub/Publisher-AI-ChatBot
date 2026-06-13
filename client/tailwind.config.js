/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          300: '#A5B4FC',
          500: '#4C6EF5',
          600: '#3B5BDB',
          700: '#2D47A0',
        },
        kd: {
          blue:  '#93C5FD',
          mint:  '#6EE7B7',
          indigo:'#A5B4FC',
          green: '#86EFAC',
        },
      },
    },
  },
  plugins: [],
};

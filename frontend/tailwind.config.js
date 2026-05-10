/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dce6ff',
          200: '#b8ccff',
          300: '#85a5ff',
          400: '#6b8aff',
          500: '#4f6ef7',
          600: '#3a54d4',
          700: '#2c40ab',
          800: '#1f2d82',
          900: '#1a237e',
        },
        code: {
          bg: '#1e1e2e',
          surface: '#252535',
          highlight: '#2d2d4e',
          border: '#3d3d5e',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
    },
  },
  plugins: [],
};


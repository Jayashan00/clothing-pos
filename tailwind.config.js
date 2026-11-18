/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        indigo: {
          50: '#EEF0F8', 100: '#DCE0F0', 200: '#B7BFE0', 300: '#8D99CB', 400: '#5E6DAF',
          500: '#3D4C92', 600: '#2D3A79', 700: '#1F2A5C', 800: '#172046', 900: '#0F1530',
        },
        saffron: {
          50: '#FEF7E6', 100: '#FDEBC0', 200: '#FAD782', 300: '#F5C04A', 400: '#EEAD25',
          500: '#E8A317', 600: '#C4840C', 700: '#9A640C', 800: '#744B0E', 900: '#4E330C',
        },
        maroon: { 50: '#FBEDF0', 100: '#F5D3DB', 500: '#B02A4C', 600: '#8C1C3A', 700: '#6E1530' },
        leaf: { 50: '#E8F5F1', 100: '#C8E8DF', 500: '#138A6C', 600: '#0E7058', 700: '#0B5A47' },
        ink: '#141827',
        paper: '#F5F6FA',
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', '"Noto Sans Sinhala"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Noto Sans Sinhala"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        lift: '0 1px 2px rgba(20,24,39,.06), 0 4px 14px rgba(31,42,92,.08)',
        pop: '0 12px 40px rgba(15,21,48,.22)',
      },
    },
  },
  plugins: [],
};

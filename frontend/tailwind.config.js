/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0F0B1E',
          deeper: '#1A1145',
          purple: '#7C3AED',
          blue: '#3B82F6',
          gold: '#F59E0B',
          light: '#E0E7FF',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0F0B1E 0%, #1A1145 50%, #0F0B1E 100%)',
        'gradient-gold': 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
      },
    },
  },
  plugins: [],
}

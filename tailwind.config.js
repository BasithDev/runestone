/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        emerald: {
          500: '#10B981',
        },
        surface: '#121212',
        'surface-light': '#1a1a1a',
        zinc: {
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525B',
          200: '#e4e4e7',
        },
      },
    },
  },
  plugins: [],
}
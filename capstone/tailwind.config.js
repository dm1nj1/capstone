/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontfamily: {
        korean: ['"Malgun Gothic"', '"Nanum Gothic"', "sans-serif"],
      },
    },
  },
  plugins: [],
}
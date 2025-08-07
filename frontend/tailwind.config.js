/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        'builder': '260px 1fr 380px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
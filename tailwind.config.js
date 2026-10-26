/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pitch: '#481F7A',
        pitchline: '#5E3497',
        chalk: '#F3F1E7',
        turf: '#858AE3',
        gold: '#F3B517',
        ink: '#2A1050',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
    },
  },
  plugins: [],
}

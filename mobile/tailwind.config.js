/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold: ['Inter_700Bold'],
        black: ['Inter_900Black'],
        title: ['NewKansas-Bold'],
        'title-medium': ['NewKansas-Medium'],
        'title-regular': ['NewKansas-Regular'],
      }
    },
  },
  plugins: [],
}

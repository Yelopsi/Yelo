/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        verde: {
          escuro: '#1B4332',
          medio: '#2D6A4F',
          claro: '#52B788',
          neon: '#74C69D',
          suave: '#D8F3DC',
          sucesso: '#28a745',
        },
        amarelo: {
          DEFAULT: '#FFEE8C',
          ouro: '#FFB703',
        },
        creme: '#FDFBF7',
        offwhite: '#FDFAF6',
        coral: '#E63946',
        cinza: {
          fundo: '#F8F9FA',
          borda: '#E5E7EB',
          texto: '#555555',
          claro: '#ADB5BD',
        },
      },
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

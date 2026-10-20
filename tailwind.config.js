/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#12A150", // Verde Camaleão Diversões
          light: "#0EA5A4", // Azul verde-água
          dark: "#0B5D3B", // Verde escuro
        },
        secondary: {
          DEFAULT: "#FFFFFF", // Branco
          light: "#F3FBF8", // Branco esverdeado
        },
        background: {
          dark: "#0B5D3B", // Verde escuro
          light: "#F3FBF8", // Branco esverdeado
        },
        accent: {
          blue: "#0EA5A4", // Azul verde-água
          red: "#E30613", // Vermelho (alertas)
          yellow: "#2DD4BF", // Destaque verde-água (nome mantido: usado em todo o sistema)
          green: "#12A150", // Verde
          white: "#FFFFFF", // Branco
          cream: "#E6FBF5", // Verde-água suave
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

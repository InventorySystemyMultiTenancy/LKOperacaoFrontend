/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0B3BA8", // Azul Toy Diversões
          light: "#1E5BD8", // Azul claro
          dark: "#082A7A", // Azul escuro
        },
        secondary: {
          DEFAULT: "#FFFFFF", // Branco
          light: "#FFFCF0", // Branco amarelado
        },
        background: {
          dark: "#082A7A", // Azul escuro
          light: "#FFFCF0", // Branco amarelado
        },
        accent: {
          blue: "#0B3BA8", // Azul Toy Diversões
          red: "#E30613", // Vermelho da faixa da logo (alertas)
          yellow: "#FFD800", // Amarelo Toy Diversões
          green: "#16A34A", // Verde (sucesso)
          white: "#FFFFFF", // Branco
          cream: "#FFF6CC", // Amarelo suave
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

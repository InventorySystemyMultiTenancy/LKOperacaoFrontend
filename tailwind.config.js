/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2457B1", // Azul Clube Kids
          light: "#66C24D", // Verde Clube Kids (mantido para compatibilidade)
          dark: "#ED3136", // Vermelho Clube Kids
        },
        secondary: {
          DEFAULT: "#FFFDFF", // Branco Clube Kids
          light: "#FFFDFF", // Branco Clube Kids
        },
        background: {
          dark: "#2457B1", // Azul Clube Kids
          light: "#FFFDFF", // Branco Clube Kids
        },
        accent: {
          blue: "#2457B1", // Azul Clube Kids
          red: "#ED3136", // Vermelho Clube Kids
          yellow: "#FFCC00", // Amarelo Clube Kids
          green: "#66C24D", // Verde Clube Kids (mantido)
          white: "#FFFDFF", // Branco Clube Kids
          cream: "#FFF9E6", // Creme suave
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

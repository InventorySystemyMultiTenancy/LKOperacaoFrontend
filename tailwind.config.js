/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#16A34A", // Verde LK Operação
          light: "#4ADE80", // Verde claro LK Operação
          dark: "#1E40AF", // Azul escuro LK Operação
        },
        secondary: {
          DEFAULT: "#FFFFFF", // Branco
          light: "#F7FEF9", // Branco esverdeado
        },
        background: {
          dark: "#0F172A", // Azul noite
          light: "#F7FEF9", // Branco esverdeado
        },
        accent: {
          blue: "#2563EB", // Azul LK Operação
          red: "#DC2626", // Vermelho (alertas)
          yellow: "#2563EB", // Azul LK Operação (usado nos gradientes verde -> azul)
          green: "#16A34A", // Verde LK Operação
          white: "#FFFFFF", // Branco
          cream: "#ECFDF5", // Verde menta suave
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

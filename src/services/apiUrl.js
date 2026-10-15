// Endereço do backend. Aceita VITE_API_URL com ou sem "/api" e com ou sem
// barra no final: https://x.onrender.com, https://x.onrender.com/ e
// https://x.onrender.com/api viram todos https://x.onrender.com/api.
const PADRAO = "https://toydiversoes-backend.onrender.com/api";

export const API_URL = (() => {
  const url = String(import.meta.env.VITE_API_URL || PADRAO)
    .trim()
    .replace(/\/+$/, "");
  return /\/api$/.test(url) ? url : `${url}/api`;
})();

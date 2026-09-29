import axios from "axios";
import { LOGIN_ABERTO } from "../config";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
      "https://lkoperacaobackend.onrender.com/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Com login aberto não há backend: falha na hora em vez de esperar a resposta
if (LOGIN_ABERTO) {
  api.defaults.adapter = (config) =>
    Promise.reject(
      Object.assign(new Error("Backend ainda não conectado (login aberto)"), {
        config,
        code: "ERR_NETWORK",
        isAxiosError: true,
      })
    );
}

// Interceptor para adicionar token automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;

import axios from "axios";
import { API_URL } from "./apiUrl";

// Cliente para as páginas abertas por link (ex.: crédito remoto). Não usa os
// interceptors do `api`: nunca manda o token de quem estiver logado no
// navegador e não redireciona para /login em caso de 401.
const apiPublica = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiPublica;

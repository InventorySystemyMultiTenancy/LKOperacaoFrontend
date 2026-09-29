import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

export const AuthContext = createContext({});

// Login aberto (temporário, enquanto o backend não está no ar):
// ao clicar em "Entrar" entra direto como ADMIN, sem verificar e-mail/senha.
// Mude para false quando o backend e o banco estiverem publicados.
export const LOGIN_ABERTO = true;

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const usuarioSalvo = localStorage.getItem("usuario");

    if (token && usuarioSalvo) {
      setUsuario(JSON.parse(usuarioSalvo));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }

    setLoading(false);
  }, []);

  const login = async (email, senha) => {
    if (LOGIN_ABERTO) {
      const usuarioData = {
        id: "login-aberto",
        nome: "Administrador",
        email: email || "admin@lkoperacao.com",
        role: "ADMIN",
      };
      localStorage.setItem("token", "login-aberto");
      localStorage.setItem("usuario", JSON.stringify(usuarioData));
      setUsuario(usuarioData);
      return { success: true };
    }

    try {
      const response = await api.post("/auth/login", { email, senha });
      const { token, usuario: usuarioData } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("usuario", JSON.stringify(usuarioData));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      setUsuario(usuarioData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Erro ao fazer login",
      };
    }
  };

  const registrar = async (nome, email, senha, telefone) => {
    try {
      const response = await api.post("/auth/registrar", {
        nome,
        email,
        senha,
        telefone,
      });
      const { token, usuario: usuarioData } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("usuario", JSON.stringify(usuarioData));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      setUsuario(usuarioData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Erro ao registrar",
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    delete api.defaults.headers.common["Authorization"];
    setUsuario(null);
  };

  const isAdmin = () => usuario?.role === "ADMIN";

  return (
    <AuthContext.Provider
      value={{
        usuario,
        loading,
        login,
        registrar,
        logout,
        isAdmin,
        signed: !!usuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}

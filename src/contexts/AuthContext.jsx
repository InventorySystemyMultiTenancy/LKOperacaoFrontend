import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const usuarioSalvo = localStorage.getItem("usuario");

    if (token && usuarioSalvo) {
      setUsuario(JSON.parse(usuarioSalvo));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Atualiza role/permissões em segundo plano (o ADMIN pode ter alterado)
      api
        .get("/auth/perfil")
        .then((res) => {
          if (!res.data?.id) return;
          const atualizado = {
            id: res.data.id,
            nome: res.data.nome,
            email: res.data.email,
            role: res.data.role,
            telefone: res.data.telefone,
            permissoes: res.data.permissoes ?? null,
          };
          localStorage.setItem("usuario", JSON.stringify(atualizado));
          setUsuario(atualizado);
        })
        .catch(() => {});
    }

    setLoading(false);
  }, []);

  const login = async (email, senha) => {
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

  // Usuário com acessos escolhidos pelo ADMIN (lista de chaves)
  const temPermissoesPersonalizadas =
    usuario?.role !== "ADMIN" && Array.isArray(usuario?.permissoes);

  // `legado`: regra antiga (por role) usada quando não há personalização
  const pode = (chave, legado = false) => {
    if (!usuario) return false;
    if (usuario.role === "ADMIN") return true;
    if (Array.isArray(usuario.permissoes)) return usuario.permissoes.includes(chave);
    return Boolean(legado);
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        loading,
        login,
        registrar,
        logout,
        isAdmin,
        pode,
        temPermissoesPersonalizadas,
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

import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { rotaInicial } from "../utils/permissoes";

// `permissao`: chave do catálogo (utils/permissoes.js). Usuários com acessos
// personalizados são avaliados por ela; os demais seguem adminOnly/allowedRoles.
export function PrivateRoute({
  children,
  adminOnly = false,
  allowedRoles = null,
  permissao = null,
}) {
  const { signed, loading, isAdmin, usuario, pode } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!signed) {
    return <Navigate to="/login" />;
  }

  let permitido = true;
  if (adminOnly && !isAdmin()) permitido = false;
  // Se allowedRoles foi especificado, verificar se o usuário tem uma das roles permitidas
  if (allowedRoles && !allowedRoles.includes(usuario?.role)) permitido = false;
  if (permissao) permitido = pode(permissao, permitido);

  if (!permitido) {
    const inicio = rotaInicial(pode);
    if (inicio && inicio !== window.location.pathname) {
      return <Navigate to={inicio} replace />;
    }
    return <SemAcesso />;
  }

  return children;
}

// Para rotas que não exigem login: só barra usuários com acessos
// personalizados que não tenham a permissão.
export function BloqueioPersonalizado({ children, permissao }) {
  const { loading, pode, temPermissoesPersonalizadas } = useAuth();
  if (loading) return null;
  if (temPermissoesPersonalizadas && !pode(permissao)) {
    const inicio = rotaInicial(pode);
    return inicio ? <Navigate to={inicio} replace /> : <SemAcesso />;
  }
  return children;
}

function SemAcesso() {
  const { logout } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6 text-center">
      <span className="text-5xl">🔒</span>
      <h1 className="text-xl font-bold text-gray-900">Sem acesso</h1>
      <p className="text-gray-600 max-w-md">
        Seu usuário não tem nenhuma aba liberada. Peça ao administrador para
        ajustar suas permissões.
      </p>
      <button
        className="btn-primary"
        onClick={() => {
          logout();
          window.location.href = "/login";
        }}
      >
        Sair
      </button>
    </div>
  );
}

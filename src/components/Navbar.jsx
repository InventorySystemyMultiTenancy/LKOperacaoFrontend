import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import api from "../services/api";
import { DevolucaoModal } from "./DevolucaoModal";
import { CATALOGO_ABAS } from "../utils/permissoes";

export function Navbar() {
  const { usuario, logout, pode, temPermissoesPersonalizadas } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  const closeMenu = () => setIsMenuOpen(false);

  // Fecha o menu ao clicar fora dele
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const linkClass = (path) =>
    `flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive(path)
        ? "bg-gradient-to-r from-primary to-accent-yellow text-white shadow-lg"
        : "text-gray-300 hover:bg-white/10 hover:text-white"
    }`;

  const isAdmin = usuario?.role === "ADMIN";

  // Quem não tem a aba Dashboard não vê o widget do carrinho: o botão de
  // devolver o próprio carrinho fica aqui no topo, em todas as páginas.
  const semDashboard = Boolean(usuario) && !pode("dashboard", true);
  const [carrinhoAtivo, setCarrinhoAtivo] = useState(null);
  const [devolvendoCarrinho, setDevolvendoCarrinho] = useState(false);

  useEffect(() => {
    if (!semDashboard) return undefined;
    let cancelado = false;
    api
      .get("/carrinho-usuarios/status")
      .then((res) => !cancelado && setCarrinhoAtivo(res.data?.temCarrinho ? res.data.carrinho : null))
      .catch(() => !cancelado && setCarrinhoAtivo(null));
    return () => {
      cancelado = true;
    };
  }, [semDashboard, usuario?.id]);

  const linksPorRole = () => {
    const links = [
      { to: "/", label: "📊 Dashboard" },
      { to: "/movimentacoes", label: "📦 Movimentações" },
      { to: "/maquinas", label: "🎮 Máquinas" },
      { to: "/lojas", label: "🏪 Lojas" },
      { to: "/produtos", label: "🧸 Produtos" },
    ];
    if (isAdmin || usuario?.role === "FINANCEIRO") {
      links.push({ to: "/financeiro", label: "💰 Financeiro" });
      links.push({ to: "/machine-pay", label: "📡 Machine Pay" });
    }
    if (isAdmin) {
      links.push({ to: "/graficos", label: "📈 Gráficos" });
      links.push({ to: "/alertas-estoque", label: "🚨 Alertas de Estoque" });
      links.push({ to: "/relatorios", label: "📄 Relatórios" });
      links.push({ to: "/usuarios", label: "👥 Usuários" });
      // Vouchers: só ADMIN (funcionário nunca vê; rota e API também são só ADMIN)
      links.push({ to: "/creditos-remotos", label: "🎟️ Vouchers" });
    }
    return links;
  };

  // Usuário com acessos personalizados: só as abas liberadas pelo ADMIN
  const links = temPermissoesPersonalizadas
    ? CATALOGO_ABAS.filter((aba) => pode(aba.chave)).map((aba) => ({
        to: aba.rota,
        label: aba.label,
      }))
    : linksPorRole();

  const nomeRole = isAdmin
    ? "Administrador"
    : usuario?.role === "FINANCEIRO"
      ? "Financeiro"
      : "Funcionário";

  return (
    <nav
      className="relative shadow-2xl border-b-4 border-yellow-400 z-50"
      style={{
        background: "linear-gradient(to right, #C91F24, #2457B1)",
        textShadow: "0 2px 4px rgba(0,0,0,0.5)",
        color: "#FFFFFF",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              ref={menuButtonRef}
              onClick={() => setIsMenuOpen((aberto) => !aberto)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              aria-label="Abrir menu"
              aria-expanded={isMenuOpen}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>

            <Link
              to="/"
              className="flex items-center group shrink-0"
              onClick={closeMenu}
            >
              <img
                src="/ClubeKidsLogo (1).png"
                alt="Clube Kids"
                className="w-20 h-20 lg:w-24 lg:h-24 object-contain transition-transform duration-300 group-hover:scale-110"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </Link>
          </div>

          {/* User Info e Logout */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:block text-right bg-white/5 px-4 py-2 rounded-lg border border-white/10">
              <div className="text-sm font-semibold text-white">
                {usuario?.nome}
              </div>
              <div className="text-xs text-accent-cream flex items-center justify-end gap-1">
                {isAdmin && (
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {nomeRole}
              </div>
            </div>
            {semDashboard && carrinhoAtivo && (
              <button
                onClick={() => setDevolvendoCarrinho(true)}
                className="bg-green-500 hover:bg-green-600 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg flex items-center gap-2"
                title="Registrar a devolução do seu carrinho de produtos"
              >
                🛒 <span className="hidden sm:inline">Devolver carrinho</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-4 sm:px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Menu Dropdown (mobile e desktop) */}
      {isMenuOpen && (
        <div
          ref={menuRef}
          className="absolute left-0 right-0 top-full bg-gray-900 border-t border-white/10 shadow-2xl max-h-[calc(100vh-5rem)] overflow-y-auto"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={closeMenu}
                  className={linkClass(link.to)}
                >
                  <span className="flex-1">{link.label}</span>
                </Link>
              ))}
            </div>

            {/* User Info Mobile */}
            <div className="md:hidden mt-4 pt-4 border-t border-white/10">
              <div className="bg-white/5 px-4 py-3 rounded-lg border border-white/10">
                <div className="text-sm font-semibold text-white">
                  {usuario?.nome}
                </div>
                <div className="text-xs text-accent-cream flex items-center gap-1 mt-1">
                  {nomeRole}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {devolvendoCarrinho &&
        carrinhoAtivo &&
        createPortal(
          <DevolucaoModal
            carrinho={carrinhoAtivo}
            onClose={() => setDevolvendoCarrinho(false)}
            onSuccess={() => {
              setDevolvendoCarrinho(false);
              setCarrinhoAtivo(null);
            }}
          />,
          document.body,
        )}
    </nav>
  );
}

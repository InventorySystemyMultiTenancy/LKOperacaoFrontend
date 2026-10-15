import { NavLink } from "react-router-dom";

// Abas da área de Movimentações: controle de arrecadação (papel) e roteiros.
export function MovimentacoesAbas() {
  const classe = ({ isActive }) =>
    `px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
      isActive
        ? "bg-primary text-white shadow-md"
        : "bg-white text-primary border-2 border-primary/20 hover:border-primary"
    }`;
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <NavLink to="/movimentacoes" end className={classe}>
        📋 Controle de Arrecadação
      </NavLink>
      <NavLink to="/movimentacoes/roteiros" className={classe}>
        🗺️ Roteiros
      </NavLink>
    </div>
  );
}

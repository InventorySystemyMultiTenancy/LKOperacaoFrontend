import { NavLink } from "react-router-dom";

// Abas da área de Compras
export function ComprasAbas() {
  const classe = ({ isActive }) =>
    `px-4 py-2.5 rounded-xl font-bold text-sm transition-colors ${
      isActive
        ? "bg-primary text-white shadow-md"
        : "bg-white text-primary border-2 border-primary/20 hover:border-primary"
    }`;
  return (
    <div className="flex flex-wrap gap-2 mb-6 no-print">
      <NavLink to="/compras" end className={classe}>
        🛒 Nova compra
      </NavLink>
      <NavLink to="/compras/estoque" className={classe}>
        📦 Estoque da base
      </NavLink>
      <NavLink to="/compras/historico" className={classe}>
        🧾 Compras feitas
      </NavLink>
      <NavLink to="/compras/reposicao" className={classe}>
        📋 Lista de reposição
      </NavLink>
    </div>
  );
}

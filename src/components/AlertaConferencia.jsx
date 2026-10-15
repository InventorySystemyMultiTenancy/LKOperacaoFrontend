import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

// Faixa no Dashboard quando alguma máquina tem conferência com alerta.
export function AlertaConferencia() {
  const { pode, usuario } = useAuth();
  const permitido = pode("conferencia", ["ADMIN", "FINANCEIRO"].includes(usuario?.role));
  const [totais, setTotais] = useState(null);

  useEffect(() => {
    if (!permitido) return;
    api
      .get("/conferencias")
      .then((res) => setTotais(res.data?.totais || null))
      .catch(() => setTotais(null));
  }, [permitido]);

  if (!permitido || !totais || (!totais.urgentes && !totais.leves)) return null;

  const urgente = totais.urgentes > 0;
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <Link
        to="/conferencia"
        className={`block rounded-xl border-l-4 p-4 shadow-md transition-transform hover:-translate-y-0.5 ${
          urgente ? "bg-red-50 border-red-600" : "bg-yellow-50 border-accent-yellow"
        }`}
      >
        <p className={`font-bold ${urgente ? "text-red-800" : "text-yellow-900"}`}>
          {urgente ? "🚨" : "⚠️"} Conferência dos relógios:{" "}
          {totais.urgentes > 0 && `${totais.urgentes} máquina(s) com alerta urgente`}
          {totais.urgentes > 0 && totais.leves > 0 && " e "}
          {totais.leves > 0 && `${totais.leves} com atenção`}
        </p>
        <p className="text-sm text-gray-700">
          Prêmios acima do configurado, dinheiro físico divergente ou contador com problema. Toque para ver.
        </p>
      </Link>
    </div>
  );
}

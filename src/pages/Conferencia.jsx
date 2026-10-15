import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { ConferenciaResumo } from "../components/LeituraRelogioFoto";
import { useAuth } from "../contexts/AuthContext";

const formatarData = (data) =>
  data
    ? new Date(data).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const BADGE_NIVEL = {
  URGENTE: "bg-red-600 text-white",
  LEVE: "bg-accent-yellow text-primary-dark",
  OK: "bg-green-600 text-white",
};

const ROTULO_NIVEL = { URGENTE: "🚨 Urgente", LEVE: "⚠️ Atenção", OK: "✅ OK" };

function HistoricoMaquina({ maquinaId }) {
  const [itens, setItens] = useState(null);

  useEffect(() => {
    api
      .get(`/conferencias/maquinas/${maquinaId}`)
      .then((res) => setItens(res.data))
      .catch(() => setItens([]));
  }, [maquinaId]);

  if (!itens) return <p className="text-sm text-gray-500 p-3">Carregando histórico...</p>;
  if (!itens.length) return <p className="text-sm text-gray-500 p-3">Sem leituras de relógio.</p>;

  return (
    <div className="space-y-3 mt-3">
      {itens.map((item) => (
        <div key={item.id} className="border-t pt-3">
          <p className="text-xs text-gray-500 mb-2">
            {formatarData(item.dataColeta)} · IN {item.contadorIn} · OUT {item.contadorOut}
            {item.leituraFoto && (
              <span className="ml-2">
                📷 lido por foto{item.leituraFoto.corrigido ? " (corrigido à mão)" : ""}
              </span>
            )}
          </p>
          {item.conferencia && <ConferenciaResumo conferencia={item.conferencia} titulo="Conferência" compacto />}
        </div>
      ))}
    </div>
  );
}

export function Conferencia() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === "ADMIN";
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [filtro, setFiltro] = useState("ALERTAS");
  const [aberta, setAberta] = useState(null);
  const [recalculando, setRecalculando] = useState(false);

  const carregar = async () => {
    try {
      setErro("");
      const { data } = await api.get("/conferencias");
      setDados(data);
    } catch (error) {
      setErro(error.response?.data?.error || "Erro ao carregar a conferência");
      setDados({ maquinas: [], totais: {} });
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const recalcular = async () => {
    setRecalculando(true);
    try {
      const { data } = await api.post("/conferencias/recalcular", {});
      setAviso(`${data.recalculadas} leituras recalculadas com a configuração atual das máquinas.`);
      await carregar();
    } catch (error) {
      setErro(error.response?.data?.error || "Erro ao recalcular");
    } finally {
      setRecalculando(false);
    }
  };

  const lista = useMemo(() => {
    const maquinas = dados?.maquinas || [];
    if (filtro === "ALERTAS") return maquinas.filter((m) => m.nivel === "URGENTE" || m.nivel === "LEVE");
    if (filtro === "SEM_CONFIG") return maquinas.filter((m) => !m.maquina.configurada);
    if (filtro === "SEM_LEITURA") return maquinas.filter((m) => !m.ultimaLeitura);
    return maquinas;
  }, [dados, filtro]);

  if (!dados) return <PageLoader />;

  const t = dados.totais || {};
  const cartoes = [
    { chave: "ALERTAS", titulo: "Urgentes", valor: t.urgentes || 0, cor: "from-red-600 to-red-500" },
    { chave: "ALERTAS", titulo: "Atenção", valor: t.leves || 0, cor: "from-yellow-500 to-amber-500" },
    { chave: "TODAS", titulo: "OK", valor: t.ok || 0, cor: "from-green-600 to-green-500" },
    { chave: "SEM_CONFIG", titulo: "Sem configuração", valor: t.semConfiguracao || 0, cor: "from-primary to-primary-dark" },
  ];

  return (
    <div className="min-h-screen bg-background-light">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Conferência"
          subtitle="Relógios x Machine Pay x prêmios: o que cada máquina deveria ter"
          icon="🎯"
        />

        {erro && <AlertBox type="error" message={erro} onClose={() => setErro("")} />}
        {aviso && <AlertBox type="success" message={aviso} onClose={() => setAviso("")} />}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {cartoes.map((c) => (
            <button
              key={c.titulo}
              type="button"
              onClick={() => setFiltro(c.chave)}
              className={`stat-card bg-gradient-to-br ${c.cor} text-left`}
            >
              <p className="text-sm opacity-90">{c.titulo}</p>
              <p className="text-4xl font-extrabold">{c.valor}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {[
            ["ALERTAS", "Com alerta"],
            ["TODAS", "Todas"],
            ["SEM_LEITURA", "Sem leitura"],
            ["SEM_CONFIG", "Sem configuração"],
          ].map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              onClick={() => setFiltro(chave)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-colors ${
                filtro === chave
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-primary border-primary/30 hover:border-primary"
              }`}
            >
              {rotulo}
            </button>
          ))}
          {isAdmin && (
            <button
              type="button"
              onClick={recalcular}
              disabled={recalculando}
              className="ml-auto btn-secondary text-sm py-2"
            >
              {recalculando ? "Recalculando..." : "🔄 Recalcular tudo"}
            </button>
          )}
        </div>

        {lista.length === 0 ? (
          <div className="card text-center text-gray-600">
            {filtro === "ALERTAS"
              ? "🎉 Nenhuma máquina com alerta na última leitura."
              : "Nenhuma máquina neste filtro."}
          </div>
        ) : (
          <div className="space-y-4">
            {lista.map((item) => (
              <div key={item.maquina.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-gray-900">
                      {item.maquina.nome || item.maquina.codigo}{" "}
                      <span className="text-sm font-normal text-gray-500">({item.maquina.codigo})</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      🏪 {item.maquina.loja?.nome || "—"} · Última leitura:{" "}
                      {item.ultimaLeitura
                        ? `${formatarData(item.ultimaLeitura.dataColeta)} (IN ${item.ultimaLeitura.contadorIn} / OUT ${item.ultimaLeitura.contadorOut})`
                        : "nenhuma"}
                      {item.maquina.machinePay ? " · 📡 Machine Pay" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.nivel && (
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${BADGE_NIVEL[item.nivel]}`}>
                        {ROTULO_NIVEL[item.nivel]}
                      </span>
                    )}
                    {!item.maquina.configurada && (
                      <Link
                        to={`/maquinas/${item.maquina.id}/editar`}
                        className="px-3 py-1 rounded-full text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20"
                      >
                        ⚙️ Configurar pagamento
                      </Link>
                    )}
                  </div>
                </div>

                {item.conferencia && (
                  <div className="mt-4">
                    <ConferenciaResumo conferencia={item.conferencia} titulo="Última conferência" />
                  </div>
                )}

                {item.ultimaLeitura && (
                  <button
                    type="button"
                    onClick={() => setAberta(aberta === item.maquina.id ? null : item.maquina.id)}
                    className="mt-3 text-sm font-semibold text-primary hover:text-primary-dark"
                  >
                    {aberta === item.maquina.id ? "▲ Fechar histórico" : "▼ Ver histórico de leituras"}
                  </button>
                )}
                {aberta === item.maquina.id && <HistoricoMaquina maquinaId={item.maquina.id} />}
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default Conferencia;

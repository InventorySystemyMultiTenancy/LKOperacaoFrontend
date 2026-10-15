import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

// Leitores (POS) da conta Machine Pay da empresa e se já estão ligados a uma
// máquina do sistema. Os que faltam podem ser cadastrados com o POS já preenchido.
export function LeitoresContaMachinePay() {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    setCarregando(true);
    setErro("");
    try {
      const { data } = await api.get("/machine-pay/conta/leitores");
      setDados(data);
    } catch (error) {
      setErro(error.response?.data?.error || "Erro ao consultar a conta na Machine Pay");
    } finally {
      setCarregando(false);
    }
  };

  const alternar = () => {
    const abrir = !aberto;
    setAberto(abrir);
    if (abrir && !dados) carregar();
  };

  const leitores = (dados?.leitores || []).filter((l) => !l.caixaLivre);
  const semCadastro = leitores.filter((l) => !l.maquina);

  return (
    <div className="card mb-6 border-2 border-accent-yellow">
      <button
        type="button"
        onClick={alternar}
        className="w-full flex flex-wrap items-center justify-between gap-2 text-left"
      >
        <div>
          <p className="text-lg font-bold text-gray-900">
            📡 Leitores da conta {dados?.conta?.nome || dados?.nomeConfigurado || "Machine Pay"}
          </p>
          <p className="text-sm text-gray-600">
            Confira se todos os leitores da conta estão ligados a uma máquina do sistema.
          </p>
        </div>
        <span className="text-primary font-semibold">{aberto ? "▲ Fechar" : "▼ Abrir"}</span>
      </button>

      {aberto && (
        <div className="mt-4">
          {carregando && <p className="text-sm text-gray-500">Consultando o painel Machine Pay...</p>}
          {erro && <p className="text-sm text-red-700 font-semibold">{erro}</p>}

          {dados && !carregando && (
            <>
              <p className="text-sm mb-3">
                <strong>{leitores.length}</strong> leitores na conta ·{" "}
                <strong className={semCadastro.length ? "text-red-700" : "text-green-700"}>
                  {semCadastro.length} sem máquina cadastrada
                </strong>
                <button type="button" onClick={carregar} className="ml-3 text-primary font-semibold">
                  🔄 Atualizar
                </button>
              </p>
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>Ponto</th>
                      <th>POS</th>
                      <th>Status</th>
                      <th>Máquina no sistema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leitores.map((leitor) => (
                      <tr key={leitor.posId}>
                        <td>{leitor.nomePonto || "—"}</td>
                        <td className="font-mono">{leitor.posId}</td>
                        <td>{leitor.online ? "🟢 Online" : "🔴 Offline"}</td>
                        <td>
                          {leitor.maquina ? (
                            <Link to={`/maquinas/${leitor.maquina.id}`} className="text-primary font-semibold">
                              {leitor.maquina.nome || leitor.maquina.codigo}
                            </Link>
                          ) : (
                            <Link
                              to={`/maquinas/nova?posId=${encodeURIComponent(leitor.posId)}&usrId=${encodeURIComponent(
                                dados.conta?.usrId || "",
                              )}&nome=${encodeURIComponent(leitor.nomePonto || "")}`}
                              className="px-3 py-1 rounded-full text-xs font-bold bg-accent-yellow text-primary-dark"
                            >
                              ➕ Cadastrar máquina
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

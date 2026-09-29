import { useState, useEffect } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox, Modal } from "../components/UIComponents";
import { PageLoader, EmptyState } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";

export function Financeiro() {
  const { usuario } = useAuth();
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [lojasAReceber, setLojasAReceber] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editando, setEditando] = useState(null);
  const [valores, setValores] = useState({
    valorEntradaNotas: "",
    valorEntradaCartao: "",
  });
  const [bagBusca, setBagBusca] = useState("");
  const [lojaBusca, setLojaBusca] = useState("");
  const [buscandoMachinePay, setBuscandoMachinePay] = useState(null);
  const [avisoMachinePayFechamento, setAvisoMachinePayFechamento] = useState(null);
  const [modalDataInicio, setModalDataInicio] = useState(null);
  const [dataInicioBusca, setDataInicioBusca] = useState("");

  useEffect(() => {
    carregarPendenciasFinanceiras();
  }, []);

  const carregarPendenciasFinanceiras = async () => {
    try {
      setLoading(true);
      const [movsRes, areceberRes] = await Promise.all([
        api.get("/movimentacoes/pendentes-financeiro"),
        api.get("/roteiros/financeiro/areceber"),
      ]);
      setMovimentacoes(movsRes.data || []);
      setLojasAReceber(areceberRes.data || []);
    } catch (error) {
      setError("Erro ao carregar movimentações: " + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const iniciarEdicao = (movimentacao) => {
    setEditando(movimentacao.id);
    setValores({
      valorEntradaNotas: movimentacao.valorEntradaNotas || "",
      valorEntradaCartao: movimentacao.valorEntradaCartao || "",
    });
    setDataInicioBusca("");
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setValores({
      valorEntradaNotas: "",
      valorEntradaCartao: "",
    });
    setDataInicioBusca("");
  };

  const salvarValores = async (movimentacaoId) => {
    try {
      setError("");
      setAvisoMachinePayFechamento(null);
      const resposta = await api.put(`/movimentacoes/${movimentacaoId}/financeiro`, valores);
      setSuccess("Valores financeiros salvos com sucesso!");

      const { machinePayFechamento } = resposta.data;
      if (machinePayFechamento?.sucesso === true) {
        setAvisoMachinePayFechamento({ type: "success", message: "Caixa fechado na Machine Pay." });
      } else if (machinePayFechamento?.sucesso === false) {
        setAvisoMachinePayFechamento({
          type: "warning",
          message: `Confirmação salva, mas não foi possível fechar o caixa na Machine Pay (${machinePayFechamento.erro || machinePayFechamento.motivo || "motivo desconhecido"}).`,
        });
      }

      setEditando(null);
      setValores({
        // Removido valorEntradaMoedas
        valorEntradaNotas: "",
        valorEntradaCartao: "",
      });
      setDataInicioBusca("");
      await carregarPendenciasFinanceiras();
    } catch (error) {
      setError("Erro ao salvar valores: " + (error.response?.data?.error || error.message));
    }
  };

  const buscarNovamenteValorDigital = async (movimentacaoId, dataInicio) => {
    try {
      setError("");
      setBuscandoMachinePay(movimentacaoId);
      const resposta = await api.post(
        `/movimentacoes/${movimentacaoId}/machine-pay/buscar`,
        dataInicio ? { dataInicio } : {}
      );
      const { fechamento } = resposta.data;
      setValores((prev) => ({ ...prev, valorEntradaCartao: fechamento.cartaoPix }));
      setSuccess(`Valor digital atualizado: R$ ${Number(fechamento.cartaoPix).toFixed(2)}`);
      setModalDataInicio(null);
      setDataInicioBusca("");
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 400 && data?.machinePayPrecisaDataInicio) {
        setModalDataInicio({ movimentacaoId, dataInicio: "" });
        return;
      }
      setError(data?.error || "Erro ao buscar valor digital na Machine Pay");
    } finally {
      setBuscandoMachinePay(null);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Gestão Financeira"
          subtitle="Preencha valores de movimentações com bag pendentes"
          icon="💰"
        />

        {error && <AlertBox type="error" message={error} onClose={() => setError("")} />}
        {success && <AlertBox type="success" message={success} onClose={() => setSuccess("")} />}
        {avisoMachinePayFechamento && (
          <AlertBox
            type={avisoMachinePayFechamento.type}
            message={avisoMachinePayFechamento.message}
            onClose={() => setAvisoMachinePayFechamento(null)}
          />
        )}

        {lojasAReceber.length === 0 && movimentacoes.length === 0 ? (
          <EmptyState message="Não há movimentações pendentes de preenchimento financeiro" icon="✅" />
        ) : (
          <div className="space-y-10">
            {/* À Receber */}
            {lojasAReceber.length > 0 ? (
              <div className="bg-white shadow-md rounded-lg overflow-hidden p-4">
                <h2 className="text-xl font-bold mb-4">À Receber (Lojas)</h2>
                <div className="space-y-3">
                  {lojasAReceber.map((item) => {
                    const criado = new Date(item.createdAt || item.dataMarcacao);
                    const diffDias = Math.floor((Date.now() - criado.getTime()) / (1000 * 60 * 60 * 24));
                    const atrasado = diffDias > 7;
                    // Calcular valor a receber da loja
                    const valorTotal = item.valorTotal ?? item.totalLucro ?? 0;
                    const comissao = item.comissao ?? item.totalComissao ?? 0;
                    const valorAReceber = valorTotal - comissao;
                    return (
                      <div key={item.id} className={`flex items-center justify-between p-3 rounded border ${atrasado ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            {item.loja?.nome || 'Loja'}
                            <span className="text-green-700 bg-green-100 rounded px-2 py-1 text-sm font-bold ml-2">
                              R$ {valorAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            Marcado em {criado.toLocaleDateString()} {atrasado && (<span className="text-red-700 font-semibold ml-1">(&gt; 1 semana)</span>)}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await api.put(`/roteiros/financeiro/areceber/${item.id}/receber`);
                              setSuccess("Recebimento confirmado!");
                              await carregarPendenciasFinanceiras();
                            } catch (e) {
                              setError("Erro ao confirmar recebimento: " + (e.response?.data?.error || e.message));
                            }
                          }}
                          className="btn-success"
                        >
                          ✓ Recebido
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Pendentes de Valores */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="p-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0">
                <h2 className="text-xl font-bold">Pendentes de Valores (Bags)</h2>
                <div className="flex gap-2 mt-2 md:mt-0">
                  <input
                    type="text"
                    placeholder="Buscar por Nº Bag..."
                    value={bagBusca}
                    onChange={e => setBagBusca(e.target.value)}
                    className="px-2 py-1 border rounded text-sm w-44"
                  />
                  <input
                    type="text"
                    placeholder="Buscar por nome da loja..."
                    value={lojaBusca}
                    onChange={e => setLojaBusca(e.target.value)}
                    className="px-2 py-1 border rounded text-sm w-56"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loja</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Máquina / Bag</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valores (R$)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {movimentacoes
                      .filter(mov => {
                        const bagOk = bagBusca.trim() === "" || (mov.numeroBag && mov.numeroBag.toString().includes(bagBusca.trim()));
                        const lojaNome = mov.maquina?.loja?.nome?.toLowerCase() || "";
                        const lojaOk = lojaBusca.trim() === "" || lojaNome.includes(lojaBusca.trim().toLowerCase());
                        return bagOk && lojaOk;
                      })
                      .map((mov) => (
                      <tr key={mov.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(mov.dataColeta).toLocaleDateString("pt-BR")}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{mov.maquina?.loja?.nome || "N/A"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{mov.maquina?.codigo} - {mov.maquina?.nome}</span>
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">{mov.numeroBag}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {editando === mov.id ? (
                            <div className="space-y-2">
                              <input type="number" step="0.01" placeholder="Notas" value={valores.valorEntradaNotas} onChange={(e) => setValores({ ...valores, valorEntradaNotas: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
                              <input type="number" step="0.01" placeholder="Digital" value={valores.valorEntradaCartao} onChange={(e) => setValores({ ...valores, valorEntradaCartao: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
                              {Boolean(mov.machinePayPosId) && (() => {
                                const precisaDataInicio = mov.machinePayPrecisaDataInicio === true;
                                return (
                                  <div className="space-y-1">
                                    {precisaDataInicio && (
                                      <>
                                        <label className="block text-xs font-semibold text-purple-900">
                                          Desde quando considerar os valores digitais?
                                        </label>
                                        <input
                                          type="date"
                                          value={dataInicioBusca}
                                          onChange={(e) => setDataInicioBusca(e.target.value)}
                                          className="w-full px-2 py-1 border rounded text-sm"
                                          required
                                        />
                                        <p className="text-xs text-gray-500">
                                          Esta é a primeira coleta desta máquina com leitor Machine
                                          Pay configurado — informe a partir de qual data devemos
                                          considerar o faturamento digital (PIX/cartão).
                                        </p>
                                      </>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        buscarNovamenteValorDigital(
                                          mov.id,
                                          dataInicioBusca || undefined
                                        )
                                      }
                                      disabled={
                                        buscandoMachinePay === mov.id ||
                                        (precisaDataInicio && !dataInicioBusca)
                                      }
                                      title="Buscar na Machine Pay o valor entre a última movimentação da máquina e esta coleta"
                                      className="w-full text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 disabled:opacity-50 text-blue-800 rounded"
                                    >
                                      {buscandoMachinePay === mov.id ? "⏳ Buscando..." : "🔄 Buscar novamente"}
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <span className="text-yellow-600 font-semibold">Pendente</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {editando === mov.id ? (
                            <div className="flex gap-2">
                              <button onClick={() => salvarValores(mov.id)} className="text-green-600 hover:text-green-900">✓ Salvar</button>
                              <button onClick={cancelarEdicao} className="text-red-600 hover:text-red-900">✗ Cancelar</button>
                            </div>
                          ) : (
                            <button onClick={() => iniciarEdicao(mov)} className="text-blue-600 hover:text-blue-900">✏️ Preencher</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!modalDataInicio}
        onClose={() => setModalDataInicio(null)}
        title="Informe a data inicial"
        size="sm"
      >
        <p className="text-sm text-gray-700 mb-4">
          Não foi possível determinar automaticamente o período. Informe desde quando
          contar os valores digitais desta máquina.
        </p>
        <input
          type="date"
          value={modalDataInicio?.dataInicio || ""}
          onChange={(e) =>
            setModalDataInicio({ ...modalDataInicio, dataInicio: e.target.value })
          }
          className="input-field mb-4"
        />
        <div className="flex gap-3 justify-end">
          <button onClick={() => setModalDataInicio(null)} className="btn-secondary">
            Cancelar
          </button>
          <button
            onClick={() =>
              buscarNovamenteValorDigital(modalDataInicio.movimentacaoId, modalDataInicio.dataInicio)
            }
            disabled={!modalDataInicio?.dataInicio || buscandoMachinePay === modalDataInicio?.movimentacaoId}
            className="btn-primary"
          >
            {buscandoMachinePay === modalDataInicio?.movimentacaoId ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}

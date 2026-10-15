import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { AlertBox, PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../contexts/AuthContext";
import {
  enviarWhatsapp,
  formatarMaquinaManutencao,
  montarTextoWhatsapp,
} from "../utils/whatsappManutencao";

const normalizarStatusManutencao = status => String(status || "").trim().toLowerCase();
const isUrgente = status => normalizarStatusManutencao(status) === "urgente";
const isConcluida = status => {
  const statusNormalizado = normalizarStatusManutencao(status);
  return statusNormalizado === "feito" || statusNormalizado === "concluida";
};

function BotaoWhatsapp({ onClick, compacto = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Enviar pelo WhatsApp"
      className={`inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] font-semibold text-white hover:bg-[#1ebe5b] ${
        compacto ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm"
      }`}
    >
      <svg className={compacto ? "h-4 w-4" : "h-5 w-5"} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.37 9.37 0 0 1 6.67 2.77 9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.24 9.43-9.44 9.43zm8.03-17.46A11.27 11.27 0 0 0 12.05.72C5.8.72.7 5.8.7 12.07c0 2 .52 3.95 1.52 5.67L.6 23.6l6-1.57a11.32 11.32 0 0 0 5.43 1.38h.01c6.26 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.32-8.02z" />
      </svg>
      {compacto ? "Enviar" : "Enviar no WhatsApp"}
    </button>
  );
}

function Manutencoes() {
      const [novaManutencaoUrgente, setNovaManutencaoUrgente] = useState(false);
    // Cadastro de nova manutenção
    const [showNovaManutencao, setShowNovaManutencao] = useState(false);
    const [novaManutencao, setNovaManutencao] = useState({
      roteiroId: "",
      lojaId: "",
      maquinaId: "",
      descricao: "",
      funcionarioId: ""
    });
      const [erroNovaManutencao, setErroNovaManutencao] = useState("");
    // Removido: const [maquinas, setMaquinas] = useState([]);
    const [lojasAll, setLojasAll] = useState([]);
    const [roteirosAll, setRoteirosAll] = useState([]);
    // Removido: const [maquinasAll, setMaquinasAll] = useState([]);
    // Removido: const [maquinasFiltradas, setMaquinasFiltradas] = useState([]);
    useEffect(() => {
      if (showNovaManutencao) {
        api.get("/lojas").then(res => setLojasAll(res.data || []));
        api.get("/roteiros").then(res => setRoteirosAll(res.data || []));
        api.get("/maquinas").then(res => setMaquinasAll(res.data || []));
        api.get("/usuarios/funcionarios").then(res => setFuncionarios(res.data || []));
      }
    }, [showNovaManutencao]);
  // Removido: const [roteirosAll, setRoteirosAll] = useState([]);
  const [maquinasAll, setMaquinasAll] = useState([]);
  const [maquinasFiltradas, setMaquinasFiltradas] = useState([]);

    // Quando a loja for selecionada, filtra roteiros e máquinas no frontend
    useEffect(() => {
      if (novaManutencao.lojaId) {
        // Filtra roteiros da loja
        const roteirosDaLoja = roteirosAll.filter(r => r.lojaId === novaManutencao.lojaId);
        if (roteirosDaLoja.length > 0) {
          setNovaManutencao(prev => ({ ...prev, roteiroId: roteirosDaLoja[0].id }));
        } else {
          setNovaManutencao(prev => ({ ...prev, roteiroId: "" }));
        }
        // Filtra máquinas da loja
        const maquinasDaLoja = maquinasAll.filter(m => m.lojaId === novaManutencao.lojaId);
        setMaquinasFiltradas(maquinasDaLoja);
        setNovaManutencao(prev => ({ ...prev, maquinaId: "" }));
      } else {
        setMaquinasFiltradas([]);
        setNovaManutencao(prev => ({ ...prev, roteiroId: "", maquinaId: "" }));
      }
    }, [novaManutencao.lojaId, roteirosAll, maquinasAll]);

    async function handleNovaManutencao(e) {
      e.preventDefault();
      try {
        setLoading(true);
        setError("");
        setSuccess("");
        setErroNovaManutencao("");
        // Cadastro de manutenção SEM depender de roteiros do dia
        const payload = {
          maquinaId: novaManutencao.maquinaId || null,
          descricao: novaManutencao.descricao,
          lojaId: novaManutencao.lojaId,
          roteiroId: null,
          funcionarioId: novaManutencao.funcionarioId,
          status: novaManutencaoUrgente ? "urgente" : "pendente"
        };
        await api.post("/manutencoes", payload);
        setShowNovaManutencao(false);
        setLoading(false);
      } catch (err) {
        console.error("[NovaManutencao] Erro POST", err);
        setError("Erro ao cadastrar manutenção: " +
          (err?.response?.status ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message || err));
      } finally {
        setLoading(false);
      }
    }
  const { usuario, pode, temPermissoesPersonalizadas } = useAuth();
  // ...existing code...
  const [funcionarios, setFuncionarios] = useState([]);
  const [editando, setEditando] = useState(false);
  const [editData, setEditData] = useState({
    lojaId: "",
    maquinaId: "",
    funcionarioId: "",
    status: "",
    descricao: ""
  });
  const [success, setSuccess] = useState("");

  // Carregar opções disponíveis para edição
  useEffect(() => {
    if (editando) {
      Promise.all([
        api.get("/lojas"),
        api.get("/maquinas"),
        api.get("/usuarios/funcionarios")
      ]).then(([lojasRes, maquinasRes, funcionariosRes]) => {
        setLojasAll(lojasRes.data || []);
        setMaquinasAll(maquinasRes.data || []);
        setFuncionarios(funcionariosRes.data || []);
      }).catch(err => {
        console.error("Erro ao carregar opções para edição:", err);
        setError("Erro ao carregar lojas, máquinas e funcionários.");
      });
    }
  }, [editando]);

  // Função para deletar manutenção
  async function handleDelete() {
    if (!detalhe) return;
    if (!window.confirm("Tem certeza que deseja excluir esta manutenção?")) return;
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const token = localStorage.getItem("token");
      const url = `/manutencoes/${detalhe.id}`;
      console.log("[DEBUG] DELETE manutenção (axios):", url, { id: detalhe.id });
      try {
        await api.delete(url, { headers: { Authorization: `Bearer ${token}` } });
        setSuccess("Manutenção excluída com sucesso!");
        setDetalhe(null);
        // Atualizar lista
        const res = await api.get("/manutencoes");
        setManutencoes(res.data);
      } catch (err) {
        console.error("[DEBUG] Erro ao excluir manutenção (axios):", err?.response?.status, err?.response?.data, err);
        setError("Erro ao excluir manutenção: " + (err?.response?.status ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message || err));
        return;
      }
    } catch (err) {
      console.error("[DEBUG] Erro ao excluir manutenção (catch):", err);
      setError("Erro ao excluir manutenção: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  // Função para abrir modal de edição
  function handleEditOpen() {
    const statusNormalizado = normalizarStatusManutencao(detalhe?.status);
    setEditData({
      lojaId: detalhe?.lojaId || detalhe?.loja?.id || "",
      maquinaId: detalhe?.maquinaId || detalhe?.maquina?.id || "",
      funcionarioId: detalhe?.funcionarioId || "",
      status: statusNormalizado === "urgente" ? "urgente" : "pendente",
      descricao: detalhe?.descricao || "",
    });
    setEditando(true);
  }

  // Função para salvar edição
  async function handleEditSave(e) {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        await api.put(`/manutencoes/${detalhe.id}`, {
          ...editData,
          maquinaId: editData.maquinaId || null,
          status: normalizarStatusManutencao(editData.status) || "pendente",
        });
        setSuccess("Manutenção atualizada com sucesso!");
        setEditando(false);
        setDetalhe(null);
        // Atualizar lista
        const res = await api.get("/manutencoes");
        setManutencoes(res.data);
      } catch (err) {
        console.error("Erro ao atualizar manutenção (axios):", err?.response?.status, err?.response?.data, err);
        setError("Erro ao atualizar manutenção: " + (err?.response?.status ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message || err));
      }
    } catch (err) {
      console.error("Erro ao atualizar manutenção (catch):", err);
      setError("Erro ao atualizar manutenção: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }
  const [manutencoes, setManutencoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroLoja, setFiltroLoja] = useState("");
  // Removido filtro de roteiro
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const LIMITE_FEITAS_INICIAL = 10;
  const [limiteFeitas, setLimiteFeitas] = useState(LIMITE_FEITAS_INICIAL);

  useEffect(() => {
    async function fetchManutencoes() {
      setLoading(true);
      try {
        const res = await api.get("/manutencoes");
        setManutencoes(res.data);
      } catch (err) {
        console.error("Erro ao buscar manutenções:", err?.response?.status, err?.response?.data, err);
        setError("Erro ao buscar manutenções: troque api" + (err?.response?.status ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message || err));
      } finally {
        setLoading(false);
      }
    }
    fetchManutencoes();
  }, []);

  const lojas = Array.from(new Set(manutencoes.map(m => m.loja?.nome).filter(Boolean)));
  const statusList = Array.from(new Set(manutencoes.map(m => normalizarStatusManutencao(m.status)).filter(Boolean)));

  // Abas de filtro: pendentes/urgentes
  const [abaManutencao, setAbaManutencao] = useState("pendentes");
  // Aba de recorrência: máquinas com várias manutenções num período curto
  const [periodoRecorrencia, setPeriodoRecorrencia] = useState(30);
  const [minimoRecorrencia, setMinimoRecorrencia] = useState(3);
  const [recorrenciaAberta, setRecorrenciaAberta] = useState(null);

  // Reinicia a paginação de "feitas" sempre que os filtros mudam
  useEffect(() => {
    setLimiteFeitas(LIMITE_FEITAS_INICIAL);
  }, [filtroLoja, filtroStatus, filtroDataInicio, filtroDataFim, abaManutencao]);

  const podeGerenciar = pode("manutencoes.gerenciar", usuario?.role === "ADMIN");
  const podeAtualizar = pode("manutencoes.atualizar", true);
  // Usuário personalizado com a aba liberada vê todas, mesmo sendo FUNCIONARIO.
  // Os demais sem "gerenciar" veem apenas as atribuídas a eles.
  const podeVerTodas = podeGerenciar || temPermissoesPersonalizadas;
  let filtradas = manutencoes.filter(m => {
    if (!podeVerTodas) {
      // Funcionário só vê as suas e apenas as que não estão feitas
      if (m.funcionarioId !== usuario?.id) return false;
      if (isConcluida(m.status)) return false;
    }
    // Filtro de aba
    if (abaManutencao === "urgentes" && !isUrgente(m.status)) return false;
    if (abaManutencao === "pendentes" && isUrgente(m.status)) return false;
    if (filtroDataInicio || filtroDataFim) {
      const dataManutencao = new Date(m.createdAt);
      if (filtroDataInicio) {
        const inicio = new Date(`${filtroDataInicio}T00:00:00`);
        if (dataManutencao < inicio) return false;
      }
      if (filtroDataFim) {
        const fim = new Date(`${filtroDataFim}T23:59:59.999`);
        if (dataManutencao > fim) return false;
      }
    }
    return (!filtroLoja || m.loja?.nome === filtroLoja) &&
      (!filtroStatus || normalizarStatusManutencao(m.status) === normalizarStatusManutencao(filtroStatus));
  });

  // Para admin, limitar as manutenções feitas exibidas (com botão "mostrar mais")
  let totalFeitas = 0;
  let temMaisFeitas = false;
  if (podeVerTodas && (!filtroStatus || isConcluida(filtroStatus))) {
    const feitas = filtradas.filter(m => isConcluida(m.status));
    const outras = filtradas.filter(m => !isConcluida(m.status));
    // Ordenar por data decrescente
    feitas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    totalFeitas = feitas.length;
    temMaisFeitas = feitas.length > limiteFeitas;
    filtradas = outras.concat(feitas.slice(0, limiteFeitas));
  }

  const formatarEnderecoLoja = loja => {
    if (!loja) return "Sem loja";
    const endereco = (loja.endereco || "").trim();
    const cidade = (loja.cidade || "").trim();
    const estado = (loja.estado || "").trim();
    const cidadeUf = cidade && estado ? `${cidade}/${estado}` : (cidade || estado);

    if (endereco && cidadeUf) return `${endereco} - ${cidadeUf}`;
    if (endereco) return endereco;
    if (cidadeUf) return cidadeUf;
    return "Endereço não cadastrado";
  };


  const formatLojaNome = loja => (loja?.nome ? loja.nome : "-");

  const formatLojaEnderecoSuffix = loja => {
    const endereco = formatarEnderecoLoja(loja);
    if (!endereco || endereco === "Sem loja") return "";
    return ` - ${endereco}`;
  };

  const maquinasEdicao = maquinasAll.filter(
    maquina => String(maquina.lojaId) === String(editData.lojaId)
  );

  // ALERTA DE MANUTENÇÕES FREQUENTES
  let alertasFrequentes = [];
  if (podeGerenciar && manutencoes.length > 0) {
    const agora = new Date();
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Agrupar por máquina
    const porMaquina = {};
    manutencoes.forEach(m => {
      if (!m.maquina?.id) return;
      const data = new Date(m.createdAt);
      if (data >= seteDiasAtras) {
        if (!porMaquina[m.maquina.id]) porMaquina[m.maquina.id] = [];
        porMaquina[m.maquina.id].push(m);
      }
    });
    alertasFrequentes = Object.values(porMaquina)
      .filter(arr => {
        // Só alerta se houver pelo menos uma manutenção pendente nessa máquina
        const temPendente = arr.some(m => !isConcluida(m.status));
        return arr.length >= 2 && temPendente;
      })
      .map(arr => {
        const maquina = arr[0].maquina;
        const loja = arr[0].loja;
        const endereco = formatLojaEnderecoSuffix(loja);
        return `Manutenções frequentes na máquina ${maquina?.nome || ''} da loja ${loja?.nome || ''}${endereco}`;
      });
  }

  // RECORRÊNCIA: máquinas com `minimoRecorrencia`+ manutenções nos últimos `periodoRecorrencia` dias
  const recorrencias = (() => {
    if (!podeVerTodas) return [];
    const inicioPeriodo = new Date(Date.now() - periodoRecorrencia * 24 * 60 * 60 * 1000);
    const porMaquina = {};
    manutencoes.forEach(m => {
      if (!m.maquina?.id) return;
      if (filtroLoja && m.loja?.nome !== filtroLoja) return;
      if (new Date(m.createdAt) < inicioPeriodo) return;
      if (!porMaquina[m.maquina.id]) porMaquina[m.maquina.id] = [];
      porMaquina[m.maquina.id].push(m);
    });
    return Object.entries(porMaquina)
      .filter(([, lista]) => lista.length >= minimoRecorrencia)
      .map(([maquinaId, lista]) => {
        lista.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return {
          maquinaId,
          maquina: lista[0].maquina,
          loja: lista[0].loja,
          manutencoes: lista,
          pendentes: lista.filter(m => !isConcluida(m.status)).length,
          ultima: lista[0].createdAt,
          // Dobro do mínimo ou mais = crítico
          critico: lista.length >= minimoRecorrencia * 2,
        };
      })
      .sort((a, b) => b.manutencoes.length - a.manutencoes.length || new Date(b.ultima) - new Date(a.ultima));
  })();

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Manutenções"
          subtitle="Acompanhe todas as manutenções registradas"
          icon="🛠️"
          action={
            pode("machinePay", usuario?.role === "ADMIN" || usuario?.role === "FINANCEIRO") ? (
              <Link to="/machine-pay" className="btn-secondary flex items-center gap-2">
                📡 Machine Pay
              </Link>
            ) : null
          }
        />
        {podeGerenciar && (
          <div className="mb-4">
            <button className="btn-primary" onClick={() => setShowNovaManutencao(true)}>Nova Manutenção</button>
          </div>
        )}
        {error && <AlertBox type="error" message={error} onClose={() => setError("")} />}
        {success && <AlertBox type="success" message={success} onClose={() => setSuccess("")} />}
        {podeGerenciar && alertasFrequentes.length > 0 && (
          <div className="mb-4">
            {alertasFrequentes.map((msg, idx) => (
              <AlertBox key={idx} type="warning" message={msg} />
            ))}
          </div>
        )}
        <div className="mb-4 flex flex-wrap gap-4 items-center">
          {/* Abas de filtro pendentes/urgentes */}
          <div className="flex gap-2">
            <button
              className={`btn-secondary ${abaManutencao === "pendentes" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
              onClick={() => setAbaManutencao("pendentes")}
              type="button"
            >Pendentes</button>
            <button
              className={`btn-secondary ${abaManutencao === "urgentes" ? "bg-red-500 text-white" : "bg-gray-200"}`}
              onClick={() => setAbaManutencao("urgentes")}
              type="button"
            >Urgentes</button>
            {podeVerTodas && (
              <button
                className={`btn-secondary ${abaManutencao === "recorrencia" ? "bg-orange-500 text-white" : "bg-gray-200"}`}
                onClick={() => setAbaManutencao("recorrencia")}
                type="button"
              >
                🔁 Recorrência
                {recorrencias.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-orange-600 text-white text-xs font-bold px-2 py-0.5">
                    {recorrencias.length}
                  </span>
                )}
              </button>
            )}
          </div>
          <select className="input-field" value={filtroLoja} onChange={e => setFiltroLoja(e.target.value)}>
            <option value="">Todas as lojas</option>
            {lojas.map(loja => <option key={loja} value={loja}>{loja}</option>)}
          </select>
          {abaManutencao === "recorrencia" ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-gray-500">Período</label>
              <select
                className="input-field"
                value={periodoRecorrencia}
                onChange={e => setPeriodoRecorrencia(Number(e.target.value))}
              >
                {[7, 15, 30, 60, 90].map(d => <option key={d} value={d}>Últimos {d} dias</option>)}
              </select>
              <label className="text-sm text-gray-500">Mínimo</label>
              <select
                className="input-field"
                value={minimoRecorrencia}
                onChange={e => setMinimoRecorrencia(Number(e.target.value))}
              >
                {[2, 3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n} manutenções</option>)}
              </select>
            </div>
          ) : (
          <>
          <select className="input-field" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {statusList.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">De</label>
            <input
              type="date"
              className="input-field"
              value={filtroDataInicio}
              onChange={e => setFiltroDataInicio(e.target.value)}
              max={filtroDataFim || undefined}
            />
            <label className="text-sm text-gray-500">Até</label>
            <input
              type="date"
              className="input-field"
              value={filtroDataFim}
              onChange={e => setFiltroDataFim(e.target.value)}
              min={filtroDataInicio || undefined}
            />
            {(filtroDataInicio || filtroDataFim) && (
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline"
                onClick={() => { setFiltroDataInicio(""); setFiltroDataFim(""); }}
              >
                Limpar datas
              </button>
            )}
          </div>
          </>
          )}
        </div>
        {showNovaManutencao && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <form className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative" onSubmit={handleNovaManutencao}>
              <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" type="button" onClick={() => setShowNovaManutencao(false)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <h3 className="text-xl font-bold mb-4">Nova Manutenção</h3>
                {erroNovaManutencao && (
                  <div className="bg-red-100 text-red-700 rounded p-2 mb-2 text-sm">{erroNovaManutencao}</div>
                )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">Loja</label>
                  {/* Campo de busca para loja com autocomplete */}
                  <div className="relative w-full">
                    <input
                      type="text"
                      className="input-field w-full"
                      placeholder="Digite para buscar a loja (opcional)"
                      value={novaManutencao.lojaBusca || ''}
                      onChange={e => {
                        const busca = e.target.value;
                        setNovaManutencao(d => ({ ...d, lojaBusca: busca }));
                      }}
                    />
                    {novaManutencao.lojaBusca && (
                      <div className="absolute z-10 bg-white border border-gray-200 rounded w-full max-h-48 overflow-y-auto mt-1 shadow-lg">
                        {lojasAll
                          .filter(l => l.nome.toLowerCase().includes((novaManutencao.lojaBusca || '').toLowerCase()))
                          .map(l => (
                            <div
                              key={l.id}
                              className={`px-3 py-2 cursor-pointer hover:bg-blue-100 ${novaManutencao.lojaId === l.id ? 'bg-blue-200' : ''}`}
                              onClick={() => {
                                setNovaManutencao(d => ({ ...d, lojaId: l.id, lojaBusca: l.nome }));
                              }}
                            >
                              {l.nome}
                            </div>
                          ))}
                        {/* Caso não encontre nenhuma loja */}
                        {lojasAll.filter(l => l.nome.toLowerCase().includes((novaManutencao.lojaBusca || '').toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-gray-400">Nenhuma loja encontrada</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium">Máquina</label>
                  <select className="input-field w-full" value={novaManutencao.maquinaId} onChange={e => setNovaManutencao(d => ({ ...d, maquinaId: e.target.value }))} disabled={!novaManutencao.lojaId}>
                    <option value="">Selecione (opcional)</option>
                    {maquinasFiltradas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Funcionário (opcional)</label>
                  <select className="input-field w-full" value={novaManutencao.funcionarioId} onChange={e => setNovaManutencao(d => ({ ...d, funcionarioId: e.target.value }))}>
                    <option value="">Selecione</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Descrição</label>
                  <textarea className="input-field w-full" value={novaManutencao.descricao} onChange={e => setNovaManutencao(d => ({ ...d, descricao: e.target.value }))} required />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={novaManutencaoUrgente}
                    onChange={e => setNovaManutencaoUrgente(e.target.checked)}
                    id="novaManutencaoUrgente"
                  />
                  <label htmlFor="novaManutencaoUrgente" className="text-sm font-semibold text-red-700">Urgente</label>
                </div>
                <button className="btn-primary w-full mt-2" type="submit">Cadastrar</button>
              </div>
            </form>
          </div>
        )}
        {loading ? <PageLoader /> : abaManutencao === "recorrencia" ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Máquinas com {minimoRecorrencia} ou mais manutenções nos últimos {periodoRecorrencia} dias
              {filtroLoja ? ` na loja ${filtroLoja}` : ""}. Clique para ver o histórico.
            </p>
            {recorrencias.length === 0 && (
              <div className="bg-white rounded-lg shadow text-center text-gray-400 py-8">
                Nenhuma máquina com manutenções recorrentes neste período
              </div>
            )}
            {recorrencias.map(r => {
              const aberta = recorrenciaAberta === r.maquinaId;
              return (
                <div
                  key={r.maquinaId}
                  className={`bg-white rounded-lg shadow border-l-4 ${r.critico ? "border-red-500" : "border-orange-400"}`}
                >
                  <button
                    type="button"
                    className="w-full text-left p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-orange-50 rounded-lg"
                    onClick={() => setRecorrenciaAberta(aberta ? null : r.maquinaId)}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 flex items-center gap-2">
                        {r.critico ? "🚨" : "⚠️"} {r.maquina?.nome || "Máquina sem nome"}
                        {r.critico && (
                          <span className="text-xs font-semibold bg-red-100 text-red-700 rounded-full px-2 py-0.5">Crítico</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatLojaNome(r.loja)}{formatLojaEnderecoSuffix(r.loja)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${r.critico ? "text-red-600" : "text-orange-600"}`}>
                          {r.manutencoes.length}
                        </div>
                        <div className="text-xs text-gray-500">em {periodoRecorrencia} dias</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-700">{r.pendentes}</div>
                        <div className="text-xs text-gray-500">pendente(s)</div>
                      </div>
                      <div className="text-xs text-gray-500">
                        Última: {new Date(r.ultima).toLocaleDateString("pt-BR")}
                      </div>
                      <span className="text-gray-400">{aberta ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  {aberta && (
                    <ul className="border-t divide-y divide-gray-100">
                      {r.manutencoes.map(m => (
                        <li
                          key={m.id}
                          className="px-4 py-2 flex flex-wrap justify-between gap-2 text-sm cursor-pointer hover:bg-blue-50"
                          onClick={() => setDetalhe(m)}
                        >
                          <span className="text-gray-900">{m.descricao}</span>
                          <span className="flex gap-3 text-gray-500">
                            <span>{new Date(m.createdAt).toLocaleString("pt-BR")}</span>
                            <span>{m.funcionario?.nome || "-"}</span>
                            <span className={`font-semibold ${isConcluida(m.status) ? "text-green-700" : isUrgente(m.status) ? "text-red-600" : "text-gray-700"}`}>
                              {m.status}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Loja</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Endereço</th>
                  {/* Coluna de roteiro removida */}
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Máquina</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Atribuído a</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtradas.map(m => (
                  <tr
                    key={m.id}
                    className={
                      `hover:bg-blue-50 cursor-pointer` +
                      (isUrgente(m.status) ? " bg-red-100 border-l-4 border-red-500 animate-pulse" : "") +
                      (podeVerTodas && isConcluida(m.status) ? " bg-green-100" : "")
                    }
                    onClick={() => setDetalhe(m)}
                  >
                    <td className="px-4 py-2">{m.descricao}</td>
                    <td className="px-4 py-2">{new Date(m.createdAt).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2">{formatLojaNome(m.loja)}</td>
                    <td className="px-4 py-2">{formatarEnderecoLoja(m.loja)}</td>
                    {/* Coluna de roteiro removida */}
                    <td className="px-4 py-2">{m.maquina?.nome || '-'}</td>
                    <td className="px-4 py-2">{m.funcionario?.nome || m.funcionarioId || '-'}</td>
                    <td className="px-4 py-2 font-bold">
                      {isConcluida(m.status) ? (
                        <span className="text-green-700">{m.status}</span>
                      ) : m.status}
                    </td>
                    <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                      <BotaoWhatsapp compacto onClick={() => enviarWhatsapp(montarTextoWhatsapp(m))} />
                    </td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-gray-400 py-8">Nenhuma manutenção encontrada</td></tr>
                )}
              </tbody>
            </table>
            {temMaisFeitas && (
              <div className="flex flex-col items-center gap-1 py-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setLimiteFeitas(prev => prev + 10)}
                >
                  Mostrar mais 10
                </button>
                <span className="text-xs text-gray-400">
                  Mostrando {Math.min(limiteFeitas, totalFeitas)} de {totalFeitas} manutenções feitas
                </span>
              </div>
            )}
          </div>
        )}
        {detalhe && !editando && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
              <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={() => setDetalhe(null)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <h3 className="text-xl font-bold mb-4">Detalhes da Manutenção</h3>
              <div className="space-y-2">
                <div><strong>Descrição:</strong> {detalhe.descricao}</div>
                <div><strong>Data/Hora:</strong> {new Date(detalhe.createdAt).toLocaleString("pt-BR")}</div>
                <div><strong>Status:</strong> {detalhe.status}</div>
                <div><strong>Loja:</strong> {formatLojaNome(detalhe.loja)} </div>
                <div><strong>Endereço:</strong> {formatarEnderecoLoja(detalhe.loja)} </div>
                <div><strong>Máquina:</strong> {formatarMaquinaManutencao(detalhe.maquina) || '-'} </div>
                <div><strong>Atribuído a:</strong> {detalhe.funcionario?.nome || '-'} </div>
              </div>
              <div className="mt-4">
                <BotaoWhatsapp onClick={() => enviarWhatsapp(montarTextoWhatsapp(detalhe))} />
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {podeAtualizar && <button className="btn-primary" onClick={handleEditOpen}>Editar</button>}
                {podeGerenciar && <button className="btn-danger" onClick={handleDelete}>Excluir</button>}
                {podeAtualizar && (podeGerenciar || (!podeGerenciar && !isConcluida(detalhe.status))) && !isConcluida(detalhe.status) && (
                  <button className="btn-success" onClick={async () => {
                    try {
                      setLoading(true);
                      setError("");
                      setSuccess("");
                      const url = `/manutencoes/${detalhe.id}`;
                      const payload = { status: "feito" };
                      console.log("[DEBUG] PUT para marcar manutenção como feita:", url, payload);
                      const response = await api.put(url, payload);
                      console.log("[DEBUG] Resposta do PUT:", response);
                      setSuccess("Manutenção marcada como feita!");
                      setDetalhe(null);
                      const res = await api.get("/manutencoes");
                      setManutencoes(res.data);
                    } catch (err) {
                      console.error("[DEBUG] Erro ao marcar manutenção como feita:", err?.response?.status, err?.response?.data, err);
                      setError("Erro ao marcar manutenção como feita: " + (err?.response?.status ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message || err));
                    } finally {
                      setLoading(false);
                    }
                  }}>Marcar como Feita</button>
                )}
              </div>
            </div>
          </div>
        )}
        {detalhe && editando && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <form className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative" onSubmit={handleEditSave}>
              <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" type="button" onClick={() => setEditando(false)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <h3 className="text-xl font-bold mb-4">Editar Manutenção</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">Loja</label>
                  <select
                    className="input-field w-full"
                    value={editData.lojaId}
                    onChange={e => setEditData(d => ({
                      ...d,
                      lojaId: e.target.value,
                      maquinaId: ""
                    }))}
                    required
                  >
                    <option value="">Selecione</option>
                    {lojasAll.map(loja => (
                      <option key={loja.id} value={loja.id}>{loja.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Máquina</label>
                  <select
                    className="input-field w-full"
                    value={editData.maquinaId}
                    onChange={e => setEditData(d => ({ ...d, maquinaId: e.target.value }))}
                    disabled={!editData.lojaId}
                  >
                    <option value="">Selecione (opcional)</option>
                    {maquinasEdicao.map(maquina => (
                      <option key={maquina.id} value={maquina.id}>{maquina.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Funcionário</label>
                  <select className="input-field w-full" value={editData.funcionarioId} onChange={e => setEditData(d => ({ ...d, funcionarioId: e.target.value }))}>
                    <option value="">Selecione</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Status</label>
                  <select className="input-field w-full" value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}>
                    <option value="pendente">pendente</option>
                    <option value="urgente">urgente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Descrição</label>
                  <textarea className="input-field w-full" value={editData.descricao} onChange={e => setEditData(d => ({ ...d, descricao: e.target.value }))} />
                </div>
                <button className="btn-primary w-full mt-2" type="submit">Salvar</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default Manutencoes;

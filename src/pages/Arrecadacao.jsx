import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox } from "../components/UIComponents";
import { MovimentacoesAbas } from "../components/MovimentacoesAbas";
import { AssinaturaPad } from "../components/AssinaturaPad";
import { comprimirFoto } from "../components/LeituraRelogioFoto";
import { useAuth } from "../contexts/AuthContext";
import {
  reais,
  dataBR,
  baixarPdfVia,
  compartilharPdfVia,
  linkWhatsappVia,
} from "../utils/arrecadacaoVia";

const LINHAS_VALOR = [
  { campo: "dinheiro", rotulo: "DINHEIRO" },
  { campo: "cartao", rotulo: "CARTÃO" },
  { campo: "pix", rotulo: "PIX" },
  { campo: "moeda", rotulo: "MOEDA" },
  { campo: "fichas", rotulo: "FICHAS" },
];
const CAMPOS_VALOR = LINHAS_VALOR.map((l) => l.campo);

const hojeISO = () => {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const vazio = () => ({
  dinheiro: "",
  cartao: "",
  pix: "",
  moeda: "",
  fichas: "",
  caiu: "",
  contadorIn: "",
  contadorOut: "",
});

const ROTULO_CONFERENCIA = {
  OK: { texto: "✅ OK", classe: "bg-green-100 text-green-800" },
  LEVE: { texto: "⚠️ Atenção", classe: "bg-yellow-100 text-yellow-900" },
  URGENTE: { texto: "🚨 Urgente", classe: "bg-red-100 text-red-800" },
};

export function Arrecadacao() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === "ADMIN";
  const [searchParams] = useSearchParams();
  const roteiroId = searchParams.get("roteiroId");

  const [lojas, setLojas] = useState([]);
  const [lojaId, setLojaId] = useState(searchParams.get("lojaId") || "");
  const [dados, setDados] = useState(null);
  const [carregandoLoja, setCarregandoLoja] = useState(false);
  const [data, setData] = useState(hojeISO());
  const [selecionadas, setSelecionadas] = useState([]);
  const [valores, setValores] = useState({});
  const [editados, setEditados] = useState({});
  const [previas, setPrevias] = useState({});
  const [leiturasFoto, setLeiturasFoto] = useState({});
  const [lendoFoto, setLendoFoto] = useState(null);
  const [observacao, setObservacao] = useState("");
  const [percentual, setPercentual] = useState(0);
  const [recebedorNome, setRecebedorNome] = useState("");
  const [recebedorWhatsapp, setRecebedorWhatsapp] = useState("");
  const [visto, setVisto] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [historico, setHistorico] = useState([]);
  const [chaveVisto, setChaveVisto] = useState(0);
  const fotoRef = useRef(null);
  const fotoMaquinaRef = useRef(null);
  const editadosRef = useRef({});
  editadosRef.current = editados;

  useEffect(() => {
    api
      .get("/lojas")
      .then((res) => setLojas((res.data || []).filter((l) => l.ativo !== false)))
      .catch(() => setLojas([]));
    carregarHistorico();
  }, []);

  const carregarHistorico = () =>
    api
      .get("/arrecadacoes", { params: { limite: 10 } })
      .then((res) => setHistorico(res.data || []))
      .catch(() => setHistorico([]));

  // Preenche só os campos que o funcionário não alterou à mão
  const aplicarSugestao = (maquinaId, sugestao = {}) => {
    const ja = editadosRef.current[maquinaId] || {};
    setValores((atual) => {
      const linha = { ...(atual[maquinaId] || vazio()) };
      for (const [campo, valor] of Object.entries(sugestao)) {
        if (!ja[campo] && valor !== null && valor !== undefined) {
          linha[campo] = String(Number(valor.toFixed ? valor.toFixed(2) : valor));
        }
      }
      return { ...atual, [maquinaId]: linha };
    });
  };

  const calcularMaquina = async (maquinaId, contadores = {}) => {
    setPrevias((p) => ({ ...p, [maquinaId]: { ...(p[maquinaId] || {}), carregando: true } }));
    try {
      const { data: resposta } = await api.post("/arrecadacoes/previa-maquina", {
        maquinaId,
        contadorIn: contadores.contadorIn === "" ? null : contadores.contadorIn,
        contadorOut: contadores.contadorOut === "" ? null : contadores.contadorOut,
      });
      setPrevias((p) => ({ ...p, [maquinaId]: { ...resposta, carregando: false } }));
      aplicarSugestao(maquinaId, resposta.sugestao);
    } catch (error) {
      setPrevias((p) => ({
        ...p,
        [maquinaId]: { carregando: false, erro: error.response?.data?.error || "Erro ao calcular" },
      }));
    }
  };

  // Ao escolher a loja: dados, máquinas (todas marcadas) e quem conferiu da última vez
  useEffect(() => {
    if (!lojaId) {
      setDados(null);
      return;
    }
    setCarregandoLoja(true);
    setSalvo(null);
    setErro("");
    api
      .get("/arrecadacoes/preparar", { params: { lojaId } })
      .then(({ data: resposta }) => {
        setDados(resposta);
        setPercentual(resposta.loja.percentualComissao);
        setRecebedorNome(resposta.ultimoRecebedor?.nome || "");
        setRecebedorWhatsapp(resposta.ultimoRecebedor?.whatsapp || "");
        const ids = resposta.maquinas.map((m) => m.id);
        setSelecionadas(ids);
        setValores(Object.fromEntries(ids.map((id) => [id, vazio()])));
        setEditados({});
        setPrevias({});
        setLeiturasFoto({});
        setVisto(null);
        setChaveVisto((k) => k + 1);
        setObservacao("");
        ids.forEach((id) => calcularMaquina(id));
      })
      .catch((error) => setErro(error.response?.data?.error || "Erro ao carregar a loja"))
      .finally(() => setCarregandoLoja(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaId]);

  const alternarMaquina = (id) => {
    if (selecionadas.includes(id)) {
      setSelecionadas(selecionadas.filter((m) => m !== id));
      return;
    }
    if (!valores[id]) {
      setValores((v) => ({ ...v, [id]: vazio() }));
      calcularMaquina(id);
    }
    setSelecionadas([...selecionadas, id]);
  };

  const alterar = (maquinaId, campo, valor) => {
    setValores((atual) => ({ ...atual, [maquinaId]: { ...atual[maquinaId], [campo]: valor } }));
    setEditados((atual) => ({ ...atual, [maquinaId]: { ...(atual[maquinaId] || {}), [campo]: true } }));
  };

  // Relógios digitados: recalcula caiu e dinheiro ao sair do campo
  const recalcularContadores = (maquinaId) => {
    const linha = valores[maquinaId];
    if (linha?.contadorIn !== "" && linha?.contadorOut !== "") {
      calcularMaquina(maquinaId, { contadorIn: linha.contadorIn, contadorOut: linha.contadorOut });
    }
  };

  const fotografar = (maquinaId) => {
    fotoMaquinaRef.current = maquinaId;
    fotoRef.current?.click();
  };

  const lerFoto = async (event) => {
    const arquivos = Array.from(event.target.files || []).slice(0, 3);
    event.target.value = "";
    const maquinaId = fotoMaquinaRef.current;
    if (!arquivos.length || !maquinaId) return;
    setLendoFoto(maquinaId);
    setErro("");
    try {
      const fotos = await Promise.all(arquivos.map(comprimirFoto));
      const { data: leitura } = await api.post("/conferencias/leitura-foto", {
        maquinaId,
        fotos: fotos.map(({ base64, mediaType }) => ({ base64, mediaType })),
      });
      const contadorIn = leitura.contadorIn ?? "";
      const contadorOut = leitura.contadorOut ?? "";
      setValores((atual) => ({
        ...atual,
        [maquinaId]: {
          ...atual[maquinaId],
          contadorIn: String(contadorIn),
          contadorOut: String(contadorOut),
        },
      }));
      setLeiturasFoto((atual) => ({
        ...atual,
        [maquinaId]: {
          contadorIn: leitura.contadorIn,
          contadorOut: leitura.contadorOut,
          confianca: leitura.confianca,
          observacao: leitura.observacao,
          avisos: leitura.avisos,
          lidoEm: new Date().toISOString(),
        },
      }));
      if (contadorIn !== "" && contadorOut !== "") {
        await calcularMaquina(maquinaId, { contadorIn, contadorOut });
      }
    } catch (error) {
      setErro(error.response?.data?.error || "Não foi possível ler a foto. Digite os relógios.");
    } finally {
      setLendoFoto(null);
    }
  };

  const maquinasSelecionadas = useMemo(
    () => (dados?.maquinas || []).filter((m) => selecionadas.includes(m.id)),
    [dados, selecionadas],
  );

  const totalMaquina = (id) => CAMPOS_VALOR.reduce((s, c) => s + num(valores[id]?.[c]), 0);
  const valorBruto = maquinasSelecionadas.reduce((s, m) => s + totalMaquina(m.id), 0);
  const valorComissao = Math.round(valorBruto * num(percentual)) / 100;
  const valorLiquido = valorBruto - valorComissao;

  const salvar = async () => {
    setErro("");
    if (!lojaId) return setErro("Escolha o cliente (loja).");
    if (!maquinasSelecionadas.length) return setErro("Escolha pelo menos uma máquina.");
    setSalvando(true);
    try {
      const itens = maquinasSelecionadas.map((m) => {
        const linha = valores[m.id] || vazio();
        const lida = leiturasFoto[m.id];
        return {
          maquinaId: m.id,
          ...Object.fromEntries(CAMPOS_VALOR.map((c) => [c, num(linha[c])])),
          caiu: linha.caiu === "" ? 0 : Math.trunc(num(linha.caiu)),
          contadorIn: linha.contadorIn === "" ? null : Math.trunc(num(linha.contadorIn)),
          contadorOut: linha.contadorOut === "" ? null : Math.trunc(num(linha.contadorOut)),
          leituraFoto: lida
            ? {
                ...lida,
                corrigido:
                  String(lida.contadorIn ?? "") !== String(linha.contadorIn) ||
                  String(lida.contadorOut ?? "") !== String(linha.contadorOut),
              }
            : null,
        };
      });
      const { data: arrecadacao } = await api.post("/arrecadacoes", {
        lojaId,
        roteiroId,
        data,
        itens,
        observacao,
        percentualComissao: isAdmin ? num(percentual) : undefined,
        recebedorNome,
        recebedorWhatsapp,
        recebedorVisto: visto,
      });
      setSalvo(arrecadacao);
      setAviso("Arrecadação salva! Envie a via do cliente pelo WhatsApp ou baixe o PDF.");
      carregarHistorico();
      setTimeout(() => document.getElementById("via-cliente")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (error) {
      setErro(error.response?.data?.error || "Erro ao salvar a arrecadação.");
    } finally {
      setSalvando(false);
    }
  };

  const novaArrecadacao = () => {
    const id = lojaId;
    setLojaId("");
    setSalvo(null);
    setAviso("");
    setTimeout(() => setLojaId(id), 0);
  };

  const compartilhar = async (a) => {
    try {
      const ok = await compartilharPdfVia(a);
      if (!ok) setAviso("Este navegador não compartilha arquivos: use Baixar PDF.");
    } catch {
      // compartilhamento cancelado
    }
  };

  const abrirHistorico = async (id, acao) => {
    try {
      const { data: a } = await api.get(`/arrecadacoes/${id}`);
      if (acao === "pdf") await baixarPdfVia(a);
      if (acao === "whatsapp") window.open(linkWhatsappVia(a, a.recebedorWhatsapp), "_blank");
    } catch {
      setErro("Não foi possível abrir essa arrecadação.");
    }
  };

  const nomeLoja = dados?.loja?.nome || lojas.find((l) => l.id === lojaId)?.nome || "";
  const travado = Boolean(salvo);
  const celula = "border border-gray-300";
  const entrada =
    "w-full min-w-[96px] px-2 py-2 text-right bg-transparent outline-none focus:bg-yellow-50 disabled:text-gray-500";

  // Via do cliente (antes de salvar mostra os valores atuais)
  const via = salvo || {
    loja: { nome: nomeLoja },
    data,
    valorBruto,
    percentualComissao: num(percentual),
    valorComissao,
    valorLiquido,
    recebedorNome,
    recebedorVisto: visto,
    observacao,
  };

  return (
    <div className="min-h-screen bg-background-light">
      <Navbar />
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6">
        <MovimentacoesAbas />
        {erro && <AlertBox type="error" message={erro} onClose={() => setErro("")} />}
        {aviso && <AlertBox type="success" message={aviso} onClose={() => setAviso("")} />}

        <input ref={fotoRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={lerFoto} />

        {/* ===== Via da empresa (o papel) ===== */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-300 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr]">
            <div className="flex flex-col items-center justify-center p-3 border-b md:border-b-0 md:border-r border-gray-300">
              <img src="/CamaleaoDiversoesLogo.png" alt="Camaleão Diversões" className="w-32 h-32 object-contain" />
            </div>
            <div>
              <div className="bg-gray-200 text-center py-3 font-bold text-primary-dark text-lg border-b border-gray-300">
                Controle de Arrecadação
              </div>
              <div className="p-3 border-b border-gray-300">
                <label className="text-xs font-bold text-gray-600">Cliente</label>
                <select
                  className="w-full mt-1 text-lg font-semibold bg-transparent outline-none border-b-2 border-primary/30 focus:border-primary py-1"
                  value={lojaId}
                  onChange={(e) => setLojaId(e.target.value)}
                  disabled={travado}
                >
                  <option value="">Escolha a loja...</option>
                  {lojas.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2">
                <div className="p-3 border-r border-gray-300">
                  <label className="text-xs font-bold text-gray-600">Data</label>
                  <input
                    type="date"
                    className="w-full mt-1 bg-transparent outline-none font-semibold"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    disabled={travado}
                  />
                </div>
                <div className="p-3">
                  <label className="text-xs font-bold text-gray-600">Responsável</label>
                  <p className="mt-1 font-semibold">{usuario?.nome}</p>
                </div>
              </div>
            </div>
          </div>

          {carregandoLoja && <p className="p-4 text-gray-500">Carregando máquinas da loja...</p>}

          {dados && !carregandoLoja && (
            <>
              {/* Máquinas */}
              <div className="p-3 border-t border-gray-300 bg-gray-50">
                <p className="text-xs font-bold text-gray-600 mb-2">Máquinas desta coleta</p>
                {dados.maquinas.length === 0 && (
                  <p className="text-sm text-gray-500">Nenhuma máquina ativa nesta loja.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {dados.maquinas.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={travado}
                      onClick={() => alternarMaquina(m.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 ${
                        selecionadas.includes(m.id)
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-600 border-gray-300"
                      }`}
                    >
                      {selecionadas.includes(m.id) ? "✓ " : ""}
                      {m.nome}
                      {m.machinePay ? " 📡" : ""}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabela do papel: uma coluna por máquina */}
              {maquinasSelecionadas.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className={`${celula} bg-gray-200 px-3 py-2 sticky left-0 z-10 w-32`}>DESCRIÇÃO</th>
                        {maquinasSelecionadas.map((m) => (
                          <th key={m.id} className={`${celula} bg-gray-200 px-2 py-2 align-top`}>
                            <div className="font-bold uppercase">{m.nome}</div>
                            {!travado && (
                              <button
                                type="button"
                                onClick={() => fotografar(m.id)}
                                disabled={lendoFoto === m.id}
                                className="mt-1 text-xs font-semibold px-2 py-1 rounded-md bg-primary text-white disabled:opacity-60"
                              >
                                {lendoFoto === m.id ? "Lendo..." : "📷 Foto do relógio"}
                              </button>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {LINHAS_VALOR.map(({ campo, rotulo }) => (
                        <tr key={campo}>
                          <td className={`${celula} bg-gray-100 text-center font-semibold text-xs sticky left-0 z-10`}>{rotulo}</td>
                          {maquinasSelecionadas.map((m) => {
                            const auto = !editados[m.id]?.[campo] && valores[m.id]?.[campo] !== "";
                            return (
                              <td key={m.id} className={`${celula} ${auto ? "bg-blue-50" : ""}`}>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  min="0"
                                  placeholder="R$ 0,00"
                                  className={entrada}
                                  value={valores[m.id]?.[campo] ?? ""}
                                  onChange={(e) => alterar(m.id, campo, e.target.value)}
                                  disabled={travado}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr>
                        <td className={`${celula} bg-gray-100 text-center font-semibold text-xs sticky left-0 z-10`}>CAIU</td>
                        {maquinasSelecionadas.map((m) => (
                          <td key={m.id} className={`${celula} ${!editados[m.id]?.caiu && valores[m.id]?.caiu !== "" ? "bg-blue-50" : ""}`}>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              placeholder="prêmios"
                              className={entrada}
                              value={valores[m.id]?.caiu ?? ""}
                              onChange={(e) => alterar(m.id, "caiu", e.target.value)}
                              disabled={travado}
                            />
                          </td>
                        ))}
                      </tr>
                      {[
                        ["contadorIn", "RELÓGIO IN"],
                        ["contadorOut", "RELÓGIO OUT"],
                      ].map(([campo, rotulo]) => (
                        <tr key={campo}>
                          <td className={`${celula} bg-gray-100 text-center font-semibold text-xs sticky left-0 z-10`}>{rotulo}</td>
                          {maquinasSelecionadas.map((m) => (
                            <td key={m.id} className={celula}>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                placeholder={
                                  m.ultimaLeitura
                                    ? `ant. ${campo === "contadorIn" ? m.ultimaLeitura.contadorIn : m.ultimaLeitura.contadorOut}`
                                    : "—"
                                }
                                className={entrada}
                                value={valores[m.id]?.[campo] ?? ""}
                                onChange={(e) =>
                                  setValores((a) => ({ ...a, [m.id]: { ...a[m.id], [campo]: e.target.value } }))
                                }
                                onBlur={() => recalcularContadores(m.id)}
                                disabled={travado}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr>
                        <td className={`${celula} bg-gray-200 text-center font-bold sticky left-0 z-10`}>TOTAL</td>
                        {maquinasSelecionadas.map((m) => (
                          <td key={m.id} className={`${celula} bg-accent-cream/60 text-right px-2 py-2 font-extrabold text-primary-dark`}>
                            {reais(totalMaquina(m.id))}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className={`${celula} bg-gray-50 text-center text-xs text-gray-500 sticky left-0 z-10`}>conferência</td>
                        {maquinasSelecionadas.map((m) => {
                          const p = previas[m.id] || {};
                          const nivel = p.conferencia?.status === "CONFERIDA" ? p.conferencia.nivel : null;
                          return (
                            <td key={m.id} className={`${celula} px-2 py-1 text-xs align-top`}>
                              {p.carregando && <span className="text-gray-500">calculando...</span>}
                              {!p.carregando && p.machinePay?.sucesso && (
                                <div className="text-gray-600">📡 digital {reais(p.machinePay.total)}</div>
                              )}
                              {!p.carregando && p.machinePay && !p.machinePay.sucesso && (
                                <div className="text-yellow-800">📡 {p.machinePay.erro}</div>
                              )}
                              {nivel && (
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full font-bold ${ROTULO_CONFERENCIA[nivel].classe}`}>
                                  {ROTULO_CONFERENCIA[nivel].texto}
                                </span>
                              )}
                              {p.conferencia?.alertas?.map((a, i) => (
                                <div key={i} className={a.nivel === "URGENTE" ? "text-red-700" : "text-yellow-800"}>
                                  {a.mensagem}
                                </div>
                              ))}
                              {leiturasFoto[m.id] && (
                                <div className="text-gray-500">
                                  📷 confiança {leiturasFoto[m.id].confianca}
                                  {leiturasFoto[m.id].avisos?.map((a, i) => (
                                    <div key={i} className="text-red-700">{a}</div>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                  <p className="px-3 py-2 text-xs text-gray-500">
                    Campos em azul foram preenchidos sozinhos (Machine Pay e relógio) — toque para corrigir.
                  </p>
                </div>
              )}

              {/* Observação */}
              <div className="p-3 border-t border-gray-300">
                <label className="text-xs font-bold text-gray-600">Observação:</label>
                <textarea
                  rows={3}
                  className="w-full mt-1 p-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  disabled={travado}
                />
              </div>

              {/* Bruto, comissão e líquido */}
              <div className="p-3 border-t border-gray-300 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="grid grid-cols-[120px_1fr] border border-gray-300">
                    <span className="bg-gray-200 px-3 py-2 text-sm font-bold">Valor Bruto</span>
                    <span className="px-3 py-2 font-extrabold text-lg">{reais(valorBruto)}</span>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] border border-gray-300">
                    <span className="bg-gray-200 px-3 py-2 text-sm font-bold">Valor Líquido</span>
                    <span className="px-3 py-2 font-extrabold text-lg text-primary-dark">{reais(valorLiquido)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_1fr] border border-gray-300">
                    <span className="px-3 py-2 flex items-center gap-1 border-r border-gray-300">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={percentual}
                        onChange={(e) => setPercentual(e.target.value)}
                        disabled={!isAdmin || travado}
                        title={isAdmin ? "Comissão do ponto" : "Comissão cadastrada na loja"}
                        className="w-16 text-right font-bold bg-transparent outline-none disabled:text-gray-800"
                      />
                      <b>%</b>
                    </span>
                    <span className="px-3 py-2 font-bold">{reais(valorComissao)}</span>
                  </div>
                  <p className="text-center font-bold text-gray-700 pt-1">Eu conferi,</p>
                </div>
              </div>

              <div className="p-3 border-t border-gray-300 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-700">Nome:</label>
                  <input
                    className="w-full mt-1 border-b-2 border-gray-400 outline-none focus:border-primary py-2 bg-transparent"
                    placeholder="Quem conferiu no ponto"
                    value={recebedorNome}
                    onChange={(e) => setRecebedorNome(e.target.value)}
                    disabled={travado}
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700">Visto:</label>
                  {travado ? (
                    visto ? <img src={visto} alt="Visto" className="h-24 mt-1" /> : <p className="text-gray-400">sem visto</p>
                  ) : (
                    <AssinaturaPad key={chaveVisto} valor={visto} onChange={setVisto} altura={110} />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ===== Via do cliente ===== */}
        {dados && (
          <>
            <div className="my-6 flex items-center gap-3 text-gray-400 text-sm">
              <span className="flex-1 border-t-2 border-dashed border-gray-300" />✂️ via do cliente
              <span className="flex-1 border-t-2 border-dashed border-gray-300" />
            </div>

            <div id="via-cliente" className="bg-white rounded-2xl shadow-lg border-2 border-gray-300 overflow-hidden">
              <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[160px_1fr]">
                <div className="flex items-center justify-center p-2 border-r border-gray-300">
                  <img src="/CamaleaoDiversoesLogo.png" alt="Camaleão Diversões" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" />
                </div>
                <div>
                  <div className="bg-gray-200 text-center py-2 font-bold text-primary-dark">Controle de Arrecadação</div>
                  <div className="px-3 py-2 border-b border-gray-300">
                    <span className="text-xs font-bold text-gray-600">Cliente: </span>
                    <span className="font-semibold">{via.loja?.nome}</span>
                  </div>
                  <div className="px-3 py-2">
                    <span className="text-xs font-bold text-gray-600">Data: </span>
                    <span className="font-semibold">{dataBR(via.data)}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 border-t border-gray-300 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="grid grid-cols-[110px_1fr] border border-gray-300">
                  <span className="bg-gray-200 px-2 py-2 font-bold">Valor Bruto</span>
                  <span className="px-2 py-2 font-bold">{reais(via.valorBruto)}</span>
                </div>
                <div className="grid grid-cols-2 border border-gray-300">
                  <span className="px-2 py-2 border-r border-gray-300 font-bold">
                    {Number(via.percentualComissao || 0).toLocaleString("pt-BR")} %
                  </span>
                  <span className="px-2 py-2 font-bold">{reais(via.valorComissao)}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] border border-gray-300">
                  <span className="bg-gray-200 px-2 py-2 font-bold">Valor Líquido</span>
                  <span className="px-2 py-2 font-extrabold text-primary-dark">{reais(via.valorLiquido)}</span>
                </div>
                <p className="flex items-center justify-center font-bold text-gray-700">Eu conferi,</p>
              </div>
              <div className="px-3 pb-3 grid grid-cols-2 gap-3 text-sm">
                <p>
                  <b>Nome:</b> {via.recebedorNome || "________________"}
                </p>
                <div className="flex items-end gap-2">
                  <b>Visto:</b>
                  {via.recebedorVisto ? (
                    <img src={via.recebedorVisto} alt="Visto" className="h-12" />
                  ) : (
                    <span>________________</span>
                  )}
                </div>
              </div>
              <div className="mx-3 mb-3 p-2 border border-gray-300 rounded text-sm min-h-[48px]">
                <b className="text-xs text-gray-600">Observação:</b> {via.observacao}
              </div>

              {/* Envio */}
              <div className="p-3 border-t-2 border-accent-yellow bg-accent-cream/40 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-gray-700">WhatsApp de quem conferiu</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      className="input-field mt-1"
                      placeholder="(11) 99999-9999"
                      value={recebedorWhatsapp}
                      onChange={(e) => setRecebedorWhatsapp(e.target.value)}
                    />
                  </div>
                  {!salvo && (
                    <button type="button" onClick={salvar} disabled={salvando || !maquinasSelecionadas.length} className="btn-primary disabled:opacity-50">
                      {salvando ? "Salvando..." : "💾 Salvar arrecadação"}
                    </button>
                  )}
                </div>
                {salvo ? (
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={linkWhatsappVia(salvo, recebedorWhatsapp)}
                      target="_blank"
                      rel="noreferrer"
                      className={`px-4 py-2.5 rounded-xl font-bold text-white bg-[#25D366] hover:brightness-95 ${
                        recebedorWhatsapp.replace(/\D/g, "").length < 10 ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      📲 Enviar no WhatsApp
                    </a>
                    <button type="button" onClick={() => baixarPdfVia(salvo)} className="btn-secondary">
                      📄 Baixar PDF
                    </button>
                    <button type="button" onClick={() => compartilhar(salvo)} className="btn-secondary">
                      📤 Compartilhar PDF
                    </button>
                    <button type="button" onClick={novaArrecadacao} className="px-4 py-2.5 rounded-xl font-bold text-primary">
                      ➕ Nova arrecadação
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">
                    Salve para enviar a via do cliente no WhatsApp ou gerar o PDF.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Últimas arrecadações */}
        {historico.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-800 mb-3">Últimas arrecadações</h2>
            <div className="space-y-2">
              {historico.map((a) => (
                <div key={a.id} className="card flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-bold">{a.loja?.nome}</p>
                    <p className="text-xs text-gray-600">
                      {dataBR(a.data)} · {a.itens?.length || 0} máquina(s) · {a.responsavelNome} · líquido {reais(a.valorLiquido)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => abrirHistorico(a.id, "pdf")} className="text-sm font-semibold text-primary">
                      📄 PDF
                    </button>
                    {a.recebedorWhatsapp && (
                      <button type="button" onClick={() => abrirHistorico(a.id, "whatsapp")} className="text-sm font-semibold text-green-700">
                        📲 WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default Arrecadacao;

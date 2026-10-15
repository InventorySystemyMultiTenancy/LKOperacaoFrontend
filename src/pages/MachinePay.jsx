import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox, Modal, PageHeader } from "../components/UIComponents";
import { LoadingSpinner } from "../components/Loading";
import { HorarioFuncionamentoEditor } from "../components/HorarioFuncionamento";
import {
  editorParaHorario,
  horarioParaEditor,
  resumoHorario,
} from "../utils/horarioFuncionamento";
import {
  enviarWhatsapp,
  montarTextoWhatsapp,
  reservarAbaWhatsapp,
} from "../utils/whatsappManutencao";
import { useAuth } from "../contexts/AuthContext";
import Swal from "sweetalert2";

// ---------------------------------------------------------------------------
// Constantes e formatação
// ---------------------------------------------------------------------------

const FUSO = "America/Sao_Paulo";
const TAMANHO_PAGINA = 50;
const ATUALIZAR_A_CADA_MS = 60 * 1000;

const SINAL_INFO = {
  OTIMO: { label: "Ótimo", className: "bg-green-100 text-green-800 border-green-300", cor: "#22c55e" },
  BOM: { label: "Bom", className: "bg-lime-100 text-lime-800 border-lime-300", cor: "#84cc16" },
  FRACO: { label: "Fraco", className: "bg-orange-100 text-orange-800 border-orange-300", cor: "#f97316" },
  RUIM: { label: "Ruim", className: "bg-red-100 text-red-800 border-red-300", cor: "#ef4444" },
  SEM_SINAL: { label: "Não informado", className: "bg-gray-100 text-gray-600 border-gray-300", cor: "#9ca3af" },
};

const TIPOS_LEITOR = ["WEBSOCKET", "MQTT LITE", "MQTT Avançada"];

const MODO_RESPOSTA = {
  MQTT_INSTANTANEO: "MQTT Instantâneo",
  MQTT_CONFIRMADO: "MQTT Confirmado",
  SEM_RESPOSTA: "Sem resposta",
};

const TIPO_EVENTO = {
  QUEDA: { label: "Caiu e voltou", icone: "⚡", className: "bg-orange-100 text-orange-800 border-orange-300" },
  OFFLINE: { label: "Ficou offline", icone: "🔴", className: "bg-red-100 text-red-800 border-red-300" },
  ONLINE: { label: "Voltou online", icone: "🟢", className: "bg-green-100 text-green-800 border-green-300" },
};

const nivelQuedas = (quedas) => {
  if (quedas >= 5) return { label: "Crítico", className: "bg-red-600 text-white" };
  if (quedas >= 3) return { label: "Instável", className: "bg-orange-500 text-white" };
  if (quedas >= 1) return { label: "Atenção", className: "bg-yellow-300 text-yellow-900" };
  return { label: "Estável", className: "bg-green-500 text-white" };
};

const dataBrasil = (data = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(data);

const somarDias = (dataIso, dias) =>
  dataBrasil(new Date(new Date(`${dataIso}T12:00:00Z`).getTime() + dias * 86400000));

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarDataCurta = (dataIso) => {
  if (!dataIso) return "-";
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}${ano !== String(new Date().getFullYear()) ? `/${ano.slice(2)}` : ""}`;
};

const formatarDataHora = (valor) =>
  valor
    ? new Date(valor).toLocaleString("pt-BR", {
        timeZone: FUSO,
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const formatarDuracao = (minutos) => {
  if (minutos === null || minutos === undefined) return "-";
  if (minutos < 1) return "menos de 1 min";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h${minutos % 60 ? ` ${minutos % 60}min` : ""}`;
  const dias = Math.floor(horas / 24);
  return `${dias}d${horas % 24 ? ` ${horas % 24}h` : ""}`;
};

const tempoDesde = (valor) =>
  valor ? formatarDuracao(Math.round((Date.now() - new Date(valor).getTime()) / 60000)) : null;

const textoUltimaVenda = (m) => {
  if (m.ultimaVendaHoje) return `Hoje às ${m.ultimaVendaHoje.hora}`;
  if (m.ultimaVendaOntem) return `Ontem às ${m.ultimaVendaOntem.hora}`;
  if (m.ultimaVendaAnterior)
    return `${m.ultimaVendaAnterior.data} às ${m.ultimaVendaAnterior.hora}`;
  return "Sem registro";
};

const REGIOES = [
  ["CAPITAL", "🏙️ CAPITAL"],
  ["INTERIOR", "🌳 INTERIOR"],
];

const TITULO_STATUS_WHATSAPP = {
  offline: "🔴 *MÁQUINAS OFFLINE AGORA*",
  fechado: "🌙 *PONTO FECHADO AGORA*",
  online: "🟢 *MÁQUINAS ONLINE*",
  todas: "📋 *MÁQUINAS MACHINE PAY*",
};

// Lista do monitor -> mensagem de WhatsApp, separada por capital/interior
const montarTextoListaWhatsapp = (maquinas, status) => {
  const agora = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const porRegiao = Object.fromEntries(REGIOES.map(([regiao]) => [regiao, []]));
  for (const m of maquinas) (porRegiao[m.regiao] || porRegiao.CAPITAL).push(m);

  const linhas = [
    TITULO_STATUS_WHATSAPP[status] || TITULO_STATUS_WHATSAPP.todas,
    `📅 ${agora}`,
    `Total: ${maquinas.length} (Capital ${porRegiao.CAPITAL.length} · Interior ${porRegiao.INTERIOR.length})`,
  ];
  for (const [regiao, titulo] of REGIOES) {
    const lista = porRegiao[regiao];
    if (!lista.length) continue;
    linhas.push("", `*${titulo} (${lista.length})*`);
    lista.forEach((m, indice) => {
      const situacao = m.online ? "🟢 Online" : m.pontoFechado ? "🌙 Ponto fechado" : "🔴 Offline";
      const offlineHa = m.online
        ? null
        : m.offlineDesde
          ? `há ${formatarDuracao(m.offlineHaMinutos)}`
          : "antes do monitoramento";
      linhas.push(
        `${indice + 1}. *${m.nomePonto || "Sem nome"}*`,
        `   ${situacao}${offlineHa ? ` ${offlineHa}` : ""}`,
        `   Última venda: ${textoUltimaVenda(m)}`,
      );
    });
  }
  return linhas.join("\n");
};

const TITULO_STATUS_IMPRESSAO = {
  offline: "Máquinas offline agora",
  fechado: "Ponto fechado agora",
  online: "Máquinas online",
  todas: "Todas as máquinas",
};

const escaparHtml = (valor) =>
  String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Lista do monitor -> página HTML com a mesma tabela da tela, pronta para imprimir
const montarHtmlImpressao = (maquinas, { status, regiao, verValores }) => {
  const mostrarOffline = status === "offline" || status === "fechado";
  const titulo = `${TITULO_STATUS_IMPRESSAO[status] || TITULO_STATUS_IMPRESSAO.todas}${
    regiao === "CAPITAL" ? " · Capital" : regiao === "INTERIOR" ? " · Interior" : ""
  }`;
  const agora = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const linhas = maquinas
    .map((m) => {
      const situacao = m.online ? "Online" : m.pontoFechado ? "Ponto fechado" : "Offline";
      const offlineHa = m.online
        ? "-"
        : m.offlineDesde
          ? `${formatarDuracao(m.offlineHaMinutos)}<br><small>desde ${escaparHtml(formatarDataHora(m.offlineDesde))}</small>`
          : "Antes do monitoramento";
      const vinculo = m.vinculo
        ? ` · ${escaparHtml([m.vinculo.codigo, m.vinculo.lojaNome].filter(Boolean).join(" · "))}`
        : "";
      return `<tr class="${m.online ? "" : m.pontoFechado ? "fechado" : "offline"}">
        <td><b>${escaparHtml(m.nomePonto || "Sem nome")}</b><br><small>Caixa ${escaparHtml(m.posId)}${vinculo}</small></td>
        <td>${situacao}</td>
        <td>${m.regiao === "INTERIOR" ? "Interior" : "Capital"}</td>
        <td>${mostrarOffline ? offlineHa : `${m.quedasHoje}x`}</td>
        <td>${escaparHtml(textoUltimaVenda(m))}</td>
        <td>${escaparHtml((SINAL_INFO[m.sinalWifi] || SINAL_INFO.SEM_SINAL).label)}</td>
        <td>${escaparHtml(m.tipoVersao || "?")} v${escaparHtml(m.versao)}<br><small>${escaparHtml(MODO_RESPOSTA[m.modoResposta] || "")}</small></td>
        <td>${escaparHtml(m.ip || "-")}</td>
        <td class="num">${verValores ? `${formatarMoeda(m.vendasHojeValor)}<br><small>${m.vendasHojeQtd} vendas</small>` : `${m.vendasHojeQtd} vendas`}</td>
      </tr>`;
    })
    .join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escaparHtml(titulo)}</title>
<style>
  body { font-family: Arial, sans-serif; color: #111; margin: 16px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { margin: 0 0 12px; font-size: 12px; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; text-transform: uppercase; font-size: 10px; color: #555; background: #f3f4f6; }
  th, td { border-bottom: 1px solid #ddd; padding: 5px 6px; vertical-align: top; }
  small { color: #666; }
  .num { text-align: right; }
  tr.offline td { background: #fef2f2; }
  tr.fechado td { background: #f8fafc; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: landscape; margin: 10mm; }
</style></head><body>
<h1>${escaparHtml(titulo)}</h1>
<p>${maquinas.length} máquina${maquinas.length === 1 ? "" : "s"} · gerado em ${agora}</p>
<table><thead><tr>
  <th>Ponto / Caixa</th><th>Status</th><th>Região</th><th>${mostrarOffline ? "Offline há" : "Quedas hoje"}</th>
  <th>Última venda</th><th>Sinal</th><th>Versão</th><th>IP</th><th class="num">Vendas hoje</th>
</tr></thead><tbody>${linhas}</tbody></table>
</body></html>`;
};

const mensagemErro = (error, padrao) =>
  error?.response?.data?.error || error?.message || padrao;

// GET com cancelamento: refaz a consulta quando url/params mudam. "loading" é
// derivado (última resposta não corresponde à consulta atual), sem setState no efeito.
function useConsulta(url, params) {
  const chave = url ? `${url}?${JSON.stringify(params)}` : null;
  const [estado, setEstado] = useState({ chave: null, dados: null, erro: "" });

  useEffect(() => {
    if (!chave) return undefined;
    let cancelado = false;
    api
      .get(url, { params })
      .then((res) => !cancelado && setEstado({ chave, dados: res.data, erro: "" }))
      .catch(
        (error) =>
          !cancelado &&
          setEstado((anterior) => ({
            chave,
            dados: anterior.dados,
            erro: mensagemErro(error, "Erro ao carregar dados"),
          })),
      );
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- url e params já estão em "chave"
  }, [chave]);

  return {
    dados: estado.dados,
    erro: estado.erro,
    loading: Boolean(chave) && estado.chave !== chave,
  };
}

// Página atual que volta para 1 sempre que "chaveFiltros" muda.
function usePagina(chaveFiltros) {
  const [estado, setEstado] = useState({ chave: chaveFiltros, page: 1 });
  const page = estado.chave === chaveFiltros ? estado.page : 1;
  const setPage = (novaPagina) => setEstado({ chave: chaveFiltros, page: novaPagina });
  return [page, setPage];
}

// Sem "machinePay.valores" o servidor nem envia os campos em R$.
function usePermissoesMachinePay() {
  const { usuario, pode } = useAuth();
  const isAdmin = usuario?.role === "ADMIN";
  const adminOuFinanceiro = isAdmin || usuario?.role === "FINANCEIRO";
  return {
    isAdmin,
    verValores: pode("machinePay.valores", adminOuFinanceiro),
    podeExtrato: pode("machinePay.extrato", adminOuFinanceiro),
    podeCredito: pode("machinePay.creditoRemoto", isAdmin),
    podeDevolver: pode("machinePay.devolucao", isAdmin),
    podeHorario: pode("machinePay.horario", isAdmin),
  };
}

// ---------------------------------------------------------------------------
// Componentes pequenos
// ---------------------------------------------------------------------------

function Pill({ className = "", children, title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function StatusPill({ online, pontoFechado }) {
  if (!online && pontoFechado) {
    return (
      <Pill
        className="border-slate-300 bg-slate-100 text-slate-700"
        title="Offline fora do horário de funcionamento cadastrado na máquina"
      >
        🌙 Ponto fechado
      </Pill>
    );
  }
  return online ? (
    <Pill className="border-green-300 bg-green-100 text-green-800">🟢 Online</Pill>
  ) : (
    <Pill className="border-red-300 bg-red-100 text-red-800">🔴 Offline</Pill>
  );
}

function SinalPill({ sinal }) {
  const info = SINAL_INFO[sinal] || SINAL_INFO.SEM_SINAL;
  return <Pill className={info.className}>📶 {info.label}</Pill>;
}

function QuedasPill({ quedas }) {
  const nivel = nivelQuedas(quedas);
  return (
    <span
      title={`${nivel.label}: caiu ${quedas}x`}
      className={`inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-0.5 text-sm font-bold ${nivel.className}`}
    >
      {quedas}x
    </span>
  );
}

function KpiCard({ titulo, valor, detalhe, icone, cor, onClick, ativo }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition-all ${
        onClick ? "hover:-translate-y-0.5 hover:shadow-md" : "cursor-default"
      } ${ativo ? "border-[#2457B1] ring-2 ring-[#2457B1]/30" : "border-gray-100"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</p>
        <span className="text-xl">{icone}</span>
      </div>
      <p className={`mt-1 break-words text-2xl font-extrabold sm:text-3xl ${cor || "text-gray-900"}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-gray-500">{detalhe}</p>}
    </button>
  );
}

function Secao({ titulo, descricao, children, acao }) {
  return (
    <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{titulo}</h2>
          {descricao && <p className="text-sm text-gray-500">{descricao}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Vazio({ icone = "📭", mensagem }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
      <div className="mb-2 text-4xl">{icone}</div>
      <p className="font-medium text-gray-600">{mensagem}</p>
    </div>
  );
}

function Paginacao({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <button
        className="btn-secondary px-3 py-1 text-sm disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ← Anterior
      </button>
      <span className="text-sm text-gray-600">
        Página {page} de {totalPages}
      </span>
      <button
        className="btn-secondary px-3 py-1 text-sm disabled:opacity-40"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Próxima →
      </button>
    </div>
  );
}

function NomePonto({ maquina, onAbrir }) {
  return (
    <button type="button" onClick={onAbrir} className="text-left hover:underline">
      <span className="block font-semibold text-gray-900">{maquina.nomePonto || "Sem nome"}</span>
      <span className="block text-xs text-gray-500">
        Caixa {maquina.posId}
        {maquina.vinculo && (
          <>
            {" · "}
            <span className="text-[#2457B1]">
              {maquina.vinculo.codigo}
              {maquina.vinculo.lojaNome ? ` · ${maquina.vinculo.lojaNome}` : ""}
            </span>
          </>
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Aba: Máquinas (offline por padrão)
// ---------------------------------------------------------------------------

function AbaMaquinas({
  filtrosQuery,
  onAbrirMaquina,
  status,
  setStatus,
  comQueda,
  setComQueda,
  regiao,
  setRegiao,
}) {
  const [ordenar, setOrdenar] = useState("");
  const [page, setPage] = usePagina(JSON.stringify([filtrosQuery, status, comQueda, ordenar, regiao]));
  const { dados, loading, erro } = useConsulta("/machine-pay/monitor/maquinas", {
    ...filtrosQuery,
    regiao: regiao || undefined,
    status,
    comQueda: comQueda ? "true" : undefined,
    ordenar: ordenar || undefined,
    page,
    limit: TAMANHO_PAGINA,
  });

  const maquinas = dados?.maquinas || [];
  const { verValores } = usePermissoesMachinePay();
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false);
  const [erroWhatsapp, setErroWhatsapp] = useState("");

  const [imprimindo, setImprimindo] = useState(false);

  // Lista inteira do filtro atual (todas as páginas), não só a página aberta
  const buscarListaCompleta = async () => {
    const res = await api.get("/machine-pay/monitor/maquinas", {
      params: {
        ...filtrosQuery,
        regiao: regiao || undefined,
        status,
        comQueda: comQueda ? "true" : undefined,
        ordenar: ordenar || undefined,
        page: 1,
        limit: 500,
      },
    });
    return res.data?.maquinas || [];
  };

  const enviarListaWhatsapp = async () => {
    const aba = reservarAbaWhatsapp();
    setEnviandoWhatsapp(true);
    setErroWhatsapp("");
    try {
      enviarWhatsapp(montarTextoListaWhatsapp(await buscarListaCompleta(), status), aba);
    } catch (error) {
      aba?.close();
      setErroWhatsapp(mensagemErro(error, "Erro ao montar a lista para o WhatsApp"));
    } finally {
      setEnviandoWhatsapp(false);
    }
  };

  const imprimirLista = async () => {
    // A janela abre já no clique para o navegador não bloquear
    const janela = window.open("", "_blank");
    if (!janela) {
      setErroWhatsapp("O navegador bloqueou a janela de impressão. Libere pop-ups para este site.");
      return;
    }
    janela.document.write("<p style='font-family:Arial'>Montando a lista...</p>");
    setImprimindo(true);
    setErroWhatsapp("");
    try {
      const html = montarHtmlImpressao(await buscarListaCompleta(), { status, regiao, verValores });
      janela.document.open();
      janela.document.write(html);
      janela.document.close();
      janela.focus();
      setTimeout(() => janela.print(), 300);
    } catch (error) {
      janela.close();
      setErroWhatsapp(mensagemErro(error, "Erro ao montar a lista para impressão"));
    } finally {
      setImprimindo(false);
    }
  };

  return (
    <Secao
      titulo={
        status === "offline"
          ? "🔴 Máquinas offline agora"
          : status === "fechado"
            ? "🌙 Ponto fechado agora"
            : status === "online"
            ? "🟢 Máquinas online"
            : "📋 Todas as máquinas"
      }
      descricao={
        status === "offline"
          ? "Só as que estão fora do ar dentro do horário de funcionamento. As que estão offline há mais tempo aparecem primeiro."
          : status === "fechado"
            ? "Offline, mas fora do horário de funcionamento cadastrado na máquina — o ponto está fechado."
            : "Clique no nome do ponto para ver o histórico completo da máquina."
      }
      acao={
        <div className="flex flex-wrap gap-2">
          <div className="flex overflow-hidden rounded-lg border border-gray-200">
            {[
              ["offline", "🔴 Offline"],
              ["fechado", "🌙 Ponto fechado"],
              ["online", "🟢 Online"],
              ["todas", "Todas"],
            ].map(([valor, label]) => (
              <button
                key={valor}
                onClick={() => setStatus(valor)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  status === valor ? "bg-[#2457B1] text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
            <input type="checkbox" checked={comQueda} onChange={(e) => setComQueda(e.target.checked)} />
            Só com queda hoje
          </label>
          <select
            className="input-field w-auto py-1.5 text-sm"
            value={regiao}
            onChange={(e) => setRegiao(e.target.value)}
          >
            <option value="">Capital e interior</option>
            <option value="CAPITAL">🏙️ Só capital</option>
            <option value="INTERIOR">🌳 Só interior</option>
          </select>
          <select
            className="input-field w-auto py-1.5 text-sm"
            value={ordenar}
            onChange={(e) => setOrdenar(e.target.value)}
          >
            <option value="">Ordem padrão</option>
            <option value="offline">Offline há mais tempo</option>
            <option value="quedas">Mais quedas hoje</option>
            <option value="sinal">Pior sinal primeiro</option>
            <option value="vendas">Mais vendas hoje</option>
            <option value="nome">Número da loja</option>
          </select>
          <div className="flex basis-full justify-end gap-2">
            <button
              type="button"
              onClick={imprimirLista}
              disabled={imprimindo || !dados?.total}
              title="Imprime a tabela com os filtros atuais (todas as páginas)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              🖨️ {imprimindo ? "Montando..." : "Imprimir"}
            </button>
            <button
              type="button"
              onClick={enviarListaWhatsapp}
              disabled={enviandoWhatsapp || !dados?.total}
              title="Envia a lista com os filtros atuais, separada por capital e interior"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1ebe5b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              💬 {enviandoWhatsapp ? "Montando lista..." : "Enviar para o WhatsApp"}
            </button>
          </div>
        </div>
      }
    >
      {erroWhatsapp && <AlertBox type="error" message={erroWhatsapp} onClose={() => setErroWhatsapp("")} />}
      {erro && <AlertBox type="error" message={erro} />}
      {loading && !dados ? (
        <LoadingSpinner message="Carregando máquinas..." />
      ) : maquinas.length === 0 ? (
        <Vazio
          icone={status === "offline" ? "🎉" : status === "fechado" ? "🌙" : "📭"}
          mensagem={
            status === "offline"
              ? "Nenhuma máquina offline com esses filtros. Tudo no ar!"
              : status === "fechado"
                ? "Nenhum ponto fechado agora com esses filtros."
                : "Nenhuma máquina encontrada com esses filtros."
          }
        />
      ) : (
        <>
          <p className="mb-2 text-sm text-gray-500">
            {dados.total} máquina{dados.total === 1 ? "" : "s"} {loading && "· atualizando..."}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <th className="px-3 py-2">Ponto / Caixa</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Região</th>
                  <th className="px-3 py-2">
                    {status === "offline" || status === "fechado" ? "Offline há" : "Quedas hoje"}
                  </th>
                  <th className="px-3 py-2">Última venda</th>
                  <th className="px-3 py-2">Sinal</th>
                  <th className="px-3 py-2">Versão</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2 text-right">Vendas hoje</th>
                </tr>
              </thead>
              <tbody>
                {maquinas.map((m) => (
                  <tr
                    key={m.posId}
                    className={`border-b align-top hover:bg-gray-50 ${
                      m.online ? "" : m.pontoFechado ? "bg-slate-50" : "bg-red-50/40"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <NomePonto maquina={m} onAbrir={() => onAbrirMaquina(m.posId)} />
                      {m.desativada && (
                        <Pill className="mt-1 border-gray-300 bg-gray-100 text-gray-600">Desativado</Pill>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill online={m.online} pontoFechado={m.pontoFechado} />
                      {m.telemetria && m.telemetria !== "Consultado" && (
                        <span className="mt-1 block text-xs text-gray-500">{m.telemetria}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-gray-700">
                      {m.regiao === "INTERIOR" ? "Interior" : "Capital"}
                    </td>
                    <td className="px-3 py-2">
                      {status === "offline" || status === "fechado" ? (
                        <>
                          <span className={`font-semibold ${m.pontoFechado ? "text-slate-600" : "text-red-700"}`}>
                            {m.offlineDesde
                              ? formatarDuracao(m.offlineHaMinutos)
                              : "Antes do monitoramento"}
                          </span>
                          {m.offlineDesde && (
                            <span className="block text-xs text-gray-500">
                              desde {formatarDataHora(m.offlineDesde)}
                            </span>
                          )}
                          {m.quedasHoje > 0 && (
                            <span className="mt-1 block">
                              <QuedasPill quedas={m.quedasHoje} />
                            </span>
                          )}
                        </>
                      ) : (
                        <QuedasPill quedas={m.quedasHoje} />
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{textoUltimaVenda(m)}</td>
                    <td className="px-3 py-2">
                      <SinalPill sinal={m.sinalWifi} />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      <span className="font-semibold">{m.tipoVersao || "?"}</span> v{m.versao}
                      <span className="block text-gray-500">{MODO_RESPOSTA[m.modoResposta]}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">{m.ip || "-"}</td>
                    <td className="px-3 py-2 text-right">
                      {verValores ? (
                        <>
                          <span className="font-semibold">{formatarMoeda(m.vendasHojeValor)}</span>
                          <span className="block text-xs text-gray-500">{m.vendasHojeQtd} vendas</span>
                        </>
                      ) : (
                        <span className="font-semibold">{m.vendasHojeQtd} vendas</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao page={dados.page} totalPages={dados.totalPages} onChange={setPage} />
        </>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Aba: Ranking de quedas
// ---------------------------------------------------------------------------

function AbaRanking({ filtrosQuery, periodo, onAbrirMaquina }) {
  const [ordem, setOrdem] = useState("pior");
  const [paginasVisiveis, setPaginasVisiveis] = usePagina(JSON.stringify([filtrosQuery, periodo]));
  const mostrar = paginasVisiveis * TAMANHO_PAGINA;
  const { dados, loading, erro } = useConsulta("/machine-pay/monitor/ranking-quedas", {
    ...filtrosQuery,
    dataInicio: periodo.inicio,
    dataFim: periodo.fim,
  });

  const ranking = useMemo(() => {
    const lista = dados?.ranking || [];
    return ordem === "pior" ? lista : [...lista].reverse();
  }, [dados, ordem]);
  const maiorQueda = Math.max(1, ...ranking.map((r) => r.quedas));
  const umDia = periodo.inicio === periodo.fim;

  return (
    <Secao
      titulo="🏆 Ranking de quedas"
      descricao={`Quantas vezes cada máquina caiu ${
        umDia ? `em ${formatarDataCurta(periodo.inicio)}` : `de ${formatarDataCurta(periodo.inicio)} a ${formatarDataCurta(periodo.fim)}`
      }. Empate é desempatado pelo tempo que ficou offline.`}
      acao={
        <div className="flex overflow-hidden rounded-lg border border-gray-200">
          {[
            ["pior", "😟 Pior → melhor"],
            ["melhor", "😄 Melhor → pior"],
          ].map(([valor, label]) => (
            <button
              key={valor}
              onClick={() => setOrdem(valor)}
              className={`px-3 py-1.5 text-sm font-medium ${
                ordem === valor ? "bg-[#2457B1] text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {erro && <AlertBox type="error" message={erro} />}
      {loading && !dados ? (
        <LoadingSpinner message="Montando ranking..." />
      ) : !ranking.length ? (
        <Vazio mensagem="Ainda não há dados de quedas para este período. O histórico começa a ser gravado a partir do dia em que o monitoramento foi ligado." />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard titulo="Total de quedas" valor={dados.totalQuedas} icone="⚡" cor="text-orange-600" />
            <KpiCard titulo="Máquinas que caíram" valor={dados.maquinasComQueda} icone="📉" cor="text-red-600" />
            <KpiCard titulo="Sem nenhuma queda" valor={dados.maquinasSemQueda} icone="✅" cor="text-green-600" />
            <KpiCard titulo="Média por máquina" valor={dados.mediaQuedasPorMaquina} icone="➗" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Ponto / Caixa</th>
                  <th className="px-3 py-2">Quedas</th>
                  {!umDia && <th className="px-3 py-2">Dias com queda</th>}
                  {!umDia && <th className="px-3 py-2">Pior dia</th>}
                  <th className="px-3 py-2">Ficou offline</th>
                  <th className="px-3 py-2">Agora</th>
                </tr>
              </thead>
              <tbody>
                {ranking.slice(0, mostrar).map((r) => (
                  <tr key={r.posId} className="border-b align-top hover:bg-gray-50">
                    <td className="px-3 py-2 font-bold text-gray-500">
                      {r.posicao <= 3 && ordem === "pior" ? ["🥇", "🥈", "🥉"][r.posicao - 1] : `${r.posicao}º`}
                    </td>
                    <td className="px-3 py-2">
                      <NomePonto maquina={r} onAbrir={() => onAbrirMaquina(r.posId)} />
                    </td>
                    <td className="min-w-[180px] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <QuedasPill quedas={r.quedas} />
                        <div className="h-2 flex-1 rounded-full bg-gray-100">
                          <div
                            className={`h-2 rounded-full ${nivelQuedas(umDia ? r.quedas : r.maiorQuedasDia).className.split(" ")[0]}`}
                            style={{ width: `${(r.quedas / maiorQueda) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    {!umDia && (
                      <td className="px-3 py-2">
                        {r.diasComQueda} de {r.diasMonitorados}
                      </td>
                    )}
                    {!umDia && <td className="px-3 py-2">{r.maiorQuedasDia}x</td>}
                    <td className="px-3 py-2">
                      {r.vezesOffline > 0 ? (
                        <>
                          {r.vezesOffline}x
                          <span className="block text-xs text-gray-500">
                            {formatarDuracao(r.minutosOffline)} fora do ar
                          </span>
                        </>
                      ) : r.minutosOffline > 0 ? (
                        <span className="text-xs text-gray-600">{formatarDuracao(r.minutosOffline)} fora do ar</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.online === undefined ? (
                        <span className="text-xs text-gray-400">Removida do painel</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <StatusPill online={r.online} pontoFechado={r.pontoFechado} />
                          <SinalPill sinal={r.sinalWifi} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ranking.length > mostrar && (
            <div className="mt-4 text-center">
              <button className="btn-secondary" onClick={() => setPaginasVisiveis(paginasVisiveis + 1)}>
                Mostrar mais ({ranking.length - mostrar} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Aba: Gráficos
// ---------------------------------------------------------------------------

function AbaGraficos({ filtrosQuery, periodo, resumo }) {
  // Um gráfico de um dia só não diz nada: expande para os 14 dias até a data final.
  const periodoGrafico =
    periodo.inicio === periodo.fim
      ? { inicio: somarDias(periodo.fim, -13), fim: periodo.fim, expandido: true }
      : periodo;

  const { dados, loading, erro } = useConsulta("/machine-pay/monitor/serie-diaria", {
    ...filtrosQuery,
    dataInicio: periodoGrafico.inicio,
    dataFim: periodoGrafico.fim,
  });

  const serie = (dados?.serie || []).map((d) => ({
    ...d,
    dia: formatarDataCurta(d.data),
    horasOffline: Number((d.minutosOffline / 60).toFixed(1)),
  }));
  const quedasPorHora = (resumo?.quedasPorHoraHoje || []).map((q, hora) => ({
    hora: `${String(hora).padStart(2, "0")}h`,
    quedas: q,
  }));
  const sinais = Object.entries(resumo?.porSinal || {})
    .map(([sinal, total]) => ({ sinal, label: SINAL_INFO[sinal]?.label || sinal, total }))
    .sort((a, b) => Object.keys(SINAL_INFO).indexOf(a.sinal) - Object.keys(SINAL_INFO).indexOf(b.sinal));

  return (
    <>
      {erro && <AlertBox type="error" message={erro} />}
      {resumo?.monitor?.inicioHistorico && (
        <AlertBox
          type="info"
          message={`Histórico gravado pelo sistema desde ${formatarDataCurta(
            resumo.monitor.inicioHistorico,
          )}: dias antes disso aparecem vazios. A Machine Pay só mostra o dia atual, então os gráficos vão se completando com o tempo. Horários têm margem de ${
            resumo.monitor.intervaloMinutos
          } min (intervalo entre as leituras do painel).`}
        />
      )}
      <Secao
        titulo="📈 Quedas por dia"
        descricao={`Soma das quedas de todas as máquinas filtradas${
          periodoGrafico.expandido ? " (últimos 14 dias — escolha um período para mudar)" : ""
        }. Dias sem coleta aparecem zerados.`}
      >
        {loading && !dados ? (
          <LoadingSpinner />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="dia" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="quedas" name="Quedas" fill="#f97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="maquinasComQueda" name="Máquinas que caíram" fill="#2457B1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Secao>

      <Secao
        titulo="🔴 Máquinas que ficaram offline por dia"
        descricao="Quantas máquinas passaram algum tempo fora do ar e o total de horas offline somadas."
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={serie}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="dia" fontSize={12} />
            <YAxis yAxisId="esq" allowDecimals={false} fontSize={12} />
            <YAxis yAxisId="dir" orientation="right" fontSize={12} />
            <Tooltip />
            <Legend />
            <Line yAxisId="esq" type="monotone" dataKey="maquinasQueFicaramOffline" name="Máquinas offline" stroke="#ef4444" strokeWidth={2} />
            <Line yAxisId="dir" type="monotone" dataKey="horasOffline" name="Horas offline (soma)" stroke="#a855f7" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Secao>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Secao titulo="⏰ Quedas por hora (hoje)" descricao="Em que horário as máquinas mais caem hoje.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={quedasPorHora}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="hora" fontSize={11} interval={1} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="quedas" name="Quedas" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Secao>
        <Secao titulo="📶 Qualidade do sinal Wi-Fi" descricao="Situação atual das máquinas filtradas.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={sinais} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="label" width={100} fontSize={12} />
              <Tooltip />
              <Bar dataKey="total" name="Máquinas" radius={[0, 4, 4, 0]}>
                {sinais.map((s) => (
                  <Cell key={s.sinal} fill={SINAL_INFO[s.sinal]?.cor || "#9ca3af"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Secao>
      </div>

      <Secao
        titulo="🧩 Por versão do leitor"
        descricao="Ajuda a ver se alguma versão de firmware cai mais que as outras."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="px-3 py-2">Versão</th>
                <th className="px-3 py-2 text-right">Máquinas</th>
                <th className="px-3 py-2 text-right">Offline agora</th>
                <th className="px-3 py-2 text-right">Quedas hoje</th>
                <th className="px-3 py-2 text-right">Quedas por máquina</th>
              </tr>
            </thead>
            <tbody>
              {(resumo?.porVersao || []).map((v) => (
                <tr key={v.versao} className="border-b">
                  <td className="px-3 py-2 font-semibold">{v.versao}</td>
                  <td className="px-3 py-2 text-right">{v.total}</td>
                  <td className="px-3 py-2 text-right text-red-600">{v.offline}</td>
                  <td className="px-3 py-2 text-right text-orange-600">{v.quedas}</td>
                  <td className="px-3 py-2 text-right">{(v.quedas / v.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
    </>
  );
}

// ---------------------------------------------------------------------------
// Aba: Linha do tempo (eventos de conexão)
// ---------------------------------------------------------------------------

function AbaEventos({ filtrosQuery, periodo, onAbrirMaquina }) {
  const [tipo, setTipo] = useState("");
  const [page, setPage] = usePagina(JSON.stringify([filtrosQuery, periodo, tipo]));
  const { dados, loading, erro } = useConsulta("/machine-pay/monitor/eventos", {
    ...filtrosQuery,
    dataInicio: periodo.inicio,
    dataFim: periodo.fim,
    tipo: tipo || undefined,
    page,
    limit: TAMANHO_PAGINA,
  });

  return (
    <Secao
      titulo="🕒 Linha do tempo de conexão"
      descricao="Cada vez que uma máquina caiu, ficou offline ou voltou. Mais recentes primeiro."
      acao={
        <select className="input-field w-auto py-1.5 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos os eventos</option>
          <option value="QUEDA">⚡ Só quedas</option>
          <option value="OFFLINE">🔴 Só quando ficou offline</option>
          <option value="ONLINE">🟢 Só quando voltou</option>
        </select>
      }
    >
      {erro && <AlertBox type="error" message={erro} />}
      {loading && !dados ? (
        <LoadingSpinner />
      ) : !dados?.eventos?.length ? (
        <Vazio mensagem="Nenhum evento neste período." />
      ) : (
        <>
          <p className="mb-2 text-sm text-gray-500">{dados.total} eventos</p>
          <ul className="divide-y">
            {dados.eventos.map((e) => {
              const info = TIPO_EVENTO[e.tipo];
              return (
                <li key={e.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-28 shrink-0 font-mono text-xs text-gray-500">
                    {formatarDataHora(e.dataHora)}
                  </span>
                  <Pill className={info.className}>
                    {info.icone} {info.label}
                  </Pill>
                  <button
                    type="button"
                    onClick={() => onAbrirMaquina(e.posId)}
                    className="text-left font-medium text-gray-900 hover:underline"
                  >
                    {e.nomePonto || `Caixa ${e.posId}`}
                  </button>
                  <span className="text-xs text-gray-500">
                    {e.tipo === "QUEDA" && `contador foi de ${e.quedasAntes}x para ${e.quedasDepois}x`}
                    {e.tipo === "ONLINE" &&
                      (e.duracaoMinutos !== null
                        ? `ficou ${formatarDuracao(e.duracaoMinutos)} fora do ar`
                        : "estava offline antes do monitoramento")}
                  </span>
                </li>
              );
            })}
          </ul>
          <Paginacao page={dados.page} totalPages={dados.totalPages} onChange={setPage} />
        </>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Aba: Como ler esta página
// ---------------------------------------------------------------------------

function AbaAjuda() {
  const itens = [
    ["⚡ Quedas (Nx)", "É o contador que o painel Machine Pay mostra ao lado do botão ON/OFF: quantas vezes o leitor perdeu a conexão e reconectou hoje. Zera à meia-noite."],
    ["🟢 Estável · 🟡 Atenção · 🟠 Instável · 🔴 Crítico", "0 quedas = estável · 1 a 2 = atenção · 3 a 4 = instável · 5 ou mais = crítico (vale ir ao ponto ou trocar o roteador/modem)."],
    ["🔴 Offline", "O leitor não está respondendo ao painel agora. Nesse estado ele não recebe pagamentos PIX ou cartão."],
    ["🌙 Ponto fechado", "O leitor está offline, mas fora do horário de funcionamento cadastrado na máquina (Máquinas → Editar → Horário de funcionamento). Não entra na contagem de offline. Máquinas sem horário cadastrado são tratadas como 24h."],
    ["Offline há…", "Tempo desde que o monitoramento viu a máquina cair. \"Antes do monitoramento\" significa que ela já estava offline quando começamos a acompanhar — use a última venda como referência."],
    ["📶 Sinal Wi-Fi", "Ótimo / Bom / Fraco / Ruim, como informado pelo leitor. \"Não informado\" é normal em leitores WEBSOCKET, que não mandam o sinal."],
    ["MQTT Instantâneo / Confirmado", "Como o leitor recebe o crédito: Instantâneo (WEBSOCKET) ou com confirmação de pulso (MQTT). \"Sem resposta\" = leitor não respondeu a última consulta."],
    ["Desativado", "Pontos com \"DESATIVADO\" no nome ficam escondidos por padrão. Marque \"Incluir desativadas\" nos filtros para vê-los."],
    ["Ranking", "Soma das quedas no período. No empate, quem ficou mais tempo offline fica na frente. Use \"Melhor → pior\" para ver as mais estáveis."],
    ["Histórico", "O painel só mostra o dia de hoje. Este sistema lê o painel automaticamente a cada poucos minutos e guarda o histórico — por isso dias antes do início do monitoramento aparecem vazios."],
    ["Vínculo", "Quando a máquina do sistema tem o \"POS ID Machine Pay\" preenchido no cadastro, o código e a loja dela aparecem junto do ponto, e o filtro por loja passa a funcionar para ela."],
  ];
  return (
    <Secao titulo="❓ Como ler esta página" descricao="Glossário rápido para quem cuida do suporte.">
      <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {itens.map(([termo, explicacao]) => (
          <div key={termo} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <dt className="font-bold text-gray-900">{termo}</dt>
            <dd className="mt-1 text-sm text-gray-600">{explicacao}</dd>
          </div>
        ))}
      </dl>
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Ações na máquina: crédito remoto e extrato com devolução
// ---------------------------------------------------------------------------

const VALORES_RAPIDOS = [1, 2, 5, 10, 20, 50];

function CreditoRemoto({ maquina }) {
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const enviar = async () => {
    const numero = Number(String(valor).replace(",", "."));
    if (!Number.isFinite(numero) || numero < 1) {
      setAviso({ type: "error", message: "Informe um valor de pelo menos R$ 1,00." });
      return;
    }
    const confirmacao = await Swal.fire({
      icon: maquina.online ? "question" : "warning",
      title: `Enviar ${formatarMoeda(numero)}?`,
      html: `Crédito remoto para <b>${maquina.nomePonto || maquina.posId}</b>.${
        maquina.online ? "" : "<br/><br/>⚠️ A máquina está <b>offline</b>: o crédito pode não chegar."
      }`,
      showCancelButton: true,
      confirmButtonText: "Enviar crédito",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#2457B1",
    });
    if (!confirmacao.isConfirmed) return;

    setEnviando(true);
    setAviso(null);
    try {
      const res = await api.post(`/machine-pay/monitor/maquinas/${maquina.posId}/credito`, {
        valor: numero,
      });
      setAviso({ type: res.data.sucesso ? "success" : "warning", message: res.data.mensagem });
      if (res.data.sucesso) setValor("");
    } catch (error) {
      setAviso({ type: "error", message: mensagemErro(error, "Erro ao enviar crédito") });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <h4 className="mb-1 font-bold text-gray-900">🎟️ Enviar crédito remoto</h4>
      <p className="mb-3 text-xs text-gray-500">
        Mesmo envio dos vouchers: o valor cai direto na máquina.
      </p>
      {aviso && <AlertBox type={aviso.type} message={aviso.message} onClose={() => setAviso(null)} />}
      <div className="mb-2 flex flex-wrap gap-2">
        {VALORES_RAPIDOS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setValor(String(v))}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              Number(String(valor).replace(",", ".")) === v
                ? "border-[#2457B1] bg-[#2457B1] text-white"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {formatarMoeda(v)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          inputMode="decimal"
          className="input-field w-40"
          placeholder="Outro valor (R$)"
          value={valor}
          onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, ""))}
        />
        <button type="button" className="btn-primary" onClick={enviar} disabled={enviando || !valor}>
          {enviando ? "Enviando..." : "Enviar crédito"}
        </button>
      </div>
    </div>
  );
}

// Quem não é ADMIN só vê as vendas de hoje e dos últimos dias (o servidor também limita)
const DIAS_VENDAS_NAO_ADMIN = 3;

function ExtratoVendas({ maquina, verValores, podeDevolver, isAdmin }) {
  const hoje = dataBrasil();
  const dataMinima = isAdmin ? undefined : somarDias(hoje, -DIAS_VENDAS_NAO_ADMIN);
  // Abre já com o extrato: 30 dias para o ADMIN (como o painel), últimos dias para os demais
  const periodoPadrao = { inicio: isAdmin ? somarDias(hoje, -29) : dataMinima, fim: hoje };
  const [periodo, setPeriodo] = useState(periodoPadrao);
  const [consulta, setConsulta] = useState({ ...periodoPadrao, versao: 0 });
  const [devolvendo, setDevolvendo] = useState(null);
  const [aviso, setAviso] = useState(null);

  const { dados, loading, erro } = useConsulta(`/machine-pay/monitor/maquinas/${maquina.posId}/vendas`, {
    dataInicio: consulta.inicio,
    dataFim: consulta.fim,
    _v: consulta.versao || undefined,
  });
  const vendas = dados?.vendas || [];

  const buscar = () => setConsulta((c) => ({ ...periodo, versao: c.versao + 1 }));

  const devolver = async (venda) => {
    const confirmacao = await Swal.fire({
      icon: "warning",
      title: "Devolver este pagamento?",
      html: `${venda.tipo} de ${formatarDataHora(venda.data)}${
        verValores && venda.valor !== undefined ? ` — <b>${formatarMoeda(venda.valor)}</b>` : ""
      }<br/>O valor é estornado para quem pagou.`,
      showCancelButton: true,
      confirmButtonText: "Devolver",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmacao.isConfirmed) return;

    setDevolvendo(venda.idwebhook);
    setAviso(null);
    try {
      const res = await api.post(`/machine-pay/monitor/maquinas/${maquina.posId}/devolucao`, {
        idwebhook: venda.idwebhook,
        dataInicio: consulta.inicio,
        dataFim: consulta.fim,
      });
      setAviso({ type: "success", message: res.data.mensagem || "Devolução solicitada na Machine Pay." });
      setConsulta((c) => ({ ...c, versao: c.versao + 1 }));
    } catch (error) {
      setAviso({ type: "error", message: mensagemErro(error, "Erro ao solicitar devolução") });
    } finally {
      setDevolvendo(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <h4 className="mb-1 font-bold text-gray-900">🧾 Extrato de vendas</h4>
      <p className="mb-3 text-xs text-gray-500">
        Pagamentos desta máquina no painel Machine Pay.
        {!isAdmin && ` Você pode consultar até ${DIAS_VENDAS_NAO_ADMIN} dias atrás.`}
      </p>
      <form
        className="mb-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          buscar();
        }}
      >
        <label className="flex flex-col text-xs font-semibold text-gray-600">
          Data inicial
          <input
            type="date"
            className="input-field w-auto py-1.5 text-sm"
            value={periodo.inicio}
            min={dataMinima}
            max={periodo.fim}
            onChange={(e) => e.target.value && setPeriodo((p) => ({ ...p, inicio: e.target.value }))}
          />
        </label>
        <label className="flex flex-col text-xs font-semibold text-gray-600">
          Data final
          <input
            type="date"
            className="input-field w-auto py-1.5 text-sm"
            value={periodo.fim}
            min={periodo.inicio}
            max={hoje}
            onChange={(e) => e.target.value && setPeriodo((p) => ({ ...p, fim: e.target.value }))}
          />
        </label>
        <button type="submit" className="btn-primary px-3 py-2" title="Buscar vendas do período" disabled={loading}>
          🔍
        </button>
      </form>

      {aviso && <AlertBox type={aviso.type} message={aviso.message} onClose={() => setAviso(null)} />}
      {erro && <AlertBox type="error" message={erro} />}
      {loading ? (
        <LoadingSpinner message="Consultando o painel..." />
      ) : vendas.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma venda encontrada neste período.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-gray-500">
            {vendas.length} venda{vendas.length === 1 ? "" : "s"}
            {verValores &&
              ` · ${formatarMoeda(vendas.filter((v) => !v.devolvido).reduce((soma, v) => soma + Number(v.valor || 0), 0))}`}
          </p>
          <div className="max-h-80 overflow-y-auto rounded-lg border">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b text-left text-xs uppercase text-gray-500">
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Método</th>
                  <th className="px-3 py-2">Situação</th>
                  {verValores && <th className="px-3 py-2 text-right">Valor</th>}
                  <th className="px-3 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v, i) => (
                  <tr key={v.idwebhook || i} className={`border-b ${v.devolvido ? "bg-gray-50 text-gray-400" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-2">{formatarDataHora(v.data)}</td>
                    <td className="px-3 py-2">{v.tipo}</td>
                    <td className="px-3 py-2 text-xs">{v.status}</td>
                    {verValores && (
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{formatarMoeda(v.valor)}</td>
                    )}
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {v.devolvido ? (
                        <Pill className="border-gray-300 bg-gray-100 text-gray-600">Devolvido</Pill>
                      ) : podeDevolver && v.podeDevolver ? (
                        <button
                          type="button"
                          className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                          onClick={() => devolver(v)}
                          disabled={Boolean(devolvendo)}
                        >
                          {devolvendo === v.idwebhook ? "Devolvendo..." : "↩️ Devolver"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AcoesMaquina({ maquina, permissoes }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {permissoes.podeCredito && <CreditoRemoto maquina={maquina} />}
      {permissoes.podeExtrato && (
        <div className={permissoes.podeCredito ? "" : "lg:col-span-2"}>
          <ExtratoVendas
            maquina={maquina}
            verValores={permissoes.verValores}
            podeDevolver={permissoes.podeDevolver}
            isAdmin={permissoes.isAdmin}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nova manutenção para a máquina aberta (vai para a aba Manutenções)
// ---------------------------------------------------------------------------

function EditarHorarioMaquina({ maquina, onFechar, onSalvo }) {
  const [horario, setHorario] = useState(() => horarioParaEditor(maquina.horarioFuncionamento));
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const salvar = async () => {
    const { valor, erro } = editorParaHorario(horario);
    if (erro) {
      setAviso({ type: "error", message: erro });
      return;
    }
    setSalvando(true);
    setAviso(null);
    try {
      await api.put(`/machine-pay/monitor/maquinas/${maquina.posId}/horario`, {
        horarioFuncionamento: valor,
      });
      setAviso({ type: "success", message: "Horário salvo." });
      onSalvo?.();
    } catch (error) {
      setAviso({ type: "error", message: mensagemErro(error, "Erro ao salvar horário") });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-slate-300 bg-slate-50 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-gray-900">🕒 Horário de funcionamento</h4>
          <p className="text-xs text-gray-600">
            Offline fora desse horário aparece como "Ponto fechado".{" "}
            {maquina.vinculo
              ? `Salvo no cadastro da máquina ${maquina.vinculo.codigo || maquina.vinculo.nome}.`
              : "Leitor sem máquina vinculada: o horário fica salvo para este caixa."}
          </p>
        </div>
        <button type="button" onClick={onFechar} className="text-sm text-gray-500 hover:text-gray-700">
          Fechar
        </button>
      </div>
      {aviso && <AlertBox type={aviso.type} message={aviso.message} onClose={() => setAviso(null)} />}
      <HorarioFuncionamentoEditor valor={horario} onChange={setHorario} />
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="btn-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar horário"}
        </button>
      </div>
    </div>
  );
}

function NovaManutencaoMaquina({ maquina, onFechar, onCriada }) {
  const vinculo = maquina.vinculo;
  const [descricao, setDescricao] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [funcionarioId, setFuncionarioId] = useState("");
  const [funcionarios, setFuncionarios] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    api
      .get("/usuarios/funcionarios")
      .then((res) => setFuncionarios(res.data || []))
      .catch(() => setFuncionarios([]));
  }, []);

  const salvar = async () => {
    if (!descricao.trim()) {
      setAviso({ type: "error", message: "Descreva o problema da máquina." });
      return;
    }
    // No computador a aba do WhatsApp precisa ser aberta ainda no clique
    const abaWhatsapp = reservarAbaWhatsapp();
    setSalvando(true);
    setAviso(null);
    try {
      const res = await api.post("/manutencoes", {
        maquinaId: vinculo.maquinaId,
        lojaId: vinculo.lojaId,
        roteiroId: null,
        descricao: descricao.trim(),
        funcionarioId: funcionarioId || null,
        status: urgente ? "urgente" : "pendente",
      });
      const criada = res.data?.manutencao || {};
      const texto = montarTextoWhatsapp({
        ...criada,
        descricao: criada.descricao || descricao.trim(),
        status: criada.status || (urgente ? "urgente" : "pendente"),
        loja: criada.loja || { nome: vinculo.lojaNome },
        maquina: criada.maquina || { codigo: vinculo.codigo, nome: vinculo.nome },
        funcionario:
          criada.funcionario || funcionarios.find((f) => String(f.id) === String(funcionarioId)),
      });
      enviarWhatsapp(texto, abaWhatsapp);
      setAviso({
        type: "success",
        message: "Manutenção criada e aberta no WhatsApp. Ela já aparece na aba Manutenções.",
        texto,
      });
      onCriada?.();
      setDescricao("");
      setUrgente(false);
      setFuncionarioId("");
    } catch (error) {
      abaWhatsapp?.close();
      setAviso({ type: "error", message: mensagemErro(error, "Erro ao criar manutenção") });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-[#2457B1]/30 bg-[#2457B1]/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-gray-900">🛠️ Nova manutenção</h4>
          <p className="text-xs text-gray-600">
            Máquina {vinculo.codigo || vinculo.nome}
            {vinculo.lojaNome ? ` · ${vinculo.lojaNome}` : ""}
          </p>
        </div>
        <button type="button" onClick={onFechar} className="text-sm text-gray-500 hover:text-gray-700">
          Fechar
        </button>
      </div>
      {aviso && (
        <AlertBox
          type={aviso.type}
          message={
            aviso.type === "success" ? (
              <>
                {aviso.message}{" "}
                <button
                  type="button"
                  onClick={() => enviarWhatsapp(aviso.texto)}
                  className="font-semibold underline"
                >
                  Enviar de novo
                </button>
                {" · "}
                <Link to="/manutencoes" className="font-semibold underline">
                  Ver manutenções
                </Link>
              </>
            ) : (
              aviso.message
            )
          }
          onClose={() => setAviso(null)}
        />
      )}
      <div className="space-y-3">
        <textarea
          className="input-field w-full"
          rows={3}
          placeholder="Descreva o problema (ex: leitor não liga, garra fraca...)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input-field w-auto"
            value={funcionarioId}
            onChange={(e) => setFuncionarioId(e.target.value)}
          >
            <option value="">Sem funcionário atribuído</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
            Urgente
          </label>
          <button type="button" onClick={salvar} className="btn-primary ml-auto" disabled={salvando}>
            {salvando ? "Salvando..." : "Criar e enviar no WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recorrência de manutenções da máquina (últimos 30 dias)
// ---------------------------------------------------------------------------

const DIAS_RECORRENCIA = 30;
const LIMITE_RECORRENCIA_ALTA = 10;

const manutencaoConcluida = (status) => /feit|conclu/i.test(String(status || ""));

// Verde: nenhuma nos últimos 30 dias · Amarelo: até 10 · Vermelho: mais de 10
const nivelRecorrencia = (qtd) => {
  if (qtd === 0) return { classe: "bg-green-600 hover:bg-green-700", label: "Sem recorrência" };
  if (qtd <= LIMITE_RECORRENCIA_ALTA) return { classe: "bg-yellow-500 hover:bg-yellow-600", label: "Atenção" };
  return { classe: "bg-red-600 hover:bg-red-700", label: "Recorrência alta" };
};

const manutencoesRecentes = (lista) => {
  const inicio = Date.now() - DIAS_RECORRENCIA * 24 * 60 * 60 * 1000;
  return lista.filter((m) => new Date(m.createdAt).getTime() >= inicio);
};

function HistoricoManutencoesMaquina({ manutencoes, onFechar }) {
  const recentes = manutencoesRecentes(manutencoes);
  const nivel = nivelRecorrencia(recentes.length);

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-gray-900">🔁 Histórico de manutenções</h4>
          <p className="text-xs text-gray-600">
            <b>{recentes.length}</b> nos últimos {DIAS_RECORRENCIA} dias ({nivel.label.toLowerCase()}) ·{" "}
            {manutencoes.length} no total
          </p>
        </div>
        <button type="button" onClick={onFechar} className="text-sm text-gray-500 hover:text-gray-700">
          Fechar
        </button>
      </div>
      {manutencoes.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma manutenção registrada para esta máquina.</p>
      ) : (
        <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
          {manutencoes.map((m) => {
            const recente = recentes.includes(m);
            return (
              <li
                key={m.id}
                className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm ${
                  recente ? "" : "bg-gray-50 text-gray-500"
                }`}
              >
                <span className="min-w-0 flex-1">{m.descricao}</span>
                <span className="flex items-center gap-3 text-xs">
                  <span className="whitespace-nowrap">{formatarDataHora(m.createdAt)}</span>
                  <span>{m.funcionario?.nome || "-"}</span>
                  <Pill
                    className={
                      manutencaoConcluida(m.status)
                        ? "border-green-300 bg-green-100 text-green-800"
                        : /urgente/i.test(m.status)
                          ? "border-red-300 bg-red-100 text-red-800"
                          : "border-yellow-300 bg-yellow-100 text-yellow-800"
                    }
                  >
                    {m.status}
                  </Pill>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: detalhe de uma máquina
// ---------------------------------------------------------------------------

function DetalheMaquina({ posId, onClose }) {
  const [dias, setDias] = useState(30);
  const permissoes = usePermissoesMachinePay();
  const { pode } = useAuth();
  const podeCriarManutencao = pode("manutencoes", true);
  const [novaManutencaoAberta, setNovaManutencaoAberta] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [versaoManutencoes, setVersaoManutencoes] = useState(0);
  const [horarioAberto, setHorarioAberto] = useState(false);
  const [versaoHorario, setVersaoHorario] = useState(0);
  const [salvandoRegiao, setSalvandoRegiao] = useState(false);
  const [erroRegiao, setErroRegiao] = useState("");

  const alterarRegiao = async (regiao) => {
    setSalvandoRegiao(true);
    setErroRegiao("");
    try {
      await api.put(`/machine-pay/monitor/maquinas/${posId}/regiao`, { regiao });
      setVersaoHorario((v) => v + 1);
    } catch (error) {
      setErroRegiao(mensagemErro(error, "Erro ao salvar região"));
    } finally {
      setSalvandoRegiao(false);
    }
  };
  const fim = dataBrasil();
  const { dados, loading, erro } = useConsulta(
    posId ? `/machine-pay/monitor/maquinas/${posId}` : null,
    { dataInicio: somarDias(fim, -(dias - 1)), dataFim: fim, _v: versaoHorario || undefined },
  );

  const m = dados?.maquina;
  const est = dados?.estatisticas;
  const serie = (dados?.dias || []).map((d) => ({ ...d, dia: formatarDataCurta(d.data) }));

  // Histórico de manutenções da máquina do sistema vinculada ao leitor
  const maquinaSistemaId = podeCriarManutencao ? m?.vinculo?.maquinaId : null;
  const { dados: manutencoesResposta } = useConsulta(maquinaSistemaId ? "/manutencoes" : null, {
    maquinaId: maquinaSistemaId,
    _v: versaoManutencoes || undefined,
  });
  // Filtra também aqui, caso o servidor ainda não aplique ?maquinaId=
  const manutencoesMaquina = manutencoesResposta
    ? manutencoesResposta.filter((mt) => (mt.maquinaId || mt.maquina?.id) === maquinaSistemaId)
    : null;
  const qtdRecentes = manutencoesMaquina ? manutencoesRecentes(manutencoesMaquina).length : null;
  const nivel = qtdRecentes === null ? null : nivelRecorrencia(qtdRecentes);

  const titulo = (
    <span className="flex flex-wrap items-center gap-3">
      <span>{dados?.nomePonto || "Máquina"}</span>
      {podeCriarManutencao && m && (
        <button
          type="button"
          onClick={() => setNovaManutencaoAberta(true)}
          disabled={!m.vinculo}
          title={
            m.vinculo
              ? "Criar manutenção para esta máquina"
              : "Este leitor não está vinculado a uma máquina do sistema (cadastre o posId na máquina)"
          }
          className="btn-primary px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          ➕ Adicionar manutenção
        </button>
      )}
      {podeCriarManutencao && m && (
        <button
          type="button"
          onClick={() => setHistoricoAberto((aberto) => !aberto)}
          disabled={!m.vinculo || !nivel}
          title={
            !m.vinculo
              ? "Este leitor não está vinculado a uma máquina do sistema"
              : nivel
                ? `${qtdRecentes} manutenção(ões) nos últimos ${DIAS_RECORRENCIA} dias`
                : "Carregando manutenções..."
          }
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white shadow transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            nivel ? nivel.classe : "bg-gray-400"
          }`}
        >
          🔁 Ver recorrência{qtdRecentes !== null ? ` (${qtdRecentes})` : ""}
        </button>
      )}
      {permissoes.podeHorario && m && (
        <button
          type="button"
          onClick={() => setHorarioAberto((aberto) => !aberto)}
          title={`Horário atual: ${resumoHorario(m.horarioFuncionamento)}`}
          className="rounded-lg bg-slate-600 px-3 py-1.5 text-sm font-semibold text-white shadow transition-colors hover:bg-slate-700"
        >
          🕒 Editar horário
        </button>
      )}
      {permissoes.podeHorario && m && (
        <select
          value={m.regiao || "CAPITAL"}
          onChange={(e) => alterarRegiao(e.target.value)}
          disabled={salvandoRegiao}
          title={
            m.vinculo
              ? "Região salva no cadastro da máquina"
              : "Leitor sem máquina vinculada: a região fica salva para este caixa"
          }
          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm font-semibold text-gray-700 shadow-sm disabled:opacity-50"
        >
          <option value="CAPITAL">🏙️ Capital</option>
          <option value="INTERIOR">🌳 Interior</option>
        </select>
      )}
    </span>
  );

  return (
    <Modal isOpen={Boolean(posId)} onClose={onClose} title={titulo} size="xl">
      {erro && <AlertBox type="error" message={erro} />}
      {erroRegiao && <AlertBox type="error" message={erroRegiao} onClose={() => setErroRegiao("")} />}
      {loading && !dados ? (
        <LoadingSpinner />
      ) : dados ? (
        <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
          {horarioAberto && m && (
            <EditarHorarioMaquina
              maquina={m}
              onFechar={() => setHorarioAberto(false)}
              onSalvo={() => setVersaoHorario((v) => v + 1)}
            />
          )}
          {novaManutencaoAberta && m?.vinculo && (
            <NovaManutencaoMaquina
              maquina={m}
              onFechar={() => setNovaManutencaoAberta(false)}
              onCriada={() => setVersaoManutencoes((v) => v + 1)}
            />
          )}
          {historicoAberto && manutencoesMaquina && (
            <HistoricoManutencoesMaquina
              manutencoes={manutencoesMaquina}
              onFechar={() => setHistoricoAberto(false)}
            />
          )}
          {m ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill online={m.online} pontoFechado={m.pontoFechado} />
              <Pill className="border-slate-200 bg-slate-50 text-slate-700" title="Região">
                {m.regiao === "INTERIOR" ? "🌳 Interior" : "🏙️ Capital"}
              </Pill>
              <Pill className="border-slate-200 bg-slate-50 text-slate-700" title="Horário de funcionamento do ponto">
                🕒 {resumoHorario(m.horarioFuncionamento)}
              </Pill>
              <QuedasPill quedas={m.quedasHoje} />
              <SinalPill sinal={m.sinalWifi} />
              <Pill className="border-blue-200 bg-blue-50 text-blue-800">
                {m.tipoVersao} v{m.versao}
              </Pill>
              <Pill className="border-gray-200 bg-gray-50 text-gray-700">Caixa {m.posId}</Pill>
              {m.serial && <Pill className="border-gray-200 bg-gray-50 text-gray-700">Serial {m.serial}</Pill>}
              {m.hibrido && <Pill className="border-green-200 bg-green-50 text-green-700">Híbrido</Pill>}
              {m.vinculo && (
                <Pill className="border-[#2457B1]/30 bg-[#2457B1]/10 text-[#2457B1]">
                  {m.vinculo.codigo} · {m.vinculo.lojaNome}
                </Pill>
              )}
            </div>
          ) : (
            <AlertBox type="warning" message="Esta máquina não aparece mais no painel Machine Pay. Abaixo, o histórico guardado." />
          )}

          {m && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard
                titulo={m.online ? "Situação" : m.pontoFechado ? "Ponto fechado há" : "Offline há"}
                valor={
                  m.online
                    ? "No ar"
                    : m.offlineDesde
                      ? formatarDuracao(m.offlineHaMinutos)
                      : "?"
                }
                detalhe={m.online ? `Última leitura ${formatarDataHora(m.coletadoEm)}` : m.offlineDesde ? `desde ${formatarDataHora(m.offlineDesde)}` : "Já estava offline no início do monitoramento"}
                icone={m.online ? "🟢" : m.pontoFechado ? "🌙" : "🔴"}
              />
              <KpiCard titulo="Última venda" valor={textoUltimaVenda(m)} icone="🧾" />
              <KpiCard
                titulo="Vendas hoje"
                valor={permissoes.verValores ? formatarMoeda(m.vendasHojeValor) : `${m.vendasHojeQtd}`}
                detalhe={permissoes.verValores ? `${m.vendasHojeQtd} vendas` : "vendas"}
                icone="💰"
              />
              {permissoes.verValores && (
                <KpiCard
                  titulo="Acumulado no painel"
                  valor={formatarMoeda(m.totalValor)}
                  detalhe={`PIX ${formatarMoeda(m.pix)} · Déb ${formatarMoeda(m.debito)} · Créd ${formatarMoeda(m.credito)}`}
                  icone="🏦"
                />
              )}
            </div>
          )}

          {m && (permissoes.podeCredito || permissoes.podeExtrato) && (
            <AcoesMaquina maquina={m} permissoes={permissoes} />
          )}

          {m && (
            <div className="grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <span><b>IP:</b> <span className="font-mono">{m.ip || "-"}</span></span>
              <span><b>Modo de crédito:</b> {MODO_RESPOSTA[m.modoResposta]}</span>
              <span><b>Telemetria:</b> {m.telemetria || "-"}</span>
              <span><b>Data no equipamento:</b> {m.dataEquipamento || "Não informada"}</span>
              <span><b>Plano:</b> {m.diasVencer !== null ? `${m.diasVencer} dias para vencer` : "-"}</span>
              <span><b>Gateway:</b> {m.gateway || "-"}{m.pagamentoTeste ? " (modo teste)" : ""}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-900">Histórico</h4>
            <select className="input-field w-auto py-1 text-sm" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </div>

          {est && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard titulo="Quedas no período" valor={est.totalQuedas} icone="⚡" cor="text-orange-600" />
              <KpiCard titulo="Dias com queda" valor={`${est.diasComQueda}/${est.diasMonitorados}`} icone="📅" />
              <KpiCard
                titulo="Pior dia"
                valor={est.piorDia ? `${est.piorDia.quedas}x` : "-"}
                detalhe={est.piorDia ? formatarDataCurta(est.piorDia.data) : null}
                icone="😟"
              />
              <KpiCard
                titulo="Tempo offline"
                valor={formatarDuracao(est.minutosOffline)}
                detalhe={`${est.vezesOffline} vez(es) · maior: ${formatarDuracao(est.maiorTempoOfflineMinutos)}`}
                icone="⏱️"
              />
            </div>
          )}

          {serie.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="dia" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="quedas" name="Quedas" radius={[4, 4, 0, 0]}>
                  {serie.map((d) => (
                    <Cell
                      key={d.data}
                      fill={d.quedas >= 5 ? "#dc2626" : d.quedas >= 3 ? "#f97316" : d.quedas >= 1 ? "#facc15" : "#22c55e"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          <div>
            <h4 className="mb-2 font-bold text-gray-900">Eventos de conexão</h4>
            {!dados.eventos.length ? (
              <p className="text-sm text-gray-500">Nenhum evento registrado neste período.</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {dados.eventos.map((e) => {
                  const info = TIPO_EVENTO[e.tipo];
                  return (
                    <li key={e.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-gray-500">{formatarDataHora(e.dataHora)}</span>
                      <Pill className={info.className}>
                        {info.icone} {info.label}
                      </Pill>
                      <span className="text-xs text-gray-500">
                        {e.tipo === "QUEDA" && `${e.quedasAntes}x → ${e.quedasDepois}x`}
                        {e.tipo === "ONLINE" && e.duracaoMinutos !== null && `ficou ${formatarDuracao(e.duracaoMinutos)} fora`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

const ABAS = [
  ["maquinas", "🔴 Máquinas"],
  ["ranking", "🏆 Ranking de quedas"],
  ["graficos", "📊 Gráficos"],
  ["eventos", "🕒 Linha do tempo"],
  ["ajuda", "❓ Como ler"],
];

export function MachinePay() {
  const hoje = dataBrasil();
  const { verValores } = usePermissoesMachinePay();
  const { pode } = useAuth();
  const [aba, setAba] = useState("maquinas");
  const [statusMaquinas, setStatusMaquinas] = useState("offline");
  const [comQuedaMaquinas, setComQuedaMaquinas] = useState(false);
  const [regiaoMaquinas, setRegiaoMaquinas] = useState("");

  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [busca, setBusca] = useState("");
  const [lojaId, setLojaId] = useState("");
  const [sinal, setSinal] = useState("");
  const [tipoVersao, setTipoVersao] = useState("");
  const [incluirDesativadas, setIncluirDesativadas] = useState(false);
  const [periodo, setPeriodo] = useState({ inicio: hoje, fim: hoje });

  const [lojas, setLojas] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [erroResumo, setErroResumo] = useState("");
  const [coletando, setColetando] = useState(false);
  const [maquinaAberta, setMaquinaAberta] = useState(null);
  const [versaoDados, setVersaoDados] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setBusca(buscaDigitada.trim()), 400);
    return () => clearTimeout(timer);
  }, [buscaDigitada]);

  useEffect(() => {
    api
      .get("/lojas")
      .then((res) => setLojas(Array.isArray(res.data) ? res.data : res.data?.lojas || []))
      .catch(() => setLojas([]));
  }, []);

  // versaoDados força as abas a recarregarem depois de "Atualizar agora".
  const filtrosQuery = useMemo(
    () => ({
      busca: busca || undefined,
      lojaId: lojaId || undefined,
      sinal: sinal || undefined,
      tipoVersao: tipoVersao || undefined,
      incluirDesativadas: incluirDesativadas ? "true" : undefined,
      _v: versaoDados || undefined,
    }),
    [busca, lojaId, sinal, tipoVersao, incluirDesativadas, versaoDados],
  );

  const carregarResumo = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setLoadingResumo(true);
      try {
        const res = await api.get("/machine-pay/monitor/resumo", { params: filtrosQuery });
        setResumo(res.data);
        setErroResumo("");
      } catch (error) {
        setErroResumo(mensagemErro(error, "Erro ao carregar resumo da Machine Pay"));
      } finally {
        setLoadingResumo(false);
      }
    },
    [filtrosQuery],
  );

  useEffect(() => {
    carregarResumo();
    const timer = setInterval(() => carregarResumo(true), ATUALIZAR_A_CADA_MS);
    return () => clearInterval(timer);
  }, [carregarResumo]);

  const coletarAgora = async () => {
    setColetando(true);
    try {
      await api.post("/machine-pay/monitor/coletar");
      setVersaoDados((v) => v + 1);
    } catch (error) {
      setErroResumo(mensagemErro(error, "Erro ao ler o painel Machine Pay"));
    } finally {
      setColetando(false);
    }
  };

  const irParaMaquinas = (status, comQueda = false, regiao = "") => {
    setStatusMaquinas(status);
    setComQuedaMaquinas(comQueda);
    setRegiaoMaquinas(regiao);
    setAba("maquinas");
  };

  const presetsPeriodo = [
    ["Hoje", hoje, hoje],
    ["Ontem", somarDias(hoje, -1), somarDias(hoje, -1)],
    ["7 dias", somarDias(hoje, -6), hoje],
    ["30 dias", somarDias(hoje, -29), hoje],
  ];

  const monitor = resumo?.monitor;
  const temFiltros = busca || lojaId || sinal || tipoVersao || incluirDesativadas;
  const minutosDesdeColeta = monitor?.ultimaColeta
    ? (Date.now() - new Date(monitor.ultimaColeta).getTime()) / 60000
    : null;
  const coletaAtrasada =
    minutosDesdeColeta !== null && minutosDesdeColeta > (monitor?.intervaloMinutos || 5) * 3;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Machine Pay"
          subtitle="Saúde dos leitores PIX/cartão: quem está offline, quem mais cai e o histórico de cada máquina."
          icon="📡"
          action={
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <div className="flex flex-wrap items-stretch gap-2 sm:justify-end">
                {pode("manutencoes", true) && (
                  <Link to="/manutencoes" className="btn-secondary flex items-center justify-center gap-2">
                    🛠️ Manutenções
                  </Link>
                )}
                <button
                  onClick={coletarAgora}
                  disabled={coletando}
                  className="btn-primary flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  <span className={coletando ? "animate-spin" : ""}>🔄</span>
                  {coletando ? "Lendo o painel..." : "Atualizar agora"}
                </button>
              </div>
              <span className={`text-xs ${coletaAtrasada ? "font-semibold text-red-600" : "text-gray-500"}`}>
                {monitor?.ultimaColeta
                  ? `Última leitura do painel: há ${tempoDesde(monitor.ultimaColeta)}`
                  : "Painel ainda não foi lido"}
              </span>
            </div>
          }
        />

        {erroResumo && <AlertBox type="error" title="Problema" message={erroResumo} onClose={() => setErroResumo("")} />}
        {monitor && !monitor.configurado && (
          <AlertBox
            type="warning"
            title="Monitoramento não configurado"
            message="Faltam as credenciais da Machine Pay no servidor (MACHINE_PAY_LOGIN_URL, MACHINE_PAY_LOGIN e MACHINE_PAY_PASSWORD)."
          />
        )}
        {monitor?.configurado && !monitor.ativo && (
          <AlertBox
            type="warning"
            title="Leitura automática desligada"
            message="MACHINE_PAY_MONITOR_ATIVO=false no servidor: os dados só mudam ao clicar em Atualizar agora."
          />
        )}
        {monitor?.ultimoErro && (
          <AlertBox
            type="error"
            title="A última leitura automática falhou"
            message={`${formatarDataHora(monitor.ultimoErro.em)} — ${monitor.ultimoErro.mensagem}`}
          />
        )}
        {coletaAtrasada && !monitor?.ultimoErro && (
          <AlertBox
            type="warning"
            message={`Os dados podem estar desatualizados: a última leitura do painel foi há ${tempoDesde(monitor.ultimaColeta)}.`}
          />
        )}

        {/* Filtros */}
        <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 lg:col-span-2">
              🔎 Buscar ponto, caixa, IP ou máquina
              <input
                className="input-field"
                placeholder="Ex: Coco Bambu, 104510802, Loja 15..."
                value={buscaDigitada}
                onChange={(e) => setBuscaDigitada(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              🏪 Loja (máquinas vinculadas)
              <select className="input-field" value={lojaId} onChange={(e) => setLojaId(e.target.value)}>
                <option value="">Todas as lojas</option>
                {lojas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              📶 Sinal Wi-Fi
              <select className="input-field" value={sinal} onChange={(e) => setSinal(e.target.value)}>
                <option value="">Qualquer sinal</option>
                <option value="RUIM,FRACO">Ruim ou fraco</option>
                {Object.entries(SINAL_INFO).map(([valor, info]) => (
                  <option key={valor} value={valor}>
                    {info.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              🧩 Tipo de leitor
              <select className="input-field" value={tipoVersao} onChange={(e) => setTipoVersao(e.target.value)}>
                <option value="">Todos</option>
                {TIPOS_LEITOR.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1 text-xs font-semibold text-gray-600 lg:col-span-2">
              📅 Período (ranking, gráficos e linha do tempo)
              <div className="flex flex-wrap items-center gap-2">
                {presetsPeriodo.map(([label, inicio, fim]) => (
                  <button
                    key={label}
                    onClick={() => setPeriodo({ inicio, fim })}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                      periodo.inicio === inicio && periodo.fim === fim
                        ? "border-[#2457B1] bg-[#2457B1] text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <input
                  type="date"
                  className="input-field w-auto py-1.5 text-sm"
                  value={periodo.inicio}
                  max={periodo.fim}
                  onChange={(e) => e.target.value && setPeriodo((p) => ({ ...p, inicio: e.target.value }))}
                />
                <span className="text-gray-400">até</span>
                <input
                  type="date"
                  className="input-field w-auto py-1.5 text-sm"
                  value={periodo.fim}
                  min={periodo.inicio}
                  max={hoje}
                  onChange={(e) => e.target.value && setPeriodo((p) => ({ ...p, fim: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={incluirDesativadas}
                  onChange={(e) => setIncluirDesativadas(e.target.checked)}
                />
                Incluir desativadas
                {!incluirDesativadas && resumo?.desativadasOcultas > 0 && (
                  <span className="text-xs text-gray-400">({resumo.desativadasOcultas} ocultas)</span>
                )}
              </label>
              {temFiltros && (
                <button
                  className="text-sm font-medium text-[#2457B1] hover:underline"
                  onClick={() => {
                    setBuscaDigitada("");
                    setLojaId("");
                    setSinal("");
                    setTipoVersao("");
                    setIncluirDesativadas(false);
                  }}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
          {monitor?.inicioHistorico && (
            <p className="mt-3 text-xs text-gray-500">
              ℹ️ Histórico gravado desde {formatarDataCurta(monitor.inicioHistorico)}. Leitura automática a cada{" "}
              {monitor.intervaloMinutos} min.
            </p>
          )}
        </section>

        {/* Indicadores */}
        {loadingResumo && !resumo ? (
          <LoadingSpinner message="Lendo situação das máquinas..." />
        ) : resumo ? (
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <KpiCard
              titulo="Monitoradas"
              valor={resumo.total}
              detalhe={`${resumo.vinculadas} vinculadas ao sistema`}
              icone="📟"
              onClick={() => irParaMaquinas("todas")}
              ativo={aba === "maquinas" && statusMaquinas === "todas" && !comQuedaMaquinas}
            />
            <KpiCard
              titulo="Online"
              valor={resumo.online}
              detalhe={resumo.total ? `${Math.round((resumo.online / resumo.total) * 100)}% no ar` : null}
              icone="🟢"
              cor="text-green-600"
              onClick={() => irParaMaquinas("online")}
              ativo={aba === "maquinas" && statusMaquinas === "online" && !comQuedaMaquinas}
            />
            <KpiCard
              titulo="Offline capital"
              valor={resumo.offlineCapital ?? 0}
              detalhe="Clique para ver a lista"
              icone="🏙️"
              cor="text-red-600"
              onClick={() => irParaMaquinas("offline", false, "CAPITAL")}
              ativo={
                aba === "maquinas" &&
                statusMaquinas === "offline" &&
                regiaoMaquinas === "CAPITAL" &&
                !comQuedaMaquinas
              }
            />
            <KpiCard
              titulo="Offline interior"
              valor={resumo.offlineInterior ?? 0}
              detalhe="Clique para ver a lista"
              icone="🌳"
              cor="text-red-600"
              onClick={() => irParaMaquinas("offline", false, "INTERIOR")}
              ativo={
                aba === "maquinas" &&
                statusMaquinas === "offline" &&
                regiaoMaquinas === "INTERIOR" &&
                !comQuedaMaquinas
              }
            />
            <KpiCard
              titulo="Ponto fechado"
              valor={resumo.pontoFechado ?? 0}
              detalhe="Offline fora do horário do ponto"
              icone="🌙"
              cor="text-slate-600"
              onClick={() => irParaMaquinas("fechado")}
              ativo={aba === "maquinas" && statusMaquinas === "fechado" && !comQuedaMaquinas}
            />
            <KpiCard
              titulo="Quedas hoje"
              valor={resumo.quedasHoje}
              detalhe={`${resumo.maquinasComQuedaHoje} máquinas caíram`}
              icone="⚡"
              cor="text-orange-600"
              onClick={() => irParaMaquinas("todas", true)}
              ativo={aba === "maquinas" && comQuedaMaquinas}
            />
            <KpiCard
              titulo="Críticas hoje"
              valor={resumo.maquinasInstaveisHoje}
              detalhe="5 quedas ou mais"
              icone="🚨"
              cor="text-red-700"
              onClick={() => {
                setPeriodo({ inicio: hoje, fim: hoje });
                setAba("ranking");
              }}
            />
            <KpiCard
              titulo="Sinal fraco/ruim"
              valor={resumo.sinalRuimOuFraco}
              detalhe="Clique para filtrar"
              icone="📶"
              cor="text-orange-600"
              onClick={() => {
                setSinal("RUIM,FRACO");
                irParaMaquinas("todas");
              }}
            />
            <KpiCard
              titulo="Online sem venda hoje"
              valor={resumo.semVendaHoje}
              detalhe="Pode valer conferir"
              icone="🤔"
            />
            <KpiCard
              titulo="Vendas hoje"
              valor={verValores ? formatarMoeda(resumo.vendasHojeValor) : `${resumo.vendasHojeQtd}`}
              detalhe={`${verValores ? `${resumo.vendasHojeQtd} vendas · ` : "vendas · "}${resumo.vencendoEm15Dias} planos vencendo`}
              icone="💰"
              cor="text-[#2457B1]"
            />
          </div>
        ) : null}

        {resumo?.pioresHoje?.length > 0 && aba !== "ranking" && (
          <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <p className="mb-2 text-sm font-bold text-orange-900">⚠️ Quem mais caiu hoje</p>
            <div className="flex flex-wrap gap-2">
              {resumo.pioresHoje.map((m) => (
                <button
                  key={m.posId}
                  onClick={() => setMaquinaAberta(m.posId)}
                  className="flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1 text-sm hover:shadow"
                >
                  <QuedasPill quedas={m.quedasHoje} />
                  <span className="max-w-[220px] truncate">{m.nomePonto}</span>
                  {!m.online &&
                    (m.pontoFechado ? (
                      <span title="Ponto fechado">🌙</span>
                    ) : (
                      <span title="Offline agora">🔴</span>
                    ))}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Abas */}
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          {ABAS.map(([valor, label]) => (
            <button
              key={valor}
              onClick={() => setAba(valor)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                aba === valor ? "bg-[#2457B1] text-white shadow" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {aba === "maquinas" && (
          <AbaMaquinas
            filtrosQuery={filtrosQuery}
            onAbrirMaquina={setMaquinaAberta}
            status={statusMaquinas}
            setStatus={setStatusMaquinas}
            comQueda={comQuedaMaquinas}
            setComQueda={setComQuedaMaquinas}
            regiao={regiaoMaquinas}
            setRegiao={setRegiaoMaquinas}
          />
        )}
        {aba === "ranking" && (
          <AbaRanking filtrosQuery={filtrosQuery} periodo={periodo} onAbrirMaquina={setMaquinaAberta} />
        )}
        {aba === "graficos" && <AbaGraficos filtrosQuery={filtrosQuery} periodo={periodo} resumo={resumo} />}
        {aba === "eventos" && (
          <AbaEventos filtrosQuery={filtrosQuery} periodo={periodo} onAbrirMaquina={setMaquinaAberta} />
        )}
        {aba === "ajuda" && <AbaAjuda />}
      </main>

      <DetalheMaquina key={maquinaAberta} posId={maquinaAberta} onClose={() => setMaquinaAberta(null)} />

      <Footer />
    </div>
  );
}

export default MachinePay;

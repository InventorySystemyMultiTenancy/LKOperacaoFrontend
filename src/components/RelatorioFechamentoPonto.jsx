import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../services/api";
import { AlertBox } from "./UIComponents";
import {
  reais,
  dataBR,
  resumirVendasPonto,
  baixarPdfRelatorio,
  compartilharPdfRelatorio,
  linkWhatsappRelatorio,
} from "../utils/relatorioVendasPonto";

// Dentro do extrato da máquina: relatório do período (PDF), fechamento na
// Machine Pay e envio ao WhatsApp do ponto, já com a comissão calculada.
export function RelatorioFechamentoPonto({ maquina, periodo, vendas, usuarioNome }) {
  const [ponto, setPonto] = useState({ nomeContato: "", whatsapp: "", percentualComissao: "" });
  const [ultimoFechamento, setUltimoFechamento] = useState(null);
  const [dinheiroEspecie, setDinheiroEspecie] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    api
      .get(`/machine-pay/monitor/maquinas/${maquina.posId}/ponto`)
      .then(({ data }) => {
        setPonto({
          nomeContato: data.nomeContato || "",
          whatsapp: data.whatsapp || "",
          percentualComissao: data.percentualComissao ? String(data.percentualComissao) : "",
        });
        setUltimoFechamento(data.ultimoFechamento || null);
      })
      .catch(() => {});
  }, [maquina.posId]);

  // Mudou o período: o fechamento anterior não vale para o novo relatório
  useEffect(() => setResultado(null), [periodo.inicio, periodo.fim]);

  const percentual = Number(String(ponto.percentualComissao).replace(",", ".")) || 0;
  const resumo = useMemo(() => resumirVendasPonto(vendas, percentual), [vendas, percentual]);

  const relatorio = {
    nomePonto: maquina.nomePonto,
    posId: maquina.posId,
    dataInicio: resultado?.fechamento?.dataInicio || periodo.inicio,
    dataFim: resultado?.fechamento?.dataFim || periodo.fim,
    vendas: resultado?.vendas || vendas,
    resumo: resultado
      ? resumirVendasPonto(resultado.vendas, resultado.fechamento.percentualComissao)
      : resumo,
    dinheiroEspecie: resultado?.fechamento?.dinheiroEspecie ?? (Number(dinheiroEspecie) || 0),
    nomeContato: ponto.nomeContato,
    fechamento: resultado?.fechamento || null,
    usuarioNome,
  };

  const salvarPonto = async () => {
    setSalvando(true);
    setAviso(null);
    try {
      await api.put(`/machine-pay/monitor/maquinas/${maquina.posId}/ponto`, {
        ...ponto,
        percentualComissao: percentual,
      });
      setAviso({ type: "success", message: "Dados do ponto salvos." });
    } catch (error) {
      setAviso({ type: "error", message: error.response?.data?.error || "Erro ao salvar o ponto." });
    } finally {
      setSalvando(false);
    }
  };

  const fazerFechamento = async () => {
    const confirmacao = await Swal.fire({
      icon: "warning",
      title: "Fazer o fechamento?",
      html: `Vai fechar na <b>Machine Pay</b> as vendas de <b>${dataBR(periodo.inicio)}</b> a <b>${dataBR(periodo.fim)}</b><br/>da máquina <b>${maquina.nomePonto || maquina.posId}</b>.<br/><br/>Total: <b>${reais(resumo.totalVendas)}</b> · comissão ${percentual}%: <b>${reais(resumo.totalComissao)}</b>`,
      showCancelButton: true,
      confirmButtonText: "Fazer fechamento",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#12A150",
    });
    if (!confirmacao.isConfirmed) return;

    setFechando(true);
    setAviso(null);
    try {
      const { data } = await api.post(`/machine-pay/monitor/maquinas/${maquina.posId}/fechamento`, {
        dataInicio: periodo.inicio,
        dataFim: periodo.fim,
        percentualComissao: percentual,
        whatsapp: ponto.whatsapp,
        nomeContato: ponto.nomeContato,
        dinheiroEspecie: Number(String(dinheiroEspecie).replace(",", ".")) || 0,
      });
      setResultado(data);
      setUltimoFechamento(data.fechamento);
      setAviso({
        type: data.fechamento.fechadoNoPainel ? "success" : "warning",
        message: data.mensagem,
      });
    } catch (error) {
      setAviso({ type: "error", message: error.response?.data?.error || "Erro ao fazer o fechamento." });
    } finally {
      setFechando(false);
    }
  };

  const compartilhar = async () => {
    try {
      if (!(await compartilharPdfRelatorio(relatorio))) {
        setAviso({ type: "info", message: "Este navegador não compartilha arquivos: use Baixar PDF." });
      }
    } catch {
      // compartilhamento cancelado
    }
  };

  const whatsappValido = ponto.whatsapp.replace(/\D/g, "").length >= 10;

  return (
    <div className="mt-4 rounded-xl border-2 border-accent-yellow bg-accent-cream/40 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-bold text-gray-900">📄 Relatório e fechamento do período</h4>
        <span className="text-xs font-semibold text-gray-600">
          {dataBR(periodo.inicio)} a {dataBR(periodo.fim)}
        </span>
      </div>
      {ultimoFechamento && !resultado && (
        <p className="text-xs text-gray-600">
          Último fechamento: {dataBR(ultimoFechamento.dataInicio)} a {dataBR(ultimoFechamento.dataFim)}
          {ultimoFechamento.fechadoNoPainel ? " ✅" : " ⚠️ não confirmado no painel"}
        </p>
      )}

      {aviso && <AlertBox type={aviso.type} message={aviso.message} onClose={() => setAviso(null)} />}

      {/* Dados do ponto (ficam salvos para os próximos relatórios) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs font-semibold text-gray-700">
          Contato no ponto
          <input
            className="input-field mt-1 py-2 text-sm"
            placeholder="Nome (opcional)"
            value={ponto.nomeContato}
            onChange={(e) => setPonto((p) => ({ ...p, nomeContato: e.target.value }))}
          />
        </label>
        <label className="text-xs font-semibold text-gray-700">
          WhatsApp do ponto
          <input
            type="tel"
            inputMode="tel"
            className="input-field mt-1 py-2 text-sm"
            placeholder="(11) 99999-9999"
            value={ponto.whatsapp}
            onChange={(e) => setPonto((p) => ({ ...p, whatsapp: e.target.value }))}
          />
        </label>
        <label className="text-xs font-semibold text-gray-700">
          Comissão do ponto (%)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="0.01"
            className="input-field mt-1 py-2 text-sm"
            placeholder="Ex: 30"
            value={ponto.percentualComissao}
            onChange={(e) => setPonto((p) => ({ ...p, percentualComissao: e.target.value }))}
          />
        </label>
      </div>
      <button type="button" onClick={salvarPonto} disabled={salvando} className="text-sm font-semibold text-primary">
        {salvando ? "Salvando..." : "💾 Salvar dados do ponto"}
      </button>

      {/* Resumo calculado */}
      <div className="rounded-lg bg-white border border-gray-200 divide-y text-sm">
        <div className="flex justify-between px-3 py-2 font-bold">
          <span>Total de vendas ({resumo.quantidadeVendas})</span>
          <span>{reais(resumo.totalVendas)}</span>
        </div>
        {resumo.porMetodo.map((m) => (
          <div key={m.metodo} className="flex justify-between px-3 py-1.5 text-gray-600">
            <span>
              {m.metodo} ({m.quantidade})
            </span>
            <span>{reais(m.total)}</span>
          </div>
        ))}
        <div className="flex justify-between px-3 py-2 font-bold text-primary-dark">
          <span>Comissão do ponto ({percentual}%)</span>
          <span>{reais(resumo.totalComissao)}</span>
        </div>
        <div className="flex justify-between px-3 py-2">
          <span>Valor líquido</span>
          <span className="font-semibold">{reais(resumo.totalLiquido)}</span>
        </div>
        {resumo.quantidadeDevolvidas > 0 && (
          <p className="px-3 py-1.5 text-xs text-gray-500">
            {resumo.quantidadeDevolvidas} venda(s) devolvida(s) não entram no total.
          </p>
        )}
      </div>

      <label className="block text-xs font-semibold text-gray-700 max-w-xs">
        Dinheiro em espécie no período (opcional)
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          className="input-field mt-1 py-2 text-sm"
          placeholder="R$ 0,00"
          value={dinheiroEspecie}
          onChange={(e) => setDinheiroEspecie(e.target.value)}
          disabled={Boolean(resultado)}
        />
        <span className="font-normal text-gray-500">Vai junto no fechamento da Machine Pay.</span>
      </label>

      <div className="flex flex-wrap gap-2">
        {!resultado && (
          <button type="button" onClick={fazerFechamento} disabled={fechando} className="btn-primary disabled:opacity-50">
            {fechando ? "Fechando na Machine Pay..." : "🔒 Fazer fechamento"}
          </button>
        )}
        <button type="button" onClick={() => baixarPdfRelatorio(relatorio)} className="btn-secondary">
          📄 {resultado ? "Baixar PDF" : "Gerar PDF (prévia)"}
        </button>
        <button type="button" onClick={compartilhar} className="btn-secondary">
          📤 Compartilhar PDF
        </button>
        <a
          href={linkWhatsappRelatorio(relatorio, ponto.whatsapp)}
          target="_blank"
          rel="noreferrer"
          className={`px-4 py-2.5 rounded-xl font-bold text-white bg-[#25D366] hover:brightness-95 ${
            whatsappValido ? "" : "pointer-events-none opacity-50"
          }`}
          title={whatsappValido ? "Abrir conversa com o ponto" : "Informe o WhatsApp do ponto"}
        >
          📲 Enviar no WhatsApp
        </a>
      </div>
      <p className="text-xs text-gray-500">
        No celular, use <b>Compartilhar PDF</b> e escolha o WhatsApp para mandar o arquivo; o botão verde abre a
        conversa do ponto com o resumo e a comissão.
      </p>
    </div>
  );
}

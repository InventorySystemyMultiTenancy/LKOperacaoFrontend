import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox, PageHeader, StatsGrid } from "../components/UIComponents";
import { EmptyState, LoadingSpinner } from "../components/Loading";
import {
  isMovimentacaoInconsistente,
  validarInconsistenciasMovimentacao,
} from "../utils/movimentacaoInconsistencias";

const TAMANHO_PAGINA_ALERTAS = 20;

const nivelConfig = {
  CRITICO: {
    label: "CRITICO",
    className: "bg-red-100 text-red-700 border-red-200",
    bar: "bg-red-600",
  },
  "CRÍTICO": {
    label: "CRÍTICO",
    className: "bg-red-100 text-red-700 border-red-200",
    bar: "bg-red-600",
  },
  ALTO: {
    label: "ALTO",
    className: "bg-orange-100 text-orange-700 border-orange-200",
    bar: "bg-orange-500",
  },
  MEDIO: {
    label: "MEDIO",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    bar: "bg-amber-500",
  },
  "MÉDIO": {
    label: "MÉDIO",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    bar: "bg-amber-500",
  },
};

function normalizarNivel(nivel) {
  return String(nivel || "MÉDIO").toUpperCase();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatarPercentual(value) {
  return `${toNumber(value).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })}%`;
}

function formatarMoeda(value) {
  return `R$ ${toNumber(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
  })}`;
}

function formatarData(value) {
  if (!value) return "Data não informada";

  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return "Data não informada";

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLojaNome(loja) {
  return loja?.nome || loja?.razaoSocial || loja?.fantasia || "Loja não informada";
}

function textoInclui(texto, busca) {
  return String(texto || "")
    .toLowerCase()
    .includes(busca);
}

function alertaMaquinaCombinaBusca(alerta, busca) {
  if (!busca) return true;
  return (
    textoInclui(alerta?.maquina?.codigo, busca) ||
    textoInclui(alerta?.maquina?.nome, busca) ||
    textoInclui(alerta?.maquina?.loja, busca)
  );
}

function alertaDepositoCombinaBusca(alerta, busca) {
  if (!busca) return true;
  return (
    textoInclui(getLojaNome(alerta?.loja), busca) ||
    textoInclui(alerta?.produto?.nome, busca) ||
    textoInclui(alerta?.produto?.codigo, busca)
  );
}

function alertaFinanceiroCombinaBusca(alerta, busca) {
  if (!busca) return true;
  return (
    textoInclui(alerta?.maquina?.codigo, busca) ||
    textoInclui(alerta?.maquina?.nome, busca) ||
    textoInclui(alerta?.maquina?.loja, busca)
  );
}

function movimentacaoCombinaBusca(movimentacao, maquina, loja, busca) {
  if (!busca) return true;
  return (
    textoInclui(maquina?.codigo, busca) ||
    textoInclui(maquina?.nome, busca) ||
    textoInclui(getLojaNome(loja), busca) ||
    textoInclui(movimentacao?.maquina?.codigo, busca) ||
    textoInclui(movimentacao?.maquina?.nome, busca) ||
    textoInclui(movimentacao?.loja?.nome, busca)
  );
}

function ordenarAlertasMaquinas(alertas) {
  // Mais recente primeiro
  return [...alertas].sort(
    (a, b) => new Date(b?.ultimaAtualizacao || 0) - new Date(a?.ultimaAtualizacao || 0),
  );
}

function ordenarAlertasDeposito(alertas) {
  // Mais recente primeiro
  return [...alertas].sort(
    (a, b) => new Date(b?.atualizadoEm || 0) - new Date(a?.atualizadoEm || 0),
  );
}

function SectionEmpty({ message }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white/70 p-8 text-center">
      <div className="text-4xl mb-2">📭</div>
      <p className="text-sm sm:text-base font-medium text-gray-600">{message}</p>
    </div>
  );
}

function SectionHeader({ icon, title, total, subtitle }) {
  return (
    <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-gray-900">
          <span>{icon}</span>
          {title}
        </h2>
        {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
      </div>
      <span className="w-fit rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-semibold text-gray-700">
        {total} {total === 1 ? "alerta" : "alertas"}
      </span>
    </div>
  );
}

function ResolverAlertaButton({ onResolver, resolvendo, className = "" }) {
  if (!onResolver) return null;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onResolver();
      }}
      disabled={resolvendo}
      className={`inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {resolvendo ? "Marcando..." : "✓ Marcar como resolvido"}
    </button>
  );
}

function MachineAlertCard({ alerta, onResolver, resolvendo }) {
  const nivel = normalizarNivel(alerta?.nivelAlerta);
  const config = nivelConfig[nivel] || nivelConfig["MÉDIO"];
  const percentual = Math.max(0, Math.min(100, toNumber(alerta?.percentualAtual)));
  const produtos = Array.isArray(alerta?.produtos) ? alerta.produtos : [];

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {alerta?.maquina?.codigo || "Sem código"} -{" "}
            {alerta?.maquina?.nome || "Máquina sem nome"}
          </h3>
          <p className="mt-1 text-sm font-medium text-gray-600">
            🏪 Loja: {alerta?.maquina?.loja || "Não informada"}
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-bold ${config.className}`}
        >
          {config.label}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-700">
              Estoque atual: {toNumber(alerta?.estoqueAtual)} /{" "}
              {toNumber(alerta?.capacidadePadrao)}
            </span>
            <span className="font-bold text-gray-900">
              {formatarPercentual(alerta?.percentualAtual)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${config.bar}`}
              style={{ width: `${percentual}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
            <span>Mínimo configurado: {formatarPercentual(alerta?.percentualAlerta)}</span>
            <span>Estoque mínimo: {toNumber(alerta?.estoqueMinimo)}</span>
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Produtos da última movimentação
          </p>
          {produtos.length > 0 ? (
            <div className="mt-2 space-y-2">
              {produtos.map((produto, index) => (
                <div
                  key={`${produto?.id || produto?.codigo || "produto"}-${index}`}
                  className="flex items-center gap-2 text-sm text-gray-800"
                >
                  <span className="text-xl">{produto?.emoji || "📦"}</span>
                  <span className="font-semibold">{produto?.nome || "Produto sem nome"}</span>
                  <span className="text-gray-500">- {produto?.codigo || "S/C"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">Nenhum produto informado.</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-sm text-gray-600">
        <span>
          Última atualização:{" "}
          <span className="font-semibold text-gray-800">
            {formatarData(alerta?.ultimaAtualizacao)}
          </span>
        </span>
        <ResolverAlertaButton onResolver={onResolver} resolvendo={resolvendo} />
      </div>
    </article>
  );
}

function StoreAlertCard({ alerta, onResolver, resolvendo }) {
  const produto = alerta?.produto || {};
  const loja = alerta?.loja || {};

  return (
    <article className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-2xl">
            {produto?.emoji || "📦"}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">
              🏪 {getLojaNome(loja)}
            </p>
            <h3 className="mt-1 text-lg font-bold text-gray-900">
              {produto?.nome || "Produto sem nome"}
            </h3>
            <p className="text-sm text-gray-500">Código: {produto?.codigo || "S/C"}</p>
          </div>
        </div>
        <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
          Estoque baixo
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs font-bold uppercase text-gray-500">Quantidade atual</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {toNumber(alerta?.quantidade)}
          </p>
        </div>
        <div className="rounded-lg bg-amber-50 p-3">
          <p className="text-xs font-bold uppercase text-amber-700">Estoque mínimo</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">
            {toNumber(alerta?.estoqueMinimo ?? produto?.estoqueMinimo)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end border-t border-gray-100 pt-3">
        <ResolverAlertaButton onResolver={onResolver} resolvendo={resolvendo} />
      </div>
    </article>
  );
}

const FINANCEIRO_ALERTA_CONFIG = {
  dinheiro_faltando: {
    label: "Dinheiro faltando",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700 border-red-200",
    box: "bg-red-50",
    text: "text-red-700",
    textStrong: "text-red-800",
  },
  dinheiro_extra: {
    label: "Dinheiro extra preenchido",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    box: "bg-amber-50",
    text: "text-amber-700",
    textStrong: "text-amber-800",
  },
  contador_suspeito: {
    label: "Contador suspeito — conferir",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    box: "bg-blue-50",
    text: "text-blue-700",
    textStrong: "text-blue-800",
  },
};

function getPossiveisErrosFinanceiro(alerta) {
  if (!alerta) return [];

  if (alerta.tipo === "contador_suspeito") {
    return [
      "Erro de digitação no contador IN desta coleta (dígito a mais/a menos).",
      "Erro de digitação no contador IN da coleta anterior usada como referência.",
      "O contador da máquina foi resetado ou a placa/leitor foi trocado sem registrar o motivo.",
      "O contador de outra máquina foi lançado por engano nesta movimentação.",
      alerta.usaFichas
        ? "A máquina está cadastrada com fichas necessárias por jogada, mas na prática cobra em dinheiro direto — verifique o cadastro da máquina."
        : "A máquina cadastrada sem sistema de fichas na verdade usa fichas — verifique se 'fichas necessárias por jogada' deveria estar preenchido no cadastro.",
    ];
  }

  if (alerta.tipo === "dinheiro_faltando") {
    return [
      "Diferença na contagem física da bag (notas contadas a menos).",
      "Fechamento digital da Machine Pay não considerou todo o período ou não foi somado.",
      "Contador IN lido incorretamente em uma das duas coletas.",
      "Possível perda ou retirada de dinheiro não registrada.",
    ];
  }

  return [
    "Diferença na contagem física da bag (notas contadas a mais, ou de outra bag).",
    "Fechamento digital da Machine Pay duplicado ou contando período de outra máquina.",
    "Contador IN lido incorretamente em uma das duas coletas.",
    "Valor de outra máquina/bag lançado nesta movimentação por engano.",
  ];
}

function FinanceiroAlertCard({ alerta, onClick, onResolver, resolvendo }) {
  const suspeito = alerta?.tipo === "contador_suspeito";
  const faltando = alerta?.tipo === "dinheiro_faltando";
  const config =
    FINANCEIRO_ALERTA_CONFIG[alerta?.tipo] ||
    FINANCEIRO_ALERTA_CONFIG.dinheiro_extra;

  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick?.();
      }}
      className={`cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5 sm:p-5 ${config.border}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {alerta?.maquina?.codigo || "Sem código"} -{" "}
            {alerta?.maquina?.nome || "Máquina sem nome"}
          </h3>
          <p className="mt-1 text-sm font-medium text-gray-600">
            🏪 Loja: {alerta?.maquina?.loja || "Não informada"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Bag: <span className="font-semibold">{alerta?.numeroBag}</span> ·{" "}
            {formatarData(alerta?.dataColeta)}
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-bold ${config.badge}`}
        >
          {config.label}
        </span>
      </div>

      {suspeito && (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
          O valor esperado calculado a partir do contador IN ficou fora do
          plausível para uma única bag. Provavelmente há um erro de
          leitura/digitação no contador desta coleta ou da anterior — confira
          os dois valores antes de tratar como divergência de dinheiro.
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs font-bold uppercase text-gray-500">Esperado</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {formatarMoeda(alerta?.valorEsperado)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs font-bold uppercase text-gray-500">Preenchido</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {formatarMoeda(alerta?.valorPreenchido)}
          </p>
        </div>
        <div className={`rounded-lg p-3 ${config.box}`}>
          <p className={`text-xs font-bold uppercase ${config.text}`}>
            Diferença
          </p>
          <p className={`mt-1 text-lg font-bold ${config.textStrong}`}>
            {suspeito ? (
              "—"
            ) : (
              <>
                {faltando ? "-" : "+"}
                {formatarMoeda(Math.abs(toNumber(alerta?.diferenca)))}
              </>
            )}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs font-bold uppercase text-gray-500">
            Contador IN (diferença)
          </p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {toNumber(alerta?.diferencaContador)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {alerta?.usaFichas ? (
              <>
                {toNumber(alerta?.jogadas).toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                })}{" "}
                jogadas ({toNumber(alerta?.fichasNecessarias)} ficha(s)/jogada)
              </>
            ) : (
              "1 real = 1 no contador"
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-sm text-gray-600">
        <span>
          Responsável:{" "}
          <span className="font-semibold text-gray-800">
            {alerta?.usuario || "Não informado"}
          </span>
        </span>
        <div className="flex items-center gap-2">
          <ResolverAlertaButton onResolver={onResolver} resolvendo={resolvendo} />
          <span className="text-xs font-semibold text-blue-600">
            Ver detalhes →
          </span>
        </div>
      </div>
    </article>
  );
}

function DetalheMovimentacaoFinanceira({ titulo, movimentacao }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {titulo}
      </p>
      <p className="mt-1 text-sm text-gray-700">
        Bag <span className="font-semibold">{movimentacao?.numeroBag ?? "-"}</span>{" "}
        · {formatarData(movimentacao?.dataColeta)}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-gray-500">Contador IN</p>
          <p className="text-lg font-bold text-gray-900">
            {movimentacao?.contadorIn ?? "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Contador OUT</p>
          <p className="text-lg font-bold text-gray-900">
            {movimentacao?.contadorOut ?? "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Notas (bag)</p>
          <p className="text-sm font-semibold text-gray-800">
            {formatarMoeda(movimentacao?.valorEntradaNotas)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Digital (Machine Pay)</p>
          <p className="text-sm font-semibold text-gray-800">
            {formatarMoeda(movimentacao?.valorEntradaCartao)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ConferirAlertaFinanceiroModal({ alerta, onClose }) {
  if (!alerta) return null;

  const suspeito = alerta?.tipo === "contador_suspeito";
  const faltando = alerta?.tipo === "dinheiro_faltando";
  const config =
    FINANCEIRO_ALERTA_CONFIG[alerta?.tipo] ||
    FINANCEIRO_ALERTA_CONFIG.dinheiro_extra;
  const possiveisErros = getPossiveisErrosFinanceiro(alerta);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Conferir divergência financeira
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {alerta?.maquina?.codigo || "Máquina"} -{" "}
              {alerta?.maquina?.nome || "Não informada"} ·{" "}
              {alerta?.maquina?.loja || "Loja não informada"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <span
          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-bold ${config.badge}`}
        >
          {config.label}
        </span>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetalheMovimentacaoFinanceira
            titulo="Última retirada de dinheiro (referência)"
            movimentacao={alerta?.movimentacaoAnterior}
          />
          <DetalheMovimentacaoFinanceira
            titulo="Movimentação deste preenchimento (atual)"
            movimentacao={alerta?.movimentacaoAtual}
          />
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Diferença do contador IN
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span className="font-semibold">
              {alerta?.movimentacaoAtual?.contadorIn ?? "-"}
            </span>
            <span className="text-gray-400">(atual) −</span>
            <span className="font-semibold">
              {alerta?.movimentacaoAnterior?.contadorIn ?? "-"}
            </span>
            <span className="text-gray-400">(anterior) =</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-lg font-bold text-gray-900">
              {toNumber(alerta?.diferencaContador)}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {alerta?.usaFichas ? (
              <>
                {toNumber(alerta?.jogadas).toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                })}{" "}
                jogadas × {toNumber(alerta?.fichasNecessarias)} ficha(s)/jogada
                × {formatarMoeda(alerta?.valorFicha)}/ficha ={" "}
              </>
            ) : (
              <>
                Máquina sem sistema de fichas: o contador soma 1 para cada R$1
                inserido, então a diferença acima já é o valor em reais ={" "}
              </>
            )}
            <span className="font-bold">
              {formatarMoeda(alerta?.valorEsperado)}
            </span>{" "}
            esperado
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-bold uppercase text-gray-500">Esperado</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {formatarMoeda(alerta?.valorEsperado)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-bold uppercase text-gray-500">
              Preenchido
            </p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {formatarMoeda(alerta?.valorPreenchido)}
            </p>
          </div>
          <div className={`rounded-lg p-3 ${config.box}`}>
            <p className={`text-xs font-bold uppercase ${config.text}`}>
              Diferença
            </p>
            <p className={`mt-1 text-lg font-bold ${config.textStrong}`}>
              {suspeito ? (
                "—"
              ) : (
                <>
                  {faltando ? "-" : "+"}
                  {formatarMoeda(Math.abs(toNumber(alerta?.diferenca)))}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Possíveis causas
          </p>
          <ul className="mt-2 space-y-1 text-sm text-gray-800">
            {possiveisErros.map((erro, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-gray-400">•</span>
                <span>{erro}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          Responsável pela coleta atual:{" "}
          <span className="font-semibold text-gray-800">
            {alerta?.usuario || "Não informado"}
          </span>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="btn-primary">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertasSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((item) => (
        <div key={item} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="animate-pulse space-y-4">
            <div className="h-5 w-2/3 rounded bg-gray-200" />
            <div className="h-3 w-full rounded bg-gray-100" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 rounded bg-gray-100" />
              <div className="h-16 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function VerMaisAlertasButton({ total, visiveis, onClick }) {
  const restantes = total - visiveis;

  if (restantes <= 0) return null;

  return (
    <div className="pt-2 text-center">
      <button onClick={onClick} className="btn-secondary w-full sm:w-auto">
        Ver mais+ ({restantes} restante{restantes === 1 ? "" : "s"})
      </button>
    </div>
  );
}

function extrairMotivosInconsistencia(movimentacao, maquina) {
  const observacoes = String(movimentacao?.observacoes || movimentacao?.observacao || "");
  const linhas = observacoes
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha.startsWith("- "))
    .map((linha) => linha.replace(/^- /, ""));

  if (linhas.length > 0) return linhas;

  return validarInconsistenciasMovimentacao({
    movimentacao,
    maquina,
    validarDeposito: false,
  }).map((item) => item.mensagem);
}

function getMaquinaId(movimentacao) {
  return movimentacao?.maquinaId || movimentacao?.maquina_id || movimentacao?.maquina?.id;
}

function getRetiradaProduto(movimentacao) {
  return toNumber(
    movimentacao?.retiradaProduto ||
      movimentacao?.retirada_produto ||
      movimentacao?.retiradas,
  );
}

function extrairJustificativaInconsistencia(movimentacao) {
  const observacoes = String(movimentacao?.observacoes || movimentacao?.observacao || "");
  const match = observacoes.match(/Justificativa:\s*([\s\S]*)/i);
  return match?.[1]?.trim() || "";
}

function limparBlocoInconsistencia(observacoes = "") {
  return String(observacoes)
    .replace(/\[Inconsistência de Estoque\][\s\S]*$/i, "")
    .trim();
}

function InconsistentMovementCard({
  movimentacao,
  maquina,
  loja,
  onConferir,
  onResolver,
  resolvendo,
}) {
  const motivos = extrairMotivosInconsistencia(movimentacao, maquina);
  const critica = motivos.some((motivo) =>
    /capacidade|negativo|maior que o estoque|total final/i.test(motivo),
  );

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5 ${
        critica ? "border-red-200" : "border-amber-200"
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900">
              {maquina?.codigo || movimentacao?.maquina?.codigo || "Máquina"} -{" "}
              {maquina?.nome || movimentacao?.maquina?.nome || "Não informada"}
            </h3>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                critica
                  ? "border-red-200 bg-red-100 text-red-700"
                  : "border-amber-200 bg-amber-100 text-amber-800"
              }`}
            >
              {critica ? "Crítica" : "Conferência"}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-gray-600">
            🏪 {loja?.nome || movimentacao?.loja?.nome || "Loja não informada"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Data: {formatarData(movimentacao?.dataColeta || movimentacao?.createdAt)}
          </p>
        </div>
        <button onClick={onConferir} className="btn-secondary w-full text-sm sm:w-auto">
          Conferir movimentação
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Total antes", movimentacao?.totalPre],
          ["Abastecidas", movimentacao?.abastecidas],
          ["Saíram", movimentacao?.sairam],
          ["Retirada", getRetiradaProduto(movimentacao)],
          ["Total final", movimentacao?.totalPos],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-bold uppercase text-gray-500">{label}</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{toNumber(value)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg bg-red-50 p-3">
        <p className="text-xs font-bold uppercase text-red-700">
          Motivo da inconsistência
        </p>
        {motivos.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-red-800">
            {motivos.map((motivo, index) => (
              <li key={`${motivo}-${index}`}>- {motivo}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-red-800">
            Movimentação marcada para conferência no cadastro.
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <span>
          Responsável:{" "}
          <span className="font-semibold text-gray-800">
            {movimentacao?.usuario?.nome ||
              movimentacao?.responsavel?.nome ||
              movimentacao?.usuarioNome ||
              "Não informado"}
          </span>
        </span>
        <ResolverAlertaButton onResolver={onResolver} resolvendo={resolvendo} />
      </div>
    </article>
  );
}

function ConferirInconsistenciaModal({ item, onClose }) {
  if (!item) return null;

  const { movimentacao, maquina, loja } = item;
  const motivos = extrairMotivosInconsistencia(movimentacao, maquina);
  const observacaoOriginal = limparBlocoInconsistencia(
    movimentacao?.observacoes || movimentacao?.observacao || "",
  );
  const justificativa = extrairJustificativaInconsistencia(movimentacao);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Conferir movimentação
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {maquina?.codigo || "Máquina"} - {maquina?.nome || "Não informada"} ·{" "}
              {loja?.nome || "Loja não informada"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-red-100 bg-red-50 p-4">
            <p className="text-xs font-bold uppercase text-red-700">
              Motivos detectados
            </p>
            {motivos.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-red-800">
                {motivos.map((motivo, index) => (
                  <li key={`${motivo}-${index}`}>- {motivo}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-red-800">
                Movimentação marcada como inconsistente.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase text-gray-600">
              Observação original
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
              {observacaoOriginal || "Nenhuma observação original informada."}
            </p>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase text-blue-700">
              Justificativa do usuário
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-blue-900">
              {justificativa || "Nenhuma justificativa encontrada nas observações."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="btn-primary">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlertasEstoque() {
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [alertasMaquinas, setAlertasMaquinas] = useState([]);
  const [alertasDeposito, setAlertasDeposito] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState("estoque");
  const [buscaTexto, setBuscaTexto] = useState("");
  const [filtroInconsistenciaLoja, setFiltroInconsistenciaLoja] = useState("");
  const [filtroInconsistenciaMaquina, setFiltroInconsistenciaMaquina] = useState("");
  const [dataInicioInconsistencia, setDataInicioInconsistencia] = useState("");
  const [dataFimInconsistencia, setDataFimInconsistencia] = useState("");
  const [visivelAlertasMaquinas, setVisivelAlertasMaquinas] = useState(
    TAMANHO_PAGINA_ALERTAS,
  );
  const [visivelAlertasDeposito, setVisivelAlertasDeposito] = useState(
    TAMANHO_PAGINA_ALERTAS,
  );
  const [visivelInconsistencias, setVisivelInconsistencias] = useState(
    TAMANHO_PAGINA_ALERTAS,
  );
  const [visivelFinanceiro, setVisivelFinanceiro] = useState(
    TAMANHO_PAGINA_ALERTAS,
  );
  const [movimentacaoConferencia, setMovimentacaoConferencia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alertasFinanceiros, setAlertasFinanceiros] = useState([]);
  const [loadingFinanceiro, setLoadingFinanceiro] = useState(true);
  const [erroFinanceiro, setErroFinanceiro] = useState("");
  const [alertaFinanceiroSelecionado, setAlertaFinanceiroSelecionado] =
    useState(null);
  const [idsInconsistenciaResolvidos, setIdsInconsistenciaResolvidos] =
    useState(new Set());
  const [resolvendoIds, setResolvendoIds] = useState(new Set());

  const carregarLojas = useCallback(async () => {
    const res = await api.get("/lojas");
    return Array.isArray(res.data) ? res.data : res.data?.lojas || [];
  }, []);

  const carregarAlertasMaquinas = useCallback(async (lojaId) => {
    const res = await api.get("/relatorios/alertas-estoque", {
      params: lojaId ? { lojaId } : undefined,
    });
    return Array.isArray(res.data?.alertas) ? res.data.alertas : [];
  }, []);

  const carregarAlertasLoja = useCallback(async (lojaId) => {
    const res = await api.get(`/estoque-lojas/${lojaId}/alertas`);
    return Array.isArray(res.data?.alertas) ? res.data.alertas : [];
  }, []);

  const carregarAlertasDeposito = useCallback(
    async (lojaId, lojasDisponiveis) => {
      if (lojaId) {
        return carregarAlertasLoja(lojaId);
      }

      const respostas = await Promise.allSettled(
        lojasDisponiveis.map((loja) => carregarAlertasLoja(loja.id)),
      );

      return respostas
        .filter((resposta) => resposta.status === "fulfilled")
        .flatMap((resposta) => resposta.value || []);
    },
    [carregarAlertasLoja],
  );

  const carregarDados = useCallback(
    async (lojaIdAtual = "") => {
      try {
        setLoading(true);
        setError("");
        setVisivelAlertasMaquinas(TAMANHO_PAGINA_ALERTAS);
        setVisivelAlertasDeposito(TAMANHO_PAGINA_ALERTAS);

        const lojasCarregadas = await carregarLojas();
        setLojas(lojasCarregadas);

        const [maquinasAlertas, deposito, movimentacoesRes, maquinasRes] =
          await Promise.all([
          carregarAlertasMaquinas(lojaIdAtual),
          carregarAlertasDeposito(lojaIdAtual, lojasCarregadas),
          api.get("/movimentacoes"),
          api.get(lojaIdAtual ? `/maquinas?lojaId=${lojaIdAtual}` : "/maquinas"),
        ]);

        setAlertasMaquinas(ordenarAlertasMaquinas(maquinasAlertas));
        setAlertasDeposito(ordenarAlertasDeposito(deposito));
        setMovimentacoes(Array.isArray(movimentacoesRes.data) ? movimentacoesRes.data : []);
        setMaquinas(Array.isArray(maquinasRes.data) ? maquinasRes.data : []);
      } catch (err) {
        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            "Não foi possível carregar os alertas de estoque. Tente novamente.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      carregarAlertasDeposito,
      carregarAlertasMaquinas,
      carregarLojas,
    ],
  );

  const carregarAlertasFinanceiros = useCallback(async () => {
    try {
      setLoadingFinanceiro(true);
      setErroFinanceiro("");
      setVisivelFinanceiro(TAMANHO_PAGINA_ALERTAS);
      const res = await api.get("/alertas-financeiros");
      setAlertasFinanceiros(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setErroFinanceiro(
        err.response?.data?.error ||
          "Não foi possível carregar os alertas financeiros. Tente novamente.",
      );
    } finally {
      setLoadingFinanceiro(false);
    }
  }, []);

  const carregarIdsInconsistenciaResolvidos = useCallback(async () => {
    try {
      const res = await api.get("/alertas-resolvidos", {
        params: { categoria: "inconsistencia" },
      });
      const ids = Array.isArray(res.data?.alertaIds) ? res.data.alertaIds : [];
      setIdsInconsistenciaResolvidos(new Set(ids));
    } catch (err) {
      console.error("Erro ao carregar inconsistências resolvidas:", err);
    }
  }, []);

  useEffect(() => {
    carregarDados("");
  }, [carregarDados]);

  useEffect(() => {
    carregarAlertasFinanceiros();
  }, [carregarAlertasFinanceiros]);

  useEffect(() => {
    carregarIdsInconsistenciaResolvidos();
  }, [carregarIdsInconsistenciaResolvidos]);

  useEffect(() => {
    setVisivelInconsistencias(TAMANHO_PAGINA_ALERTAS);
  }, [
    filtroInconsistenciaLoja,
    filtroInconsistenciaMaquina,
    dataInicioInconsistencia,
    dataFimInconsistencia,
    buscaTexto,
  ]);

  useEffect(() => {
    setVisivelAlertasMaquinas(TAMANHO_PAGINA_ALERTAS);
    setVisivelAlertasDeposito(TAMANHO_PAGINA_ALERTAS);
    setVisivelFinanceiro(TAMANHO_PAGINA_ALERTAS);
  }, [buscaTexto]);

  const buscaNormalizada = buscaTexto.trim().toLowerCase();

  const resolverAlerta = useCallback(
    async (alerta, aoRemover) => {
      if (!alerta?.alertaId || !alerta?.categoria) return;
      if (resolvendoIds.has(alerta.alertaId)) return;

      setResolvendoIds((prev) => new Set(prev).add(alerta.alertaId));
      try {
        await api.post("/alertas-resolvidos", {
          alertaId: alerta.alertaId,
          categoria: alerta.categoria,
        });
        aoRemover(alerta.alertaId);
      } catch (err) {
        setError(
          err.response?.data?.error ||
            "Erro ao marcar alerta como resolvido. Tente novamente.",
        );
      } finally {
        setResolvendoIds((prev) => {
          const next = new Set(prev);
          next.delete(alerta.alertaId);
          return next;
        });
      }
    },
    [resolvendoIds],
  );

  const handleTrocarLoja = (event) => {
    const lojaId = event.target.value;
    setLojaSelecionada(lojaId);
    carregarDados(lojaId);
  };

  const alertasMaquinasFiltrados = useMemo(
    () =>
      alertasMaquinas.filter((alerta) =>
        alertaMaquinaCombinaBusca(alerta, buscaNormalizada),
      ),
    [alertasMaquinas, buscaNormalizada],
  );

  const alertasDepositoFiltrados = useMemo(
    () =>
      alertasDeposito.filter((alerta) =>
        alertaDepositoCombinaBusca(alerta, buscaNormalizada),
      ),
    [alertasDeposito, buscaNormalizada],
  );

  const alertasFinanceirosFiltrados = useMemo(
    () =>
      alertasFinanceiros.filter((alerta) =>
        alertaFinanceiroCombinaBusca(alerta, buscaNormalizada),
      ),
    [alertasFinanceiros, buscaNormalizada],
  );

  const resumo = useMemo(() => {
    const contagemPorNivel = alertasMaquinasFiltrados.reduce(
      (acc, alerta) => {
        const nivel = normalizarNivel(alerta?.nivelAlerta);
        if (nivel.includes("CR")) acc.criticos += 1;
        else if (nivel === "ALTO") acc.altos += 1;
        else acc.medios += 1;
        return acc;
      },
      { criticos: 0, altos: 0, medios: 0 },
    );

    return {
      total: alertasMaquinasFiltrados.length + alertasDepositoFiltrados.length,
      criticos: contagemPorNivel.criticos,
      altos: contagemPorNivel.altos,
      medios: contagemPorNivel.medios + alertasDepositoFiltrados.length,
    };
  }, [alertasDepositoFiltrados, alertasMaquinasFiltrados]);

  const stats = [
    {
      label: "Total de alertas",
      value: resumo.total,
      icon: "🚨",
      gradient: "bg-gradient-to-br from-blue-600 to-blue-700",
    },
    {
      label: "Alertas críticos",
      value: resumo.criticos,
      icon: "⛔",
      gradient: "bg-gradient-to-br from-red-600 to-red-700",
    },
    {
      label: "Alertas altos",
      value: resumo.altos,
      icon: "⚠️",
      gradient: "bg-gradient-to-br from-orange-500 to-orange-600",
    },
    {
      label: "Alertas médios",
      value: resumo.medios,
      subtitle: "Inclui alertas de depósito",
      icon: "📦",
      gradient: "bg-gradient-to-br from-amber-500 to-yellow-500",
    },
  ];

  const semAlertas =
    !loading &&
    !error &&
    alertasMaquinasFiltrados.length === 0 &&
    alertasDepositoFiltrados.length === 0;

  const alertasMaquinasVisiveis = alertasMaquinasFiltrados.slice(
    0,
    visivelAlertasMaquinas,
  );

  const alertasDepositoVisiveis = alertasDepositoFiltrados.slice(
    0,
    visivelAlertasDeposito,
  );

  const maquinasPorId = useMemo(() => {
    const map = new Map();
    maquinas.forEach((maquina) => map.set(String(maquina.id), maquina));
    return map;
  }, [maquinas]);

  const lojasPorId = useMemo(() => {
    const map = new Map();
    lojas.forEach((loja) => map.set(String(loja.id), loja));
    return map;
  }, [lojas]);

  const maquinasFiltroInconsistencia = useMemo(() => {
    if (!filtroInconsistenciaLoja) return maquinas;
    return maquinas.filter(
      (maquina) =>
        String(maquina?.lojaId || maquina?.loja_id || "") ===
        String(filtroInconsistenciaLoja),
    );
  }, [filtroInconsistenciaLoja, maquinas]);

  const movimentacoesInconsistentes = useMemo(() => {
    return movimentacoes
      .filter(isMovimentacaoInconsistente)
      .filter(
        (movimentacao) =>
          !idsInconsistenciaResolvidos.has(`inconsistencia:${movimentacao.id}`),
      )
      .filter((movimentacao) => {
        const maquina = maquinasPorId.get(String(getMaquinaId(movimentacao)));
        const lojaId = maquina?.lojaId || maquina?.loja_id || movimentacao?.lojaId;
        const dataMovimentacao = new Date(
          movimentacao?.dataColeta || movimentacao?.createdAt || 0,
        );

        if (
          filtroInconsistenciaLoja &&
          String(lojaId) !== String(filtroInconsistenciaLoja)
        ) {
          return false;
        }

        if (
          filtroInconsistenciaMaquina &&
          String(getMaquinaId(movimentacao)) !== String(filtroInconsistenciaMaquina)
        ) {
          return false;
        }

        if (dataInicioInconsistencia) {
          const inicio = new Date(`${dataInicioInconsistencia}T00:00:00`);
          if (dataMovimentacao < inicio) return false;
        }

        if (dataFimInconsistencia) {
          const fim = new Date(`${dataFimInconsistencia}T23:59:59`);
          if (dataMovimentacao > fim) return false;
        }

        if (buscaNormalizada) {
          const loja = lojasPorId.get(String(lojaId));
          if (
            !movimentacaoCombinaBusca(movimentacao, maquina, loja, buscaNormalizada)
          ) {
            return false;
          }
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b?.dataColeta || b?.createdAt || 0) -
          new Date(a?.dataColeta || a?.createdAt || 0),
      );
  }, [
    buscaNormalizada,
    dataFimInconsistencia,
    dataInicioInconsistencia,
    filtroInconsistenciaLoja,
    filtroInconsistenciaMaquina,
    idsInconsistenciaResolvidos,
    lojasPorId,
    maquinasPorId,
    movimentacoes,
  ]);

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Alertas de Estoque"
          subtitle="Monitore máquinas e estoques de loja abaixo do limite mínimo."
          icon="🚨"
          action={
            <button
              onClick={() => carregarDados(lojaSelecionada)}
              disabled={loading}
              className="btn-primary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              <span className={loading ? "animate-spin" : ""}>🔄</span>
              Atualizar
            </button>
          }
        />

        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm sm:flex-row">
          <button
            onClick={() => setAbaAtiva("estoque")}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold transition ${
              abaAtiva === "estoque"
                ? "bg-blue-600 text-white shadow"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            Alertas de estoque
          </button>
          <button
            onClick={() => setAbaAtiva("inconsistencias")}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold transition ${
              abaAtiva === "inconsistencias"
                ? "bg-red-600 text-white shadow"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            Movimentações Inconsistentes
          </button>
          <button
            onClick={() => setAbaAtiva("financeiro")}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold transition ${
              abaAtiva === "financeiro"
                ? "bg-amber-600 text-white shadow"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            💰 Alertas Financeiros
            {alertasFinanceiros.length > 0 && (
              <span
                className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                  abaAtiva === "financeiro"
                    ? "bg-white/20 text-white"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {alertasFinanceiros.length}
              </span>
            )}
          </button>
        </div>

        <div className="mb-6">
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span>🔎</span>
            Buscar por loja ou máquina
          </label>
          <div className="relative">
            <input
              type="text"
              value={buscaTexto}
              onChange={(event) => setBuscaTexto(event.target.value)}
              placeholder="Digite o nome da loja, o nome ou o código da máquina..."
              className="input-field pr-10"
            />
            {buscaTexto && (
              <button
                type="button"
                onClick={() => setBuscaTexto("")}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {abaAtiva === "estoque" ? (
          <>
        <div className="card-gradient mb-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <span>🏪</span>
                Filtrar por loja
              </label>
              <select
                value={lojaSelecionada}
                onChange={handleTrocarLoja}
                disabled={loading}
                className="select-field"
              >
                <option value="">Todas as lojas</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {getLojaNome(loja)}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm text-gray-600">
              <span className="font-semibold text-gray-800">Depósito:</span>{" "}
              {lojaSelecionada
                ? "consulta a loja selecionada"
                : "consulta todas as lojas individualmente"}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 space-y-4">
            <AlertBox type="error" message={error} />
            <button onClick={() => carregarDados(lojaSelecionada)} className="btn-secondary">
              Tentar novamente
            </button>
          </div>
        )}

        <StatsGrid stats={stats} />

        {loading && alertasMaquinasFiltrados.length === 0 && alertasDepositoFiltrados.length === 0 ? (
          <div className="card">
            <LoadingSpinner message="Carregando alertas de estoque..." />
            <AlertasSkeleton />
          </div>
        ) : semAlertas ? (
          <EmptyState
            icon="✅"
            title="Nenhum alerta de estoque no momento."
            message="Todas as máquinas e depósitos estão dentro dos limites configurados."
          />
        ) : (
          <div className="space-y-8">
            {loading && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                Atualizando alertas...
              </div>
            )}

            <section className="card-gradient">
              <SectionHeader
                icon="🎮"
                title="Máquinas com estoque baixo"
                total={alertasMaquinasFiltrados.length}
                subtitle="Mais recente primeiro."
              />
              {alertasMaquinasFiltrados.length > 0 ? (
                <div className="space-y-4">
                  {alertasMaquinasVisiveis.map((alerta, index) => (
                    <MachineAlertCard
                      key={alerta?.alertaId || `${alerta?.maquina?.id || "maquina"}-${index}`}
                      alerta={alerta}
                      resolvendo={resolvendoIds.has(alerta?.alertaId)}
                      onResolver={() =>
                        resolverAlerta(alerta, (id) =>
                          setAlertasMaquinas((prev) =>
                            prev.filter((a) => a.alertaId !== id),
                          ),
                        )
                      }
                    />
                  ))}
                  <VerMaisAlertasButton
                    total={alertasMaquinasFiltrados.length}
                    visiveis={alertasMaquinasVisiveis.length}
                    onClick={() =>
                      setVisivelAlertasMaquinas((v) => v + TAMANHO_PAGINA_ALERTAS)
                    }
                  />
                </div>
              ) : (
                <SectionEmpty message="Nenhuma máquina com estoque baixo para o filtro selecionado." />
              )}
            </section>

            <section className="card-gradient">
              <SectionHeader
                icon="📦"
                title="Estoque baixo no depósito/loja"
                total={alertasDepositoFiltrados.length}
                subtitle="Mais recente primeiro."
              />
              {alertasDepositoFiltrados.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {alertasDepositoVisiveis.map((alerta, index) => (
                      <StoreAlertCard
                        key={alerta?.alertaId || `${alerta?.loja?.id || "loja"}-${alerta?.produto?.id || "produto"}-${index}`}
                        alerta={alerta}
                        resolvendo={resolvendoIds.has(alerta?.alertaId)}
                        onResolver={() =>
                          resolverAlerta(alerta, (id) =>
                            setAlertasDeposito((prev) =>
                              prev.filter((a) => a.alertaId !== id),
                            ),
                          )
                        }
                      />
                    ))}
                  </div>
                  <VerMaisAlertasButton
                    total={alertasDepositoFiltrados.length}
                    visiveis={alertasDepositoVisiveis.length}
                    onClick={() =>
                      setVisivelAlertasDeposito((v) => v + TAMANHO_PAGINA_ALERTAS)
                    }
                  />
                </div>
              ) : (
                <SectionEmpty message="Nenhum alerta de depósito para o filtro selecionado." />
              )}
            </section>
          </div>
        )}
          </>
        ) : abaAtiva === "inconsistencias" ? (
          <div className="space-y-6">
            <div className="card-gradient">
              <SectionHeader
                icon="🧾"
                title="Movimentações Inconsistentes"
                total={movimentacoesInconsistentes.length}
                subtitle="Movimentações que podem indicar erro de lançamento, diferença física no estoque ou necessidade de conferência."
              />

              <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
                <span className="font-bold">Ação esperada:</span> conferir ou
                corrigir a movimentação. Estes registros não são alertas de
                reabastecimento.
              </div>

              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Loja
                  </label>
                  <select
                    value={filtroInconsistenciaLoja}
                    onChange={(event) => {
                      setFiltroInconsistenciaLoja(event.target.value);
                      setFiltroInconsistenciaMaquina("");
                    }}
                    className="select-field"
                  >
                    <option value="">Todas as lojas</option>
                    {lojas.map((loja) => (
                      <option key={loja.id} value={loja.id}>
                        {getLojaNome(loja)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Máquina
                  </label>
                  <select
                    value={filtroInconsistenciaMaquina}
                    onChange={(event) =>
                      setFiltroInconsistenciaMaquina(event.target.value)
                    }
                    className="select-field"
                  >
                    <option value="">Todas as máquinas</option>
                    {maquinasFiltroInconsistencia.map((maquina) => (
                      <option key={maquina.id} value={maquina.id}>
                        {maquina.codigo} - {maquina.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Data inicial
                  </label>
                  <input
                    type="date"
                    value={dataInicioInconsistencia}
                    onChange={(event) =>
                      setDataInicioInconsistencia(event.target.value)
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Data final
                  </label>
                  <input
                    type="date"
                    value={dataFimInconsistencia}
                    onChange={(event) =>
                      setDataFimInconsistencia(event.target.value)
                    }
                    className="input-field"
                  />
                </div>
              </div>

              {loading ? (
                <AlertasSkeleton />
              ) : movimentacoesInconsistentes.length > 0 ? (
                <div className="space-y-4">
                  {movimentacoesInconsistentes
                    .slice(0, visivelInconsistencias)
                    .map((movimentacao) => {
                    const maquina = maquinasPorId.get(
                      String(getMaquinaId(movimentacao)),
                    );
                    const lojaId =
                      maquina?.lojaId || maquina?.loja_id || movimentacao?.lojaId;
                    const loja = lojasPorId.get(String(lojaId));
                    const alertaInconsistencia = {
                      alertaId: `inconsistencia:${movimentacao.id}`,
                      categoria: "inconsistencia",
                    };

                    return (
                      <InconsistentMovementCard
                        key={movimentacao.id}
                        movimentacao={movimentacao}
                        maquina={maquina}
                        loja={loja}
                        onConferir={() =>
                          setMovimentacaoConferencia({
                            movimentacao,
                            maquina,
                            loja,
                          })
                        }
                        resolvendo={resolvendoIds.has(alertaInconsistencia.alertaId)}
                        onResolver={() =>
                          resolverAlerta(alertaInconsistencia, (id) =>
                            setIdsInconsistenciaResolvidos((prev) =>
                              new Set(prev).add(id),
                            ),
                          )
                        }
                      />
                    );
                  })}
                  <VerMaisAlertasButton
                    total={movimentacoesInconsistentes.length}
                    visiveis={Math.min(
                      visivelInconsistencias,
                      movimentacoesInconsistentes.length,
                    )}
                    onClick={() =>
                      setVisivelInconsistencias(
                        (v) => v + TAMANHO_PAGINA_ALERTAS,
                      )
                    }
                  />
                </div>
              ) : (
                <SectionEmpty message="Nenhuma movimentação inconsistente encontrada." />
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="card-gradient">
              <SectionHeader
                icon="💰"
                title="Alertas Financeiros"
                total={alertasFinanceirosFiltrados.length}
                subtitle="Divergências entre o valor esperado (contador IN x valor da ficha) e o valor preenchido na bag/Machine Pay ao concluir o financeiro."
              />

              <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
                <span className="font-bold">Ação esperada:</span> conferir a
                contagem da bag e o fechamento na Machine Pay desta máquina.
                Estes alertas são gerados automaticamente ao preencher o
                financeiro de movimentações com retirada de dinheiro.
              </div>

              {erroFinanceiro && (
                <div className="mb-6 space-y-4">
                  <AlertBox type="error" message={erroFinanceiro} />
                  <button onClick={carregarAlertasFinanceiros} className="btn-secondary">
                    Tentar novamente
                  </button>
                </div>
              )}

              {loadingFinanceiro ? (
                <AlertasSkeleton />
              ) : alertasFinanceirosFiltrados.length > 0 ? (
                <div className="space-y-4">
                  {alertasFinanceirosFiltrados.slice(0, visivelFinanceiro).map((alerta) => (
                    <FinanceiroAlertCard
                      key={alerta.alertaId || alerta.movimentacaoId}
                      alerta={alerta}
                      onClick={() => setAlertaFinanceiroSelecionado(alerta)}
                      resolvendo={resolvendoIds.has(alerta?.alertaId)}
                      onResolver={() =>
                        resolverAlerta(alerta, (id) =>
                          setAlertasFinanceiros((prev) =>
                            prev.filter((a) => a.alertaId !== id),
                          ),
                        )
                      }
                    />
                  ))}
                  <VerMaisAlertasButton
                    total={alertasFinanceirosFiltrados.length}
                    visiveis={Math.min(visivelFinanceiro, alertasFinanceirosFiltrados.length)}
                    onClick={() =>
                      setVisivelFinanceiro((v) => v + TAMANHO_PAGINA_ALERTAS)
                    }
                  />
                </div>
              ) : (
                <SectionEmpty message="Nenhuma divergência financeira encontrada nas movimentações com bag." />
              )}
            </div>
          </div>
        )}
      </main>

      <ConferirInconsistenciaModal
        item={movimentacaoConferencia}
        onClose={() => setMovimentacaoConferencia(null)}
      />

      <ConferirAlertaFinanceiroModal
        alerta={alertaFinanceiroSelecionado}
        onClose={() => setAlertaFinanceiroSelecionado(null)}
      />

      <Footer />
    </div>
  );
}

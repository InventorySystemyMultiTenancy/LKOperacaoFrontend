import { Fragment, useEffect, useState } from "react";
import api from "../services/api";

// Resultado por loja: receita, custo das pelúcias (custo das compras),
// comissão e lucro líquido. Mesma conta no Financeiro, Relatórios e Gráficos.

const reais = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v) => `${Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

// Séries na ordem fixa da paleta categórica (validada)
const SERIES = [
  { campo: "custoProdutos", rotulo: "Custo das pelúcias", cor: "#2a78d6" },
  { campo: "comissao", rotulo: "Comissão do ponto", cor: "#eb6834" },
  { campo: "lucroLiquido", rotulo: "Lucro líquido", cor: "#1baf7a" },
];

const isoLocal = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const periodoMes = (deslocamento = 0) => {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() + deslocamento, 1);
  const fim = deslocamento === 0 ? hoje : new Date(hoje.getFullYear(), hoje.getMonth() + deslocamento + 1, 0);
  return { dataInicio: isoLocal(inicio), dataFim: isoLocal(fim) };
};

function Barra({ loja }) {
  const [hover, setHover] = useState(null);
  const base = Math.max(loja.receita, loja.custoProdutos + loja.comissao, 0.01);
  const partes = SERIES.map((s) => ({ ...s, valor: Math.max(0, loja[s.campo]) })).filter((s) => s.valor > 0);
  return (
    <div className="relative">
      <div className="flex h-5 w-full gap-[2px] rounded bg-gray-100">
        {partes.map((s, i) => (
          <div
            key={s.campo}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(null)}
            className={`h-full ${i === 0 ? "rounded-l" : ""} ${i === partes.length - 1 ? "rounded-r" : ""}`}
            style={{ width: `${(s.valor / base) * 100}%`, backgroundColor: s.cor, minWidth: 3 }}
          />
        ))}
      </div>
      {hover && (
        <div className="absolute z-10 -top-9 left-0 rounded-md bg-gray-900 px-2 py-1 text-xs text-white whitespace-nowrap shadow">
          {hover.rotulo}: <b>{reais(hover.valor)}</b> ({pct(loja.receita ? (hover.valor / loja.receita) * 100 : 0)} da receita)
        </div>
      )}
    </div>
  );
}

export function ResultadoLojas({ titulo = "Resultado por loja", compacto = false }) {
  const [periodo, setPeriodo] = useState(periodoMes(0));
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aberta, setAberta] = useState(null);
  const [verTabela, setVerTabela] = useState(!compacto);

  useEffect(() => {
    let ativo = true;
    api
      .get("/relatorios/resultado-lojas", { params: periodo })
      .then((r) => {
        if (!ativo) return;
        setErro("");
        setDados(r.data);
      })
      .catch((e) => ativo && setErro(e.response?.data?.error || "Erro ao calcular o resultado por loja"));
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const t = dados?.totais;
  const semCusto = dados?.lojas?.some((l) => l.premiosSemCusto > 0 || l.custoEstimado);

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">💹 {titulo}</h2>
          <p className="text-sm text-gray-600">Receita − custo das pelúcias (preço de compra) − comissão = lucro líquido</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" className="px-3 py-1.5 rounded-lg text-sm font-semibold border-2 border-primary/30 text-primary hover:border-primary" onClick={() => setPeriodo(periodoMes(0))}>
            Este mês
          </button>
          <button type="button" className="px-3 py-1.5 rounded-lg text-sm font-semibold border-2 border-primary/30 text-primary hover:border-primary" onClick={() => setPeriodo(periodoMes(-1))}>
            Mês passado
          </button>
          <input type="date" className="input-field w-auto py-1.5 text-sm" value={periodo.dataInicio} max={periodo.dataFim} onChange={(e) => e.target.value && setPeriodo((p) => ({ ...p, dataInicio: e.target.value }))} />
          <input type="date" className="input-field w-auto py-1.5 text-sm" value={periodo.dataFim} min={periodo.dataInicio} onChange={(e) => e.target.value && setPeriodo((p) => ({ ...p, dataFim: e.target.value }))} />
        </div>
      </div>

      {erro && <p className="text-sm font-semibold text-red-700">{erro}</p>}
      {!dados && !erro && <p className="text-sm text-gray-500">Calculando...</p>}

      {t && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ["Receita", t.receita, null],
              ["Custo das pelúcias", t.custoProdutos, `${t.premios} prêmios`],
              ["Comissão dos pontos", t.comissao, null],
              ["Lucro líquido", t.lucroLiquido, `margem ${pct(t.margem)}`],
            ].map(([rotulo, valor, detalhe]) => (
              <div key={rotulo} className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase text-gray-500">{rotulo}</p>
                <p className={`text-xl font-extrabold ${rotulo === "Lucro líquido" && valor < 0 ? "text-red-700" : "text-gray-900"}`}>{reais(valor)}</p>
                {detalhe && <p className="text-xs text-gray-500">{detalhe}</p>}
              </div>
            ))}
          </div>

          {semCusto && (
            <p className="text-xs rounded-lg bg-yellow-50 border border-yellow-300 text-yellow-900 px-3 py-2">
              ⚠️ Alguns prêmios estão sem custo de compra (usando o preço do produto ou sem produto informado). Registre as compras na aba Compras para o custo ficar exato.
            </p>
          )}

          {dados.lojas.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma coleta no período.</p>
          ) : (
            <>
              {/* Para onde vai a receita de cada loja */}
              <div>
                <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-700">
                  {SERIES.map((s) => (
                    <span key={s.campo} className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: s.cor }} />
                      {s.rotulo}
                    </span>
                  ))}
                </div>
                <div className="space-y-3">
                  {dados.lojas.map((l) => (
                    <div key={l.lojaId} className="grid grid-cols-[minmax(110px,180px)_1fr_auto] items-center gap-3">
                      <span className="text-sm font-semibold text-gray-800 truncate" title={l.nome}>
                        {l.nome}
                      </span>
                      <Barra loja={l} />
                      <span className={`text-sm font-bold ${l.lucroLiquido < 0 ? "text-red-700" : "text-gray-900"}`}>{reais(l.lucroLiquido)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button type="button" onClick={() => setVerTabela((v) => !v)} className="text-sm font-semibold text-primary">
                {verTabela ? "▲ Esconder tabela" : "▼ Ver tabela por loja e máquina"}
              </button>

              {verTabela && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-gray-500">
                        <th className="py-2 pr-2">Loja</th>
                        <th className="py-2 pr-2 text-right">Receita</th>
                        <th className="py-2 pr-2 text-right">Prêmios</th>
                        <th className="py-2 pr-2 text-right">Custo pelúcias</th>
                        <th className="py-2 pr-2 text-right">Comissão</th>
                        <th className="py-2 pr-2 text-right">Lucro líquido</th>
                        <th className="py-2 text-right">Margem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.lojas.map((l) => (
                        <Fragment key={l.lojaId}>
                          <tr className="border-b cursor-pointer hover:bg-gray-50" onClick={() => setAberta(aberta === l.lojaId ? null : l.lojaId)}>
                            <td className="py-2 pr-2 font-semibold">
                              {aberta === l.lojaId ? "▾" : "▸"} {l.nome}
                              {l.percentualComissao > 0 && <span className="ml-1 text-xs text-gray-500">({pct(l.percentualComissao)})</span>}
                            </td>
                            <td className="py-2 pr-2 text-right">{reais(l.receita)}</td>
                            <td className="py-2 pr-2 text-right">{l.premios}</td>
                            <td className="py-2 pr-2 text-right">
                              {reais(l.custoProdutos)}
                              {(l.custoEstimado || l.premiosSemCusto > 0) && <span title="Custo estimado ou incompleto"> ⚠️</span>}
                            </td>
                            <td className="py-2 pr-2 text-right">{reais(l.comissao)}</td>
                            <td className={`py-2 pr-2 text-right font-bold ${l.lucroLiquido < 0 ? "text-red-700" : ""}`}>{reais(l.lucroLiquido)}</td>
                            <td className="py-2 text-right">{pct(l.margem)}</td>
                          </tr>
                          {aberta === l.lojaId &&
                            l.maquinas.map((m) => (
                              <tr key={m.maquinaId} className="border-b bg-gray-50 text-gray-600">
                                <td className="py-1.5 pr-2 pl-6">{m.nome}</td>
                                <td className="py-1.5 pr-2 text-right">{reais(m.receita)}</td>
                                <td className="py-1.5 pr-2 text-right">{m.premios}</td>
                                <td className="py-1.5 pr-2 text-right">{reais(m.custoProdutos)}</td>
                                <td className="py-1.5 pr-2 text-right">{reais(m.comissao)}</td>
                                <td className={`py-1.5 pr-2 text-right ${m.lucroLiquido < 0 ? "text-red-700" : ""}`}>{reais(m.lucroLiquido)}</td>
                                <td className="py-1.5 text-right">{pct(m.margem)}</td>
                              </tr>
                            ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

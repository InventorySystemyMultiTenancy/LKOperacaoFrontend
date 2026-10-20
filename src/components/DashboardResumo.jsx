import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

const reais = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const nomeMes = (mes) => {
  if (!mes) return "";
  const [a, m] = mes.split("-").map(Number);
  const nome = new Date(a, m - 1, 1).toLocaleString("pt-BR", { month: "long" });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}/${a}`;
};

function Valor({ titulo, valor, detalhe, destaque }) {
  return (
    <div className={`rounded-xl p-4 ${destaque ? "bg-white/20 ring-2 ring-accent-yellow" : "bg-white/10"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-90">{titulo}</p>
      <p className={`font-extrabold mt-1 ${destaque ? "text-3xl text-white drop-shadow" : "text-2xl"}`}>{reais(valor)}</p>
      {detalhe && <p className="text-xs opacity-80 mt-1">{detalhe}</p>}
    </div>
  );
}

// Boxes do topo do Dashboard: valores do mês, manutenções, movimentações,
// alertas de estoque e top máquinas/produtos.
export function DashboardResumo({ podeManutencoes, podeMovimentacoes, podeCarrinhos, alertasEstoque }) {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    api
      .get("/dashboard/resumo")
      .then((res) => setDados(res.data))
      .catch(() => setDados({ manutencoes: { abertas: 0 } }));
  }, []);

  const v = dados?.valores;
  const abertas = dados?.manutencoes?.abertas || 0;
  const pendentes = dados?.manutencoes?.pendentes || 0;
  const top = dados?.top;

  return (
    <div className="space-y-4 md:space-y-6 mb-8">
      {/* Valores do mês */}
      {v && (
        <div className="rounded-2xl p-5 sm:p-6 text-white shadow-lg bg-linear-to-br from-primary to-primary-dark border-b-4 border-accent-yellow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">💰 Valores do mês</h2>
            <span className="text-sm font-semibold bg-white/15 px-3 py-1 rounded-full">{nomeMes(dados.mes)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Valor titulo="Vendas no mês" valor={v.vendasMes} detalhe="Machine Pay + dinheiro físico" destaque />
            <Valor
              titulo="Machine Pay (entrada)"
              valor={v.machinePay}
              detalhe={
                v.machinePayFonte === "monitor"
                  ? "PIX e cartão de todas as máquinas"
                  : "PIX e cartão lançados nas coletas"
              }
            />
            <Valor titulo="Dinheiro físico" valor={v.dinheiroFisico} detalhe="Notas, moedas e fichas das coletas" />
            <Valor titulo="Gasto variável" valor={v.gastoVariavel} detalhe="Gastos dos roteiros no mês" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Manutenções */}
        {podeManutencoes && (
          <Link
            to="/manutencoes"
            className={`relative rounded-2xl p-5 shadow-md text-white transition-transform hover:-translate-y-1 ${
              abertas ? "bg-linear-to-br from-red-500 to-red-700" : "bg-linear-to-br from-primary-light to-primary"
            }`}
          >
            {abertas > 0 && (
              <span className="absolute top-3 right-3 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-yellow opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-accent-yellow" />
              </span>
            )}
            <p className="text-4xl">🛠️</p>
            <p className="text-xl font-bold mt-2">Manutenções</p>
            <p className="text-sm opacity-90 mt-1">
              {abertas
                ? `⚠️ ${pendentes} pendente(s) · ${abertas - pendentes} em andamento`
                : "Nenhuma manutenção pendente"}
            </p>
          </Link>
        )}

        {/* Movimentações */}
        {podeMovimentacoes && (
          <div className="rounded-2xl p-5 shadow-md text-primary-dark bg-accent-yellow flex flex-col">
            <p className="text-4xl">📋</p>
            <p className="text-xl font-bold mt-2">Movimentações</p>
            <p className="text-sm opacity-80 mt-1">Controle de arrecadação e roteiros</p>
            <div className="mt-auto pt-3 flex flex-wrap gap-2">
              <Link to="/movimentacoes" className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-dark">
                ➕ Nova movimentação
              </Link>
              {podeCarrinhos && (
                <Link to="/carrinhos" className="px-4 py-2 rounded-xl bg-white/70 font-bold text-sm hover:bg-white">
                  🛒 Carrinhos
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Alertas de estoque */}
        {alertasEstoque && (
          <button
            type="button"
            onClick={() =>
              document.getElementById("alertas-estoque-maquinas")?.scrollIntoView({ behavior: "smooth" })
            }
            className={`text-left rounded-2xl p-5 shadow-md text-white transition-transform hover:-translate-y-1 ${
              alertasEstoque.total ? "bg-linear-to-br from-orange-500 to-red-600" : "bg-linear-to-br from-green-500 to-green-700"
            }`}
          >
            <p className="text-4xl">🚨</p>
            <p className="text-xl font-bold mt-2">Alertas de Estoque</p>
            <p className="text-3xl font-extrabold mt-1">{alertasEstoque.total}</p>
            <p className="text-sm opacity-90">
              ⚠️ {alertasEstoque.maquinas} máquinas · 🏪 {alertasEstoque.lojas} lojas
            </p>
          </button>
        )}
      </div>

      {/* Top */}
      {top && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">🏆 Top do mês</h2>
            <span className="text-sm text-gray-500">{nomeMes(dados.mes)}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-bold text-primary mb-2">Máquinas que mais vendem</p>
              {top.maquinas.length === 0 && <p className="text-sm text-gray-500">Sem coletas no mês.</p>}
              <ol className="space-y-2">
                {top.maquinas.map((m, i) => (
                  <li key={m.maquinaId} className="flex items-center gap-3">
                    <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-extrabold ${i === 0 ? "bg-accent-yellow text-primary-dark" : "bg-primary/10 text-primary"}`}>
                      {i + 1}
                    </span>
                    <Link to={`/maquinas/${m.maquinaId}`} className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{m.nome}</p>
                      {m.loja && <p className="text-xs text-gray-500 truncate">{m.loja}</p>}
                    </Link>
                    <span className="font-bold text-primary-dark">{reais(m.total)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-sm font-bold text-primary mb-2">Produtos que mais saem</p>
              {top.produtos.length === 0 && <p className="text-sm text-gray-500">Sem saídas de pelúcias no mês.</p>}
              <ol className="space-y-2">
                {top.produtos.map((p, i) => (
                  <li key={p.produtoId} className="flex items-center gap-3">
                    <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-extrabold ${i === 0 ? "bg-accent-yellow text-primary-dark" : "bg-primary/10 text-primary"}`}>
                      {i + 1}
                    </span>
                    <span className="text-xl">{p.emoji}</span>
                    <p className="flex-1 font-semibold truncate">{p.nome}</p>
                    <span className="font-bold text-primary-dark">{p.quantidade} un.</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

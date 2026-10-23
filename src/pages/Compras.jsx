import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { ComprasAbas } from "../components/ComprasAbas";

const reais = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
const hojeISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const itemVazio = () => ({ chave: Math.random().toString(36).slice(2), produtoId: "", quantidade: "", custoUnitario: "", lojaId: "" });

// ---------------------------------------------------------------------------
// Nova compra
// ---------------------------------------------------------------------------
function NovaCompra({ produtos, lojas, fornecedores, precos, recarregar, inicial, onSalva }) {
  const [fornecedorId, setFornecedorId] = useState("");
  const [fornecedorNovo, setFornecedorNovo] = useState("");
  const [data, setData] = useState(hojeISO());
  const [observacao, setObservacao] = useState("");
  const [destinoPadrao, setDestinoPadrao] = useState("");
  const [itens, setItens] = useState([itemVazio()]);
  const [listaId, setListaId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Pré-preenchimento: "comprar de novo" ou lista de reposição
  useEffect(() => {
    if (!inicial) return;
    setFornecedorId(inicial.fornecedorId || "");
    setFornecedorNovo("");
    setObservacao(inicial.observacao || "");
    setListaId(inicial.listaId || null);
    setItens(
      inicial.itens.map((i) => ({
        ...itemVazio(),
        produtoId: i.produtoId,
        quantidade: String(i.quantidade),
        custoUnitario: i.custoUnitario !== undefined && i.custoUnitario !== null ? String(i.custoUnitario) : "",
        lojaId: i.lojaId || "",
      })),
    );
  }, [inicial]);

  const precoSugerido = (produtoId, forn = fornecedorId) => {
    const doFornecedor = precos.find((p) => p.produtoId === produtoId && (p.fornecedorId || "") === (forn || ""));
    if (doFornecedor) return doFornecedor.custoUnitario;
    const qualquer = precos.find((p) => p.produtoId === produtoId);
    if (qualquer) return qualquer.custoUnitario;
    const produto = produtos.find((p) => p.id === produtoId);
    return Number(produto?.custoUnitario) || "";
  };

  // Itens sem preço digitado recebem o último preço do fornecedor escolhido
  useEffect(() => {
    setItens((atual) =>
      atual.map((i) => (i.produtoId && i.custoUnitario === "" ? { ...i, custoUnitario: String(precoSugerido(i.produtoId) || "") } : i)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fornecedorId, precos]);

  const alterar = (chave, campo, valor) =>
    setItens((atual) =>
      atual.map((i) => {
        if (i.chave !== chave) return i;
        const novo = { ...i, [campo]: valor };
        if (campo === "produtoId") novo.custoUnitario = String(precoSugerido(valor) || "");
        return novo;
      }),
    );

  const ultimosDoFornecedor = precos.filter((p) => fornecedorId && p.fornecedorId === fornecedorId);
  const total = itens.reduce((s, i) => s + num(i.quantidade) * num(i.custoUnitario), 0);

  const adicionarDoCatalogo = (p) =>
    setItens((atual) => [
      ...atual.filter((i) => i.produtoId),
      { ...itemVazio(), produtoId: p.produtoId, quantidade: String(p.quantidade || 1), custoUnitario: String(p.custoUnitario), lojaId: destinoPadrao },
    ]);

  const salvar = async () => {
    setErro("");
    const validos = itens.filter((i) => i.produtoId);
    if (!validos.length) return setErro("Adicione pelo menos um produto.");
    if (validos.some((i) => num(i.quantidade) < 1)) return setErro("Informe a quantidade de todos os produtos.");
    setSalvando(true);
    try {
      const { data: compra } = await api.post("/compras", {
        fornecedorId: fornecedorId || undefined,
        fornecedorNome: fornecedorId ? undefined : fornecedorNovo,
        data,
        observacao,
        itens: validos.map((i) => ({
          produtoId: i.produtoId,
          quantidade: Math.trunc(num(i.quantidade)),
          custoUnitario: num(i.custoUnitario),
          lojaId: i.lojaId || null,
        })),
      });
      if (listaId) await api.delete(`/lista-compras-pendentes/${listaId}`).catch(() => {});
      setItens([itemVazio()]);
      setObservacao("");
      setListaId(null);
      await recarregar();
      onSalva?.(compra);
    } catch (error) {
      setErro(error.response?.data?.error || "Erro ao registrar a compra.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="card space-y-5">
      {listaId && (
        <AlertBox type="info" message="Compra montada a partir da lista de reposição: confira fornecedor e preços e salve." />
      )}
      {erro && <AlertBox type="error" message={erro} onClose={() => setErro("")} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="text-sm font-semibold text-gray-700">
          Fornecedor
          <select className="select-field mt-1" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
            <option value="">➕ Novo / sem fornecedor</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          {!fornecedorId && (
            <input
              className="input-field mt-2"
              placeholder="Nome do fornecedor (opcional)"
              value={fornecedorNovo}
              onChange={(e) => setFornecedorNovo(e.target.value)}
            />
          )}
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Data da compra
          <input type="date" className="input-field mt-1" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Destino padrão dos produtos
          <select
            className="select-field mt-1"
            value={destinoPadrao}
            onChange={(e) => {
              setDestinoPadrao(e.target.value);
              setItens((atual) => atual.map((i) => ({ ...i, lojaId: e.target.value })));
            }}
          >
            <option value="">📦 Estoque da base (associar depois)</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                🏪 {l.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {ultimosDoFornecedor.length > 0 && (
        <div className="rounded-xl bg-accent-cream/50 border border-accent-yellow p-3">
          <p className="text-xs font-bold text-gray-700 mb-2">🔁 Comprar de novo deste fornecedor (último preço)</p>
          <div className="flex flex-wrap gap-2">
            {ultimosDoFornecedor.map((p) => (
              <button
                key={p.produtoId}
                type="button"
                onClick={() => adicionarDoCatalogo(p)}
                className="px-3 py-1.5 rounded-lg bg-white border border-primary/30 text-sm hover:border-primary"
              >
                {p.emoji} {p.produtoNome} · <b>{reais(p.custoUnitario)}</b>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 border-b">
              <th className="py-2 pr-2">Produto</th>
              <th className="py-2 pr-2 w-24">Qtd.</th>
              <th className="py-2 pr-2 w-32">Preço unit.</th>
              <th className="py-2 pr-2">Vai para</th>
              <th className="py-2 pr-2 text-right w-28">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.chave} className="border-b">
                <td className="py-2 pr-2 min-w-[180px]">
                  <select className="select-field py-2" value={i.produtoId} onChange={(e) => alterar(i.chave, "produtoId", e.target.value)}>
                    <option value="">Escolha...</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.emoji || "🧸"} {p.nome}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input type="number" min="1" inputMode="numeric" className="input-field py-2" value={i.quantidade} onChange={(e) => alterar(i.chave, "quantidade", e.target.value)} />
                </td>
                <td className="py-2 pr-2">
                  <input type="number" min="0" step="0.01" inputMode="decimal" className="input-field py-2" placeholder="R$" value={i.custoUnitario} onChange={(e) => alterar(i.chave, "custoUnitario", e.target.value)} />
                </td>
                <td className="py-2 pr-2 min-w-[170px]">
                  <select className="select-field py-2" value={i.lojaId} onChange={(e) => alterar(i.chave, "lojaId", e.target.value)}>
                    <option value="">📦 Base</option>
                    {lojas.map((l) => (
                      <option key={l.id} value={l.id}>
                        🏪 {l.nome}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2 text-right font-semibold">{reais(num(i.quantidade) * num(i.custoUnitario))}</td>
                <td className="py-2 text-right">
                  <button type="button" onClick={() => setItens((a) => (a.length > 1 ? a.filter((x) => x.chave !== i.chave) : [itemVazio()]))} className="text-red-600 font-bold px-2" aria-label="Remover produto">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => setItens((a) => [...a, { ...itemVazio(), lojaId: destinoPadrao }])} className="text-sm font-semibold text-primary">
        ➕ Adicionar produto
      </button>

      <label className="block text-sm font-semibold text-gray-700">
        Observação
        <input className="input-field mt-1" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: nota fiscal 123" />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-lg">
          Total da compra: <b className="text-primary-dark text-2xl">{reais(total)}</b>
        </p>
        <button type="button" onClick={salvar} disabled={salvando} className="btn-primary disabled:opacity-50">
          {salvando ? "Salvando..." : "💾 Registrar compra"}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        O preço pago atualiza o custo médio de cada produto, que entra como saída (custo das pelúcias) no lucro de cada loja.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estoque da base
// ---------------------------------------------------------------------------
function EstoqueBase({ lojas, recarregar }) {
  const [dados, setDados] = useState(null);
  const [lojaId, setLojaId] = useState("");
  const [enviar, setEnviar] = useState({});
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = () => api.get("/compras/estoque-base").then((r) => setDados(r.data)).catch(() => setDados({ itens: [] }));
  useEffect(() => {
    carregar();
  }, []);

  const confirmar = async () => {
    const itens = Object.entries(enviar)
      .map(([produtoId, q]) => ({ produtoId, quantidade: Math.trunc(num(q)) }))
      .filter((i) => i.quantidade > 0);
    if (!lojaId) return setAviso({ type: "error", message: "Escolha o ponto que vai receber." });
    if (!itens.length) return setAviso({ type: "error", message: "Informe quantas unidades enviar." });
    setEnviando(true);
    try {
      const { data } = await api.post("/compras/enviar-para-loja", { lojaId, itens });
      setAviso({ type: "success", message: `Enviado para ${data.loja}: agora está no estoque do ponto e pode ser usado para abastecer as máquinas.` });
      setEnviar({});
      await Promise.all([carregar(), recarregar()]);
    } catch (error) {
      setAviso({ type: "error", message: error.response?.data?.error || "Erro ao enviar." });
    } finally {
      setEnviando(false);
    }
  };

  if (!dados) return <div className="card">Carregando...</div>;

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-gray-600">Produtos comprados que ainda não foram para nenhum ponto.</p>
          <p className="text-lg font-bold">
            {dados.totalUnidades} unidades · {reais(dados.valorTotal)} em estoque
          </p>
        </div>
        <label className="text-sm font-semibold text-gray-700">
          Enviar para o ponto
          <select className="select-field mt-1" value={lojaId} onChange={(e) => setLojaId(e.target.value)}>
            <option value="">Escolha o ponto...</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                🏪 {l.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      {aviso && <AlertBox type={aviso.type} message={aviso.message} onClose={() => setAviso(null)} />}
      {dados.itens.length === 0 ? (
        <p className="text-gray-500">Nada no estoque da base. Compras feitas para um ponto já vão direto para ele.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 border-b">
                <th className="py-2">Produto</th>
                <th className="py-2 text-right">Na base</th>
                <th className="py-2 text-right">Custo médio</th>
                <th className="py-2 text-right">Valor</th>
                <th className="py-2 text-right w-32">Enviar</th>
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((i) => (
                <tr key={i.produtoId} className="border-b">
                  <td className="py-2">
                    {i.emoji} {i.nome}
                  </td>
                  <td className="py-2 text-right font-semibold">{i.quantidade}</td>
                  <td className="py-2 text-right">{reais(i.custoUnitario)}</td>
                  <td className="py-2 text-right">{reais(i.valor)}</td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      max={i.quantidade}
                      inputMode="numeric"
                      className="input-field py-1.5 text-right"
                      placeholder="0"
                      value={enviar[i.produtoId] ?? ""}
                      onChange={(e) => setEnviar((a) => ({ ...a, [i.produtoId]: e.target.value }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end">
            <button type="button" onClick={confirmar} disabled={enviando} className="btn-primary disabled:opacity-50">
              {enviando ? "Enviando..." : "🚚 Enviar para o ponto"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compras feitas
// ---------------------------------------------------------------------------
function Historico({ recarregar }) {
  const navigate = useNavigate();
  const [compras, setCompras] = useState(null);
  const [aviso, setAviso] = useState(null);

  const carregar = () => api.get("/compras").then((r) => setCompras(r.data)).catch(() => setCompras([]));
  useEffect(() => {
    carregar();
  }, []);

  const excluir = async (c) => {
    const ok = await Swal.fire({
      icon: "warning",
      title: "Excluir esta compra?",
      html: `${c.fornecedorNome || "Sem fornecedor"} · ${dataBR(c.data)} · <b>${reais(c.total)}</b><br/>Os produtos saem do estoque (base ou ponto).`,
      showCancelButton: true,
      confirmButtonText: "Excluir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!ok.isConfirmed) return;
    try {
      await api.delete(`/compras/${c.id}`);
      setAviso({ type: "success", message: "Compra excluída." });
      await Promise.all([carregar(), recarregar()]);
    } catch (error) {
      setAviso({ type: "error", message: error.response?.data?.error || "Erro ao excluir." });
    }
  };

  const comprarDeNovo = (c) =>
    navigate("/compras", {
      state: {
        compraBase: {
          fornecedorId: c.fornecedorId,
          itens: c.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, custoUnitario: i.custoUnitario, lojaId: i.lojaId })),
        },
      },
    });

  if (!compras) return <div className="card">Carregando...</div>;
  return (
    <div className="space-y-3">
      {aviso && <AlertBox type={aviso.type} message={aviso.message} onClose={() => setAviso(null)} />}
      {compras.length === 0 && <div className="card text-gray-500">Nenhuma compra registrada.</div>}
      {compras.map((c) => (
        <div key={c.id} className="card">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div>
              <p className="font-bold">{c.fornecedorNome || "Sem fornecedor"}</p>
              <p className="text-xs text-gray-500">
                {dataBR(c.data)} · {c.usuarioNome || ""} {c.observacao ? `· ${c.observacao}` : ""}
              </p>
            </div>
            <p className="text-xl font-extrabold text-primary-dark">{reais(c.total)}</p>
          </div>
          <ul className="text-sm divide-y">
            {c.itens.map((i) => (
              <li key={i.id} className="py-1.5 flex flex-wrap justify-between gap-2">
                <span>
                  {i.produto?.emoji || "🧸"} {i.produto?.nome} · {i.quantidade} × {reais(i.custoUnitario)}
                </span>
                <span className="text-gray-500">{i.loja ? `🏪 ${i.loja.nome}` : "📦 Base"}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-3 mt-3">
            <button type="button" onClick={() => comprarDeNovo(c)} className="text-sm font-semibold text-primary">
              🔁 Comprar de novo
            </button>
            <button type="button" onClick={() => excluir(c)} className="text-sm font-semibold text-red-600">
              🗑️ Excluir
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function Compras({ aba = "nova" }) {
  const [produtos, setProdutos] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [precos, setPrecos] = useState([]);
  const [aviso, setAviso] = useState(null);
  const [inicialLista, setInicialLista] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const recarregar = async () => {
    const [p, l, f, pr] = await Promise.all([
      api.get("/produtos").catch(() => ({ data: [] })),
      api.get("/lojas").catch(() => ({ data: [] })),
      api.get("/compras/fornecedores").catch(() => ({ data: [] })),
      api.get("/compras/precos").catch(() => ({ data: [] })),
    ]);
    setProdutos((p.data || []).filter((x) => x.ativo !== false));
    setLojas((l.data || []).filter((x) => x.ativo !== false));
    setFornecedores(f.data || []);
    setPrecos(pr.data || []);
  };

  useEffect(() => {
    // recarregar só altera o estado depois das respostas da API
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recarregar();
  }, []);

  // "Comprar de novo" (vem pelo state) ou lista de reposição (?lista=id)
  const location = useLocation();
  const compraBase = location.state?.compraBase;
  const listaId = searchParams.get("lista");
  useEffect(() => {
    if (aba !== "nova" || compraBase) return;
    if (listaId) {
      api
        .get("/lista-compras-pendentes")
        .then(({ data }) => {
          const lista = (data || []).find((x) => String(x.id) === String(listaId));
          if (!lista) return;
          setInicialLista({
            listaId: lista.id,
            observacao: "Lista de reposição",
            itens: lista.lojas.flatMap((loja) =>
              (loja.produtos || [])
                .filter((p) => p.produtoId)
                .map((p) => ({ produtoId: p.produtoId, quantidade: p.quantidade, lojaId: loja.lojaId })),
            ),
          });
        })
        .catch(() => {});
    }
  }, [aba, listaId, compraBase]);

  // "Comprar de novo" vem pronto do histórico; a lista de reposição é buscada
  const inicial = useMemo(() => (compraBase ? { ...compraBase } : inicialLista), [compraBase, inicialLista]);

  const titulo = useMemo(
    () => ({ nova: "Compras", estoque: "Estoque da base", historico: "Compras feitas" })[aba],
    [aba],
  );

  return (
    <div className="min-h-screen bg-background-light">
      <Navbar />
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6">
        <ComprasAbas />
        <PageHeader title={titulo} subtitle="Compra de pelúcias por fornecedor, estoque da base e envio para os pontos" icon="🛒" />
        {aviso && <AlertBox type={aviso.type} message={aviso.message} onClose={() => setAviso(null)} />}
        {aba === "nova" && (
          <NovaCompra
            produtos={produtos}
            lojas={lojas}
            fornecedores={fornecedores}
            precos={precos}
            recarregar={recarregar}
            inicial={inicial}
            onSalva={(compra) => {
              setAviso({
                type: "success",
                message: `Compra de ${reais(compra.total)} registrada. Produtos com ponto já estão no estoque da loja; os demais estão no estoque da base.`,
              });
              navigate("/compras", { replace: true, state: null });
            }}
          />
        )}
        {aba === "estoque" && <EstoqueBase lojas={lojas} recarregar={recarregar} />}
        {aba === "historico" && <Historico recarregar={recarregar} />}
      </div>
      <Footer />
    </div>
  );
}

export default Compras;

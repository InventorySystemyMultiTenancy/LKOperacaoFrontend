import { useEffect, useState } from "react";
import api from "../services/api";

const DIAS = [
  { valor: 1, nome: "Seg" },
  { valor: 2, nome: "Ter" },
  { valor: 3, nome: "Qua" },
  { valor: 4, nome: "Qui" },
  { valor: 5, nome: "Sex" },
  { valor: 6, nome: "Sáb" },
  { valor: 0, nome: "Dom" },
];

const NOVA_CATEGORIA = "__nova__";

const hojeISO = () => {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const MODOS = [
  { valor: "diario", titulo: "Todo dia", detalhe: "Volta a pendente todos os dias" },
  { valor: "dias_semana", titulo: "Dias da semana", detalhe: "Escolha os dias (ex: Seg e Qui = 2x por semana)" },
  { valor: "intervalo", titulo: "A cada X dias", detalhe: "Ex: a cada 2 dias, a cada 3 dias" },
  { valor: "nunca", titulo: "Não reinicia", detalhe: "Só volta a pendente se você reiniciar" },
];

function resumoReinicio({ modo, diasSemana, intervaloDias, hora }) {
  if (modo === "nunca") return "Não reinicia sozinho.";
  if (modo === "diario") return `Volta a pendente todo dia às ${hora} (7x por semana).`;
  if (modo === "dias_semana") {
    if (!diasSemana.length) return "Escolha pelo menos um dia.";
    const nomes = DIAS.filter((d) => diasSemana.includes(d.valor)).map((d) => d.nome).join(", ");
    return `Volta a pendente ${nomes} às ${hora} (${diasSemana.length}x por semana).`;
  }
  const n = Number(intervaloDias) || 1;
  const porSemana = (7 / n).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return n === 1
    ? `Volta a pendente todo dia às ${hora}.`
    : `Volta a pendente a cada ${n} dias às ${hora} (cerca de ${porSemana}x por semana).`;
}

// Criar (roteiro = null) ou editar um roteiro: nome, categoria e reinício.
export function RoteiroConfigModal({ aberto, roteiro, categorias, funcionarios, onFechar, onSalvo }) {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [funcionarioId, setFuncionarioId] = useState("");
  const [modo, setModo] = useState("dias_semana");
  const [diasSemana, setDiasSemana] = useState([1]);
  const [intervaloDias, setIntervaloDias] = useState(2);
  const [inicio, setInicio] = useState(hojeISO());
  const [hora, setHora] = useState("00:00");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto) return;
    const r = roteiro?.reinicio;
    setNome(roteiro?.zona || "");
    setCategoria(roteiro?.categoria || categorias[0] || "");
    setNovaCategoria("");
    setFuncionarioId(roteiro?.funcionarioId || "");
    setModo(r?.modo || (roteiro ? "dias_semana" : "dias_semana"));
    setDiasSemana(r?.diasSemana || [1]);
    setIntervaloDias(r?.intervaloDias || 2);
    setInicio(r?.inicio || hojeISO());
    setHora(r?.hora || "00:00");
    setErro("");
  }, [aberto, roteiro, categorias]);

  if (!aberto) return null;

  const alternarDia = (dia) =>
    setDiasSemana((atual) =>
      atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia],
    );

  const salvar = async (event) => {
    event.preventDefault();
    setErro("");
    const categoriaFinal = categoria === NOVA_CATEGORIA ? novaCategoria.trim() : categoria;
    if (!nome.trim()) return setErro("Informe o nome do roteiro.");
    if (!categoriaFinal) return setErro("Escolha ou digite a categoria.");
    if (modo === "dias_semana" && !diasSemana.length) return setErro("Escolha pelo menos um dia.");

    const reinicio = { modo, hora, diasSemana, intervaloDias: Number(intervaloDias), inicio };
    setSalvando(true);
    try {
      if (roteiro) {
        await api.put(`/roteiros/${roteiro.id}/configuracao`, {
          nome: nome.trim(),
          categoria: categoriaFinal,
          reinicio,
        });
        if ((roteiro.funcionarioId || "") !== funcionarioId) {
          await api.put(`/roteiros/${roteiro.id}`, { funcionarioId: funcionarioId || null });
        }
      } else {
        await api.post("/roteiros", {
          nome: nome.trim(),
          categoria: categoriaFinal,
          funcionarioId: funcionarioId || null,
          reinicio,
        });
      }
      onSalvo?.(roteiro ? "Roteiro atualizado!" : `Roteiro "${nome.trim()}" criado!`);
    } catch (error) {
      setErro(error.response?.data?.error || "Erro ao salvar o roteiro.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onFechar}>
      <form
        onSubmit={salvar}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-primary text-white px-6 py-4 flex items-center justify-between border-b-4 border-accent-yellow">
          <h2 className="text-xl font-bold">{roteiro ? "⚙️ Editar roteiro" : "➕ Novo roteiro"}</h2>
          <button type="button" onClick={onFechar} className="text-2xl leading-none hover:text-accent-yellow" aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Nome do roteiro</label>
            <input
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Segunda 1, Shoppings Zona Sul"
              maxLength={50}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Categoria</label>
              <select className="select-field" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={NOVA_CATEGORIA}>➕ Criar nova categoria...</option>
              </select>
              {categoria === NOVA_CATEGORIA && (
                <input
                  className="input-field mt-2"
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  placeholder="Nome da nova categoria"
                  maxLength={50}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Funcionário (opcional)</label>
              <select className="select-field" value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)}>
                <option value="">-- Não atribuído --</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-accent-yellow bg-accent-cream/40 p-4 space-y-4">
            <p className="font-bold text-gray-900">🔁 Quando o roteiro volta a ficar pendente?</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MODOS.map((m) => (
                <button
                  type="button"
                  key={m.valor}
                  onClick={() => setModo(m.valor)}
                  className={`text-left rounded-xl border-2 px-4 py-3 transition-colors ${
                    modo === m.valor
                      ? "border-primary bg-primary text-white"
                      : "border-gray-200 bg-white hover:border-primary/50"
                  }`}
                >
                  <span className="block font-bold">{m.titulo}</span>
                  <span className={`block text-xs ${modo === m.valor ? "text-white/80" : "text-gray-500"}`}>{m.detalhe}</span>
                </button>
              ))}
            </div>

            {modo === "dias_semana" && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Dias em que reinicia</p>
                <div className="flex flex-wrap gap-2">
                  {DIAS.map((d) => (
                    <button
                      type="button"
                      key={d.valor}
                      onClick={() => alternarDia(d.valor)}
                      className={`w-14 py-2 rounded-lg font-bold border-2 ${
                        diasSemana.includes(d.valor)
                          ? "bg-accent-yellow border-accent-yellow text-primary-dark"
                          : "bg-white border-gray-200 text-gray-600"
                      }`}
                    >
                      {d.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {modo === "intervalo" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">A cada quantos dias</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    className="input-field"
                    value={intervaloDias}
                    onChange={(e) => setIntervaloDias(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Começando em</label>
                  <input type="date" className="input-field" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                </div>
              </div>
            )}

            {modo !== "nunca" && (
              <div className="max-w-[200px]">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Horário do reinício</label>
                <input type="time" className="input-field" value={hora} onChange={(e) => setHora(e.target.value || "00:00")} />
              </div>
            )}

            <p className="text-sm font-semibold text-primary-dark">
              {resumoReinicio({ modo, diasSemana, intervaloDias, hora })}
            </p>
          </div>

          {erro && <p className="text-sm font-semibold text-red-700">{erro}</p>}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
          <button type="button" onClick={onFechar} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="btn-primary disabled:opacity-50">
            {salvando ? "Salvando..." : roteiro ? "Salvar" : "Criar roteiro"}
          </button>
        </div>
      </form>
    </div>
  );
}

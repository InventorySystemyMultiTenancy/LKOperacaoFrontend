// Editor do horário de funcionamento do ponto (cadastro da máquina e página
// Machine Pay). Formato salvo no backend: { "1": { inicio, fim }, ... } com
// 0 = domingo ... 6 = sábado; null = 24h.

export const DIAS_SEMANA = [
  ["1", "Segunda"],
  ["2", "Terça"],
  ["3", "Quarta"],
  ["4", "Quinta"],
  ["5", "Sexta"],
  ["6", "Sábado"],
  ["0", "Domingo"],
];

const horarioVazio = () =>
  Object.fromEntries(
    DIAS_SEMANA.map(([dia]) => [dia, { ativo: false, inicio: "10:00", fim: "22:00" }])
  );

// Valor salvo no backend -> estado do editor
export const horarioParaEditor = (salvo) => {
  const dias = horarioVazio();
  for (const [dia, faixa] of Object.entries(salvo || {})) {
    if (dias[dia]) dias[dia] = { ativo: true, inicio: faixa.inicio, fim: faixa.fim };
  }
  return { temHorario: Boolean(salvo), dias };
};

// Estado do editor -> { valor } para enviar ao backend, ou { erro }
export const editorParaHorario = ({ temHorario, dias }) => {
  if (!temHorario) return { valor: null };
  const diasAtivos = Object.entries(dias).filter(([, d]) => d.ativo);
  if (!diasAtivos.length) {
    return { erro: "Marque pelo menos um dia de funcionamento ou escolha 24h" };
  }
  if (diasAtivos.some(([, d]) => !d.inicio || !d.fim)) {
    return { erro: "Informe abertura e fechamento de cada dia marcado" };
  }
  return {
    valor: Object.fromEntries(diasAtivos.map(([dia, d]) => [dia, { inicio: d.inicio, fim: d.fim }])),
  };
};

// Texto curto: "Seg a Sex 10:00–22:00 · Sáb 10:00–18:00"
export const resumoHorario = (salvo) => {
  if (!salvo) return "24h, todos os dias";
  const grupos = [];
  for (const [dia, nome] of DIAS_SEMANA) {
    const faixa = salvo[dia];
    if (!faixa) continue;
    const texto = `${faixa.inicio}–${faixa.fim}`;
    const ultimo = grupos[grupos.length - 1];
    const indice = DIAS_SEMANA.findIndex(([d]) => d === dia);
    if (ultimo && ultimo.texto === texto && ultimo.fimIndice === indice - 1) {
      ultimo.fimNome = nome;
      ultimo.fimIndice = indice;
    } else {
      grupos.push({ inicioNome: nome, fimNome: nome, fimIndice: indice, texto });
    }
  }
  return grupos
    .map((g) => {
      const dias =
        g.inicioNome === g.fimNome
          ? g.inicioNome.slice(0, 3)
          : `${g.inicioNome.slice(0, 3)} a ${g.fimNome.slice(0, 3)}`;
      return `${dias} ${g.texto}`;
    })
    .join(" · ");
};

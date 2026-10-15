// Catálogo de permissões configuráveis por usuário (somente o ADMIN edita).
// Mantenha as chaves em sincronia com backend/src/utils/permissoes.js
//
// Cada aba tem sua rota, as funcionalidades extras que dependem dela e,
// no caso do Dashboard, as seções que o usuário pode ver.

export const CATALOGO_ABAS = [
  {
    chave: "dashboard",
    label: "📊 Dashboard",
    rota: "/",
    secoes: [
      { chave: "dashboard.resumo", label: "Cards de resumo (roteiros de hoje, prêmios saídos, alertas)" },
      { chave: "dashboard.buscaLojasMaquinas", label: "Buscar lojas e máquinas" },
      { chave: "dashboard.historicoMovimentacoes", label: "Histórico de movimentações e estoque da máquina" },
      { chave: "dashboard.alertasMaquinas", label: "Alertas de estoque das máquinas" },
      { chave: "dashboard.alertasLojas", label: "Alertas de estoque das lojas" },
      { chave: "dashboard.distribuicaoLojas", label: "Distribuição por loja" },
    ],
  },
  {
    chave: "movimentacoes",
    label: "📦 Movimentações",
    rota: "/movimentacoes",
    funcionalidades: [
      { chave: "movimentacoes.gerenciar", label: "Ver estatísticas, editar e excluir movimentações e organizar roteiros" },
    ],
  },
  {
    chave: "maquinas",
    label: "🎮 Máquinas",
    rota: "/maquinas",
    funcionalidades: [
      { chave: "maquinas.gerenciar", label: "Cadastrar, editar e excluir máquinas" },
      { chave: "maquinas.machinePay", label: "Ver status e extrato Machine Pay da máquina" },
    ],
  },
  {
    chave: "lojas",
    label: "🏪 Lojas",
    rota: "/lojas",
    funcionalidades: [
      { chave: "lojas.gerenciar", label: "Cadastrar, editar e excluir lojas" },
    ],
  },
  {
    chave: "produtos",
    label: "🧸 Produtos",
    rota: "/produtos",
    funcionalidades: [
      { chave: "produtos.gerenciar", label: "Cadastrar, editar e excluir produtos" },
    ],
  },
  {
    chave: "manutencoes",
    label: "🛠️ Manutenções",
    rota: "/manutencoes",
    funcionalidades: [
      { chave: "manutencoes.atualizar", label: "Atualizar / concluir manutenções" },
      { chave: "manutencoes.gerenciar", label: "Ver todas as manutenções, excluir e ver alertas de frequência" },
    ],
  },
  {
    chave: "roteiros",
    label: "🗺️ Roteiros",
    rota: "/roteiros",
    funcionalidades: [
      { chave: "roteiros.gerenciar", label: "Gerenciar roteiros (montar, mover lojas, atribuir funcionários)" },
    ],
  },
  {
    chave: "financeiro",
    label: "💰 Financeiro",
    rota: "/financeiro",
    funcionalidades: [
      { chave: "financeiro.machinePay", label: "Buscar valor digital na Machine Pay" },
    ],
  },
  {
    chave: "machinePay",
    label: "📡 Machine Pay",
    rota: "/machine-pay",
    funcionalidades: [
      { chave: "machinePay.valores", label: "Ver valores em R$ (vendas hoje, acumulado e extrato)" },
      { chave: "machinePay.extrato", label: "Ver últimas vendas (extrato) da máquina" },
      { chave: "machinePay.creditoRemoto", label: "Enviar créditos remotos para a máquina" },
      { chave: "machinePay.devolucao", label: "Devolver pagamentos do extrato" },
      { chave: "machinePay.horario", label: "Editar horário de funcionamento e região (capital/interior) dos pontos" },
    ],
  },
  {
    chave: "vouchers",
    label: "🎟️ Vouchers",
    rota: "/creditos-remotos",
    funcionalidades: [
      { chave: "vouchers.gerenciar", label: "Criar e bloquear vouchers e copiar os links" },
    ],
  },
  {
    chave: "carrinhos",
    label: "🛒 Carrinhos",
    rota: "/carrinhos",
    funcionalidades: [
      { chave: "carrinhos.devolver", label: "Devolver carrinhos pelos funcionários" },
    ],
  },
  { chave: "graficos", label: "📈 Gráficos", rota: "/graficos" },
  { chave: "alertasEstoque", label: "🚨 Alertas de Estoque", rota: "/alertas-estoque" },
  { chave: "relatorios", label: "📄 Relatórios", rota: "/relatorios" },
  { chave: "veiculos", label: "🚗 Veículos", rota: "/veiculos" },
];

// Ponto de partida ao ativar a personalização (equivale ao acesso padrão do perfil)
export const PERMISSOES_PADRAO_POR_ROLE = {
  FUNCIONARIO: [
    "dashboard",
    "dashboard.buscaLojasMaquinas",
    "movimentacoes",
    "maquinas",
    "lojas",
    "produtos",
    "manutencoes",
    "manutencoes.atualizar",
    "roteiros",
    "veiculos",
  ],
  FINANCEIRO: [
    "dashboard",
    "dashboard.buscaLojasMaquinas",
    "movimentacoes",
    "maquinas",
    "maquinas.machinePay",
    "lojas",
    "produtos",
    "financeiro",
    "financeiro.machinePay",
    "machinePay",
    "machinePay.valores",
    "machinePay.extrato",
    "veiculos",
  ],
};

// Chaves que dependem de cada aba (removidas quando a aba é desmarcada)
export const chavesFilhas = (aba) => [
  ...(aba.funcionalidades || []).map((f) => f.chave),
  ...(aba.secoes || []).map((s) => s.chave),
];

// Rota inicial do usuário: Dashboard ou a primeira aba liberada
export const rotaInicial = (pode) => {
  const aba = CATALOGO_ABAS.find((a) => pode(a.chave, a.chave === "dashboard"));
  return aba ? aba.rota : null;
};

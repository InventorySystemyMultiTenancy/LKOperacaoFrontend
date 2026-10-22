import { jsPDF } from "jspdf";

// Relatório de vendas Machine Pay de um ponto no período: resumo (mesma conta
// do servidor), PDF e mensagem de WhatsApp para o dono do ponto.

const EMPRESA = "Camaleão Diversões";

export const reais = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataBR = (iso) => {
  if (!iso) return "";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

const dataHoraBR = (valor) =>
  valor
    ? new Date(valor).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const pct = (v) => `${Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

// Mesma regra do servidor (src/utils/relatorioVendasPonto.js)
// O painel manda o método com emoji ("✅ Pix", "💳 Crédito"): fica só o texto
export const limparMetodo = (tipo) =>
  String(tipo || "")
    .replace(/[^\p{L}\p{N} ./-]/gu, "")
    .replace(/\s+/g, " ")
    .trim() || "Outros";

export function resumirVendasPonto(vendas = [], percentualComissao = 0) {
  const centavos = (v) => Math.round((Number(v) || 0) * 100);
  const validas = vendas.filter((v) => !v.devolvido && Number(v.valor) > 0);
  const grupos = new Map();
  for (const venda of validas) {
    const metodo = limparMetodo(venda.tipo);
    const g = grupos.get(metodo) || { metodo, quantidade: 0, c: 0 };
    g.quantidade += 1;
    g.c += centavos(venda.valor);
    grupos.set(metodo, g);
  }
  const total = validas.reduce((s, v) => s + centavos(v.valor), 0);
  const percentual = Math.min(100, Math.max(0, Number(percentualComissao) || 0));
  const comissao = Math.round((total * percentual) / 100);
  return {
    quantidadeVendas: validas.length,
    quantidadeDevolvidas: vendas.filter((v) => v.devolvido).length,
    porMetodo: [...grupos.values()]
      .sort((a, b) => b.c - a.c)
      .map(({ metodo, quantidade, c }) => ({ metodo, quantidade, total: c / 100 })),
    totalVendas: total / 100,
    percentualComissao: percentual,
    totalComissao: comissao / 100,
    totalLiquido: (total - comissao) / 100,
  };
}

let logoCache = null;
async function carregarLogo() {
  if (logoCache) return logoCache;
  try {
    const img = await new Promise((resolve, reject) => {
      const imagem = new Image();
      imagem.onload = () => resolve(imagem);
      imagem.onerror = reject;
      imagem.src = "/CamaleaoDiversoesLogo.png";
    });
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 220;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 220, 220);
    ctx.drawImage(img, 0, 0, 220, 220);
    logoCache = canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    logoCache = null;
  }
  return logoCache;
}

export const nomeArquivoRelatorio = (r) =>
  `vendas-${String(r.nomePonto || r.posId || "ponto")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${r.dataInicio}-a-${r.dataFim}.pdf`;

// r = { nomePonto, posId, dataInicio, dataFim, vendas, resumo, dinheiroEspecie,
//       nomeContato, fechamento: { fechadoNoPainel, createdAt } | null, usuarioNome }
export async function gerarPdfRelatorio(r) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 210;
  const M = 14;
  const verde = [11, 93, 59];
  const claro = [230, 251, 245];
  let y = M;

  const logo = await carregarLogo();
  if (logo) doc.addImage(logo, "JPEG", M, y, 30, 30);
  doc.setTextColor(...verde);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Relatório de Vendas — Machine Pay", M + 36, y + 9);
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.setFont("helvetica", "normal");
  doc.text(EMPRESA, M + 36, y + 15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.setFontSize(12);
  doc.text(doc.splitTextToSize(r.nomePonto || `Leitor ${r.posId}`, L - M * 2 - 36), M + 36, y + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Período: ${dataBR(r.dataInicio)} a ${dataBR(r.dataFim)}   ·   Leitor (POS): ${r.posId}`,
    M + 36,
    y + 29,
  );
  y += 36;

  const status = r.fechamento
    ? r.fechamento.fechadoNoPainel
      ? `Fechamento feito na Machine Pay em ${dataHoraBR(r.fechamento.createdAt)}`
      : "Fechamento na Machine Pay NÃO confirmado — conferir no painel"
    : `Prévia gerada em ${dataHoraBR(new Date())} (sem fechamento)`;
  doc.setFillColor(...claro);
  doc.roundedRect(M, y, L - 2 * M, 9, 2, 2, "F");
  doc.setFontSize(9);
  doc.setTextColor(...verde);
  doc.setFont("helvetica", "bold");
  doc.text(status, M + 3, y + 6);
  y += 14;

  // Resumo
  const res = r.resumo;
  const linhaResumo = (rotulo, valor, destaque = false) => {
    doc.setFont("helvetica", destaque ? "bold" : "normal");
    doc.setFontSize(destaque ? 12 : 10);
    doc.setTextColor(destaque ? 11 : 30, destaque ? 93 : 30, destaque ? 59 : 30);
    doc.text(rotulo, M + 3, y);
    doc.text(valor, L - M - 3, y, { align: "right" });
    y += destaque ? 8 : 6;
  };
  doc.setDrawColor(200);
  const topoResumo = y - 4;
  y += 3;
  linhaResumo(`Total de vendas (${res.quantidadeVendas})`, reais(res.totalVendas), true);
  for (const m of res.porMetodo) linhaResumo(`   ${m.metodo} (${m.quantidade})`, reais(m.total));
  doc.line(M + 3, y - 3, L - M - 3, y - 3);
  y += 2;
  linhaResumo(`Comissão do ponto (${pct(res.percentualComissao)})`, reais(res.totalComissao), true);
  linhaResumo("Valor líquido (Camaleão Diversões)", reais(res.totalLiquido));
  if (Number(r.dinheiroEspecie) > 0) linhaResumo("Dinheiro em espécie informado", reais(r.dinheiroEspecie));
  if (res.quantidadeDevolvidas) {
    linhaResumo(`Vendas devolvidas (não entram no total)`, String(res.quantidadeDevolvidas));
  }
  doc.rect(M, topoResumo, L - 2 * M, y - topoResumo);
  y += 8;

  // Lista de vendas
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...verde);
  doc.text("Vendas do período", M, y);
  y += 5;
  const cabecalho = () => {
    doc.setFillColor(...claro);
    doc.rect(M, y - 4, L - 2 * M, 6, "F");
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text("Data e hora", M + 2, y);
    doc.text("Método", M + 50, y);
    doc.text("Situação", M + 95, y);
    doc.text("Valor", L - M - 2, y, { align: "right" });
    y += 6;
    doc.setFont("helvetica", "normal");
  };
  cabecalho();
  for (const v of r.vendas || []) {
    if (y > 280) {
      doc.addPage();
      y = M + 4;
      doc.setFont("helvetica", "bold");
      cabecalho();
    }
    doc.setTextColor(v.devolvido ? 150 : 30);
    doc.text(dataHoraBR(v.data), M + 2, y);
    doc.text(limparMetodo(v.tipo), M + 50, y);
    doc.text(v.devolvido ? "Devolvida" : limparMetodo(v.status).slice(0, 28), M + 95, y);
    doc.text(reais(v.valor), L - M - 2, y, { align: "right" });
    y += 5;
  }
  if (!r.vendas?.length) {
    doc.setTextColor(120);
    doc.text("Nenhuma venda no período.", M + 2, y);
  }

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(
      `${EMPRESA}${r.usuarioNome ? ` · ${r.usuarioNome}` : ""} · página ${i} de ${paginas}`,
      L / 2,
      292,
      { align: "center" },
    );
  }
  return doc;
}

export async function baixarPdfRelatorio(r) {
  (await gerarPdfRelatorio(r)).save(nomeArquivoRelatorio(r));
}

// No celular abre a lista de apps (inclusive o WhatsApp) com o PDF anexado.
export async function compartilharPdfRelatorio(r) {
  const doc = await gerarPdfRelatorio(r);
  const arquivo = new File([doc.output("blob")], nomeArquivoRelatorio(r), { type: "application/pdf" });
  if (!navigator.canShare?.({ files: [arquivo] })) return false;
  await navigator.share({ files: [arquivo], title: "Relatório de vendas" });
  return true;
}

export function linkWhatsappRelatorio(r, numero) {
  let digitos = String(numero || "").replace(/\D/g, "");
  if (digitos && digitos.length <= 11) digitos = `55${digitos}`;
  const res = r.resumo;
  const linhas = [
    `*Relatório de vendas — ${EMPRESA}*`,
    r.nomeContato ? `Olá, ${r.nomeContato}!` : null,
    `Ponto: ${r.nomePonto || r.posId}`,
    `Período: ${dataBR(r.dataInicio)} a ${dataBR(r.dataFim)}`,
    "",
    `Total de vendas: *${reais(res.totalVendas)}* (${res.quantidadeVendas} vendas)`,
    ...res.porMetodo.map((m) => `• ${m.metodo}: ${reais(m.total)} (${m.quantidade})`),
    "",
    `*Sua comissão (${pct(res.percentualComissao)}): ${reais(res.totalComissao)}*`,
    r.fechamento?.fechadoNoPainel ? `Fechamento feito em ${dataHoraBR(r.fechamento.createdAt)}.` : null,
  ].filter((l) => l !== null);
  return `https://wa.me/${digitos}?text=${encodeURIComponent(linhas.join("\n"))}`;
}

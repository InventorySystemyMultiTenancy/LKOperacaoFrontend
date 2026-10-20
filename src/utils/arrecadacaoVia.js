import { jsPDF } from "jspdf";

// Via do cliente do Controle de Arrecadação: PDF (para imprimir/compartilhar)
// e texto para o WhatsApp do funcionário do ponto que conferiu.

export const reais = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataBR = (iso) => {
  if (!iso) return "";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

const percentual = (valor) =>
  `${Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

let logoCache = null;
// Logo reduzida (o PNG original deixaria o PDF com ~1 MB, pesado para o WhatsApp)
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

export const nomeArquivoVia = (a) =>
  `arrecadacao-${(a.loja?.nome || "loja").toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${String(a.data).slice(0, 10)}.pdf`;

// a = arrecadação salva (com loja.nome)
export async function gerarPdfVia(a) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const L = 148;
  const M = 10;
  const azul = [11, 93, 59];
  const cinza = [225, 228, 235];
  let y = M;

  // Cabeçalho: logo + título + cliente/data
  doc.setDrawColor(60);
  doc.setLineWidth(0.4);
  doc.rect(M, y, L - 2 * M, 42);
  const logo = await carregarLogo();
  if (logo) doc.addImage(logo, "JPEG", M + 3, y + 3, 36, 36);
  doc.setFillColor(...cinza);
  doc.rect(M + 42, y, L - 2 * M - 42, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...azul);
  doc.text("Controle de Arrecadação", M + 42 + (L - 2 * M - 42) / 2, y + 8, { align: "center" });
  doc.setTextColor(20);
  doc.setFontSize(8);
  doc.text("Cliente:", M + 44, y + 17);
  doc.text("Data:", M + 44, y + 31);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(doc.splitTextToSize(a.loja?.nome || "", L - 2 * M - 48), M + 44, y + 23);
  doc.text(dataBR(a.data), M + 44, y + 37);
  doc.line(M + 42, y + 26, L - M, y + 26);
  doc.line(M + 42, y, M + 42, y + 42);
  y += 48;

  // Valores
  const linha = (rotulo, valor, x, largura) => {
    doc.setFillColor(...cinza);
    doc.rect(x, y, 30, 10, "FD");
    doc.rect(x + 30, y, largura - 30, 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(rotulo, x + 2, y + 6.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(valor, x + 32, y + 6.8);
  };
  linha("Valor Bruto", reais(a.valorBruto), M, 66);
  doc.rect(M + 70, y, L - 2 * M - 70, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`${percentual(a.percentualComissao)}   ${reais(a.valorComissao)}`, M + 72, y + 6.8);
  y += 12;
  linha("Valor Líquido", reais(a.valorLiquido), M, 66);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Eu conferi,", M + 90, y + 7);
  y += 18;

  // Nome e visto
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Nome:", M, y);
  doc.text("Visto:", M + 70, y);
  doc.setFont("helvetica", "normal");
  doc.text(a.recebedorNome || "", M + 13, y - 1);
  doc.line(M + 12, y + 1, M + 66, y + 1);
  doc.line(M + 82, y + 1, L - M, y + 1);
  if (a.recebedorVisto) {
    try {
      doc.addImage(a.recebedorVisto, "PNG", M + 82, y - 15, 46, 15, undefined, "FAST");
    } catch {
      // assinatura inválida: segue sem a imagem
    }
  }
  y += 8;

  // Observação
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.rect(M, y, L - 2 * M, 22);
  doc.text("Observação:", M + 2, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(a.observacao || "", L - 2 * M - 4), M + 2, y + 9);
  y += 28;

  // Detalhe por máquina (para conferência do ponto)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Máquinas", M, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  for (const item of a.itens || []) {
    if (y > 196) break;
    const partes = [
      `Dinheiro ${reais(item.dinheiro)}`,
      `Cartão ${reais(item.cartao)}`,
      `PIX ${reais(item.pix)}`,
      item.moeda ? `Moeda ${reais(item.moeda)}` : null,
      item.fichas ? `Fichas ${reais(item.fichas)}` : null,
      `Caiu ${item.caiu}`,
    ].filter(Boolean);
    const linhas = doc.splitTextToSize(
      `${item.maquinaNome}: ${reais(item.total)}  (${partes.join(" · ")})`,
      L - 2 * M,
    );
    doc.text(linhas, M, y);
    y += 4 * linhas.length + 1.5;
  }

  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    `Camaleão Diversões · Responsável: ${a.responsavelNome || "-"}`,
    L / 2,
    205,
    { align: "center" },
  );
  return doc;
}

export async function baixarPdfVia(a) {
  const doc = await gerarPdfVia(a);
  doc.save(nomeArquivoVia(a));
}

// Compartilha o PDF (no celular abre a lista de apps, inclusive o WhatsApp).
// Devolve false se o navegador não suporta compartilhar arquivos.
export async function compartilharPdfVia(a) {
  const doc = await gerarPdfVia(a);
  const arquivo = new File([doc.output("blob")], nomeArquivoVia(a), { type: "application/pdf" });
  if (!navigator.canShare?.({ files: [arquivo] })) return false;
  await navigator.share({ files: [arquivo], title: "Controle de Arrecadação" });
  return true;
}

export function textoWhatsappVia(a) {
  const linhas = [
    "*Controle de Arrecadação — Camaleão Diversões*",
    `Cliente: ${a.loja?.nome || ""}`,
    `Data: ${dataBR(a.data)}`,
    "",
    `Valor bruto: ${reais(a.valorBruto)}`,
    `Comissão (${percentual(a.percentualComissao)}): ${reais(a.valorComissao)}`,
    `*Valor líquido: ${reais(a.valorLiquido)}*`,
    "",
    ...(a.itens || []).map((i) => `• ${i.maquinaNome}: ${reais(i.total)} (caiu ${i.caiu})`),
  ];
  if (a.observacao) linhas.push("", `Observação: ${a.observacao}`);
  if (a.recebedorNome) linhas.push("", `Conferido por: ${a.recebedorNome}`);
  linhas.push(`Responsável Camaleão Diversões: ${a.responsavelNome || "-"}`);
  return linhas.join("\n");
}

export function linkWhatsappVia(a, numero) {
  let digitos = String(numero || "").replace(/\D/g, "");
  if (digitos && digitos.length <= 11) digitos = `55${digitos}`;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(textoWhatsappVia(a))}`;
}

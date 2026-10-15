// Mensagem de manutenção para o WhatsApp (aba Manutenções e página Machine Pay).

const statusNormalizado = (status) => String(status || "").trim().toLowerCase();

export const formatarMaquinaManutencao = (maquina) => {
  if (!maquina) return "";
  return [maquina.codigo, maquina.nome].filter(Boolean).join(" - ");
};

// "" quando a loja não tem endereço cadastrado
const enderecoLoja = (loja) => {
  if (!loja) return "";
  const endereco = (loja.endereco || "").trim();
  const cidade = (loja.cidade || "").trim();
  const estado = (loja.estado || "").trim();
  const cidadeUf = cidade && estado ? `${cidade}/${estado}` : cidade || estado;
  return [endereco, cidadeUf].filter(Boolean).join(" - ");
};

export const montarTextoWhatsapp = (m) => {
  const status = statusNormalizado(m.status);
  const linhas = [
    status === "urgente"
      ? "🚨 *MANUTENÇÃO URGENTE* 🚨"
      : `🔧 *MANUTENÇÃO${status ? ` - ${status.toUpperCase()}` : ""}*`,
    "",
    "📝 *Problema:*",
    m.descricao || "-",
    "",
    `🏪 *Loja:* ${m.loja?.nome || "-"}`,
  ];
  const maquina = formatarMaquinaManutencao(m.maquina);
  if (maquina) linhas.push(`🎰 *Máquina:* ${maquina}`);
  const endereco = enderecoLoja(m.loja);
  if (endereco) {
    linhas.push(`📍 *Endereço:* ${endereco}`);
    linhas.push(
      `🗺️ *Como chegar:* https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [m.loja?.nome, endereco].filter(Boolean).join(", ")
      )}`
    );
  }
  linhas.push("");
  linhas.push(
    `📅 *Aberta em:* ${new Date(m.createdAt || Date.now()).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    })}`
  );
  if (m.funcionario?.nome) linhas.push(`👤 *Responsável:* ${m.funcionario.nome}`);
  return linhas.join("\n");
};

const ehCelular = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// No computador o navegador só deixa abrir aba nova no próprio clique. Quando a
// mensagem depende de uma chamada à API (ex: criar a manutenção), chame isto no
// clique e passe a aba para enviarWhatsapp depois. No celular não precisa.
export const reservarAbaWhatsapp = () => (ehCelular() ? null : window.open("", "_blank"));

// Celular: abre o app do WhatsApp direto (sem a página intermediária do wa.me).
// Computador: wa.me, que oferece abrir o WhatsApp Desktop ou o Web.
export const enviarWhatsapp = (texto, abaReservada = null) => {
  const textoUrl = encodeURIComponent(texto);
  const linkWeb = `https://wa.me/?text=${textoUrl}`;
  if (ehCelular()) {
    window.location.href = `whatsapp://send?text=${textoUrl}`;
    // App não instalado: o navegador continua na página -> cai no wa.me
    setTimeout(() => {
      if (!document.hidden) window.location.href = linkWeb;
    }, 1500);
    return;
  }
  if (abaReservada && !abaReservada.closed) {
    abaReservada.location.href = linkWeb;
    return;
  }
  window.open(linkWeb, "_blank", "noopener");
};

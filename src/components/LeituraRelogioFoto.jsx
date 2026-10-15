import { useEffect, useRef, useState } from "react";
import api from "../services/api";

const MAX_FOTOS = 3;
const LADO_MAXIMO = 1600;

const reais = (valor) =>
  valor === null || valor === undefined
    ? "—"
    : Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Reduz a foto no próprio celular antes de enviar (fotos de câmera têm 3-8 MB).
function comprimirFoto(arquivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ dataUrl, base64: dataUrl.split(",")[1], mediaType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir a foto"));
    };
    img.src = url;
  });
}

const numeroBR = (valor) =>
  valor === null || valor === undefined
    ? "—"
    : Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const ESTILO_NIVEL = {
  OK: {
    caixa: "bg-green-50 border-green-400",
    titulo: "text-green-800",
    rotulo: "✅ Dentro do esperado",
  },
  LEVE: {
    caixa: "bg-yellow-50 border-yellow-400",
    titulo: "text-yellow-900",
    rotulo: "⚠️ Atenção",
  },
  URGENTE: {
    caixa: "bg-red-50 border-red-500",
    titulo: "text-red-800",
    rotulo: "🚨 Urgente",
  },
};

const ESTILO_CONFIANCA = {
  alta: "bg-green-100 text-green-800",
  media: "bg-yellow-100 text-yellow-900",
  baixa: "bg-red-100 text-red-800",
};

// Cartão com o resultado da conferência (prévia, coleta salva ou painel).
export function ConferenciaResumo({ conferencia, titulo = "Conferência da leitura", compacto = false }) {
  if (!conferencia) return null;

  if (conferencia.status !== "CONFERIDA" && conferencia.status !== "CONTADOR_INVALIDO") {
    return (
      <div className="rounded-xl border-l-4 border-blue-400 bg-blue-50 p-3 text-sm text-blue-900">
        {conferencia.resumo}
      </div>
    );
  }

  const estilo = ESTILO_NIVEL[conferencia.nivel] || ESTILO_NIVEL.OK;
  const semConfigPremios = conferencia.premiosEsperados === null || conferencia.premiosEsperados === undefined;

  return (
    <div className={`rounded-xl border-l-4 p-4 ${estilo.caixa}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className={`font-bold ${estilo.titulo}`}>{titulo}</p>
        <span className={`text-sm font-bold ${estilo.titulo}`}>{estilo.rotulo}</span>
      </div>

      {conferencia.status === "CONFERIDA" && (
        <div className={`grid gap-3 ${compacto ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
          <div className="bg-white/80 rounded-lg p-3">
            <p className="text-xs text-gray-500">Entrou no contador</p>
            <p className="text-lg font-bold text-gray-900">{reais(conferencia.receitaContador)}</p>
            <p className="text-xs text-gray-500">{conferencia.pulsos} pulsos</p>
          </div>
          <div className="bg-white/80 rounded-lg p-3">
            <p className="text-xs text-gray-500">Digital (Machine Pay)</p>
            <p className="text-lg font-bold text-primary">{reais(conferencia.digital)}</p>
            <p className="text-xs text-gray-500">PIX e cartão</p>
          </div>
          <div className="bg-white rounded-lg p-3 ring-2 ring-accent-yellow">
            <p className="text-xs text-gray-600 font-semibold">💵 Dinheiro físico esperado</p>
            <p className="text-xl font-extrabold text-primary-dark">{reais(conferencia.fisicoEsperado)}</p>
            {conferencia.fisicoContado !== null && conferencia.fisicoContado !== undefined && (
              <p className={`text-xs font-semibold ${conferencia.diferencaDinheiro < 0 ? "text-red-700" : "text-green-700"}`}>
                Contado {reais(conferencia.fisicoContado)} ({conferencia.diferencaDinheiro >= 0 ? "+" : ""}
                {reais(conferencia.diferencaDinheiro)})
              </p>
            )}
          </div>
          <div className="bg-white/80 rounded-lg p-3">
            <p className="text-xs text-gray-500">🧸 Prêmios (saíram / esperados)</p>
            <p className="text-lg font-bold text-gray-900">
              {conferencia.premiosSaida} / {semConfigPremios ? "—" : numeroBR(conferencia.premiosEsperados)}
            </p>
            <p className="text-xs text-gray-500">
              {semConfigPremios
                ? "Configure jogadas por prêmio na máquina"
                : `${numeroBR(conferencia.jogadas)} jogadas de ${reais(conferencia.config?.valorJogada)}`}
            </p>
          </div>
        </div>
      )}

      {conferencia.alertas?.length > 0 && (
        <ul className="mt-3 space-y-1">
          {conferencia.alertas.map((alerta, i) => (
            <li
              key={i}
              className={`text-sm ${alerta.nivel === "URGENTE" ? "text-red-800 font-semibold" : "text-yellow-900"}`}
            >
              {alerta.nivel === "URGENTE" ? "🚨" : "⚠️"} {alerta.mensagem}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Botão "Fotografar relógio" + prévia da conferência ao vivo.
// onLeitura({ contadorIn, contadorOut, leituraFoto }) preenche o formulário.
export function LeituraRelogioFoto({ maquinaId, contadorIn, contadorOut, onLeitura }) {
  const inputRef = useRef(null);
  const [fotos, setFotos] = useState([]);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [leitura, setLeitura] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);

  // Prévia: recalcula quando os dois contadores estão preenchidos.
  useEffect(() => {
    if (!maquinaId || contadorIn === "" || contadorOut === "" || contadorIn == null || contadorOut == null) {
      setPrevia(null);
      return undefined;
    }
    let cancelado = false;
    const timer = setTimeout(async () => {
      setCarregandoPrevia(true);
      try {
        const { data } = await api.post("/conferencias/previa", {
          maquinaId,
          contadorIn: Number(contadorIn),
          contadorOut: Number(contadorOut),
        });
        if (!cancelado) setPrevia(data);
      } catch {
        if (!cancelado) setPrevia(null);
      } finally {
        if (!cancelado) setCarregandoPrevia(false);
      }
    }, 700);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [maquinaId, contadorIn, contadorOut]);

  const selecionarFotos = async (event) => {
    const arquivos = Array.from(event.target.files || []).slice(0, MAX_FOTOS);
    event.target.value = "";
    if (!arquivos.length) return;

    setErro("");
    setLeitura(null);
    setLendo(true);
    try {
      const comprimidas = await Promise.all(arquivos.map(comprimirFoto));
      setFotos(comprimidas.map((f) => f.dataUrl));
      const { data } = await api.post("/conferencias/leitura-foto", {
        maquinaId,
        fotos: comprimidas.map(({ base64, mediaType }) => ({ base64, mediaType })),
      });
      setLeitura(data);
      onLeitura?.({
        contadorIn: data.contadorIn ?? "",
        contadorOut: data.contadorOut ?? "",
        leituraFoto: {
          contadorIn: data.contadorIn,
          contadorOut: data.contadorOut,
          confianca: data.confianca,
          observacao: data.observacao,
          fotos: comprimidas.length,
          lidoEm: new Date().toISOString(),
        },
      });
    } catch (error) {
      setErro(
        error.response?.data?.error ||
          error.message ||
          "Não foi possível ler a foto. Digite os números.",
      );
    } finally {
      setLendo(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={lendo || !maquinaId}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {lendo ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Lendo os números...
              </>
            ) : (
              <>📷 Fotografar relógio</>
            )}
          </button>
          <p className="text-sm text-gray-600 flex-1 min-w-[200px]">
            {maquinaId
              ? "Tire foto dos contadores IN e OUT (até 3 fotos). Os números são preenchidos sozinhos — confira antes de salvar."
              : "Escolha a máquina para fotografar o relógio."}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={selecionarFotos}
          />
        </div>

        {fotos.length > 0 && (
          <div className="flex gap-2 mt-3">
            {fotos.map((src, i) => (
              <img key={i} src={src} alt={`Foto ${i + 1} do relógio`} className="h-20 w-20 object-cover rounded-lg border" />
            ))}
          </div>
        )}

        {leitura && (
          <div className="mt-3 text-sm space-y-1">
            <p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold mr-2 ${ESTILO_CONFIANCA[leitura.confianca] || ESTILO_CONFIANCA.media}`}>
                Confiança {leitura.confianca}
              </span>
              Lido: IN <strong>{leitura.contadorIn ?? "?"}</strong> · OUT <strong>{leitura.contadorOut ?? "?"}</strong>
            </p>
            {leitura.observacao && <p className="text-gray-600">{leitura.observacao}</p>}
            {leitura.avisos?.map((aviso, i) => (
              <p key={i} className="text-red-700 font-semibold">⚠️ {aviso}</p>
            ))}
          </div>
        )}

        {erro && <p className="mt-3 text-sm text-red-700 font-semibold">{erro}</p>}
      </div>

      {carregandoPrevia && (
        <p className="text-sm text-gray-500">Calculando a conferência com a Machine Pay...</p>
      )}
      {previa?.conferencia && (
        <>
          <ConferenciaResumo conferencia={previa.conferencia} titulo="Prévia da conferência" />
          {previa.machinePay && !previa.machinePay.sucesso && (
            <p className="text-xs text-yellow-800">
              Machine Pay indisponível agora ({previa.machinePay.erro}). O digital será buscado ao salvar.
            </p>
          )}
        </>
      )}
    </div>
  );
}

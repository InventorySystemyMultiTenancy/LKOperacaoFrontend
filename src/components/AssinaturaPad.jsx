import { useEffect, useRef, useState } from "react";

// Campo "Visto": assinatura feita com o dedo (ou mouse). onChange recebe a
// imagem em PNG (data URL) ou null quando limpa.
export function AssinaturaPad({ valor, onChange, altura = 140 }) {
  const canvasRef = useRef(null);
  const desenhando = useRef(false);
  const [vazio, setVazio] = useState(!valor);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ajustar = () => {
      const razao = window.devicePixelRatio || 1;
      const largura = canvas.offsetWidth;
      canvas.width = largura * razao;
      canvas.height = altura * razao;
      const ctx = canvas.getContext("2d");
      ctx.scale(razao, razao);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0B1F5C";
      if (valor) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, largura, altura);
        img.src = valor;
      }
    };
    ajustar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [altura]);

  const ponto = (event) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  };

  const iniciar = (event) => {
    event.preventDefault();
    canvasRef.current.setPointerCapture(event.pointerId);
    desenhando.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = ponto(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  };

  const mover = (event) => {
    if (!desenhando.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = ponto(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const terminar = () => {
    if (!desenhando.current) return;
    desenhando.current = false;
    setVazio(false);
    onChange?.(canvasRef.current.toDataURL("image/png"));
  };

  const limpar = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setVazio(true);
    onChange?.(null);
  };

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-gray-300 bg-white">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: altura, touchAction: "none" }}
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerLeave={terminar}
        />
        {vazio && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Assine aqui com o dedo
          </span>
        )}
      </div>
      <button type="button" onClick={limpar} className="mt-1 text-xs font-semibold text-red-700">
        Limpar visto
      </button>
    </div>
  );
}

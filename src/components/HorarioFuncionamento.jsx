// Editor do horário de funcionamento do ponto (cadastro da máquina e página
// Machine Pay). Conversões e formato em utils/horarioFuncionamento.js.
import { DIAS_SEMANA } from "../utils/horarioFuncionamento";

export function HorarioFuncionamentoEditor({ valor, onChange }) {
  const { temHorario, dias } = valor;

  const alterarDia = (dia, campo, novo) =>
    onChange({ temHorario, dias: { ...dias, [dia]: { ...dias[dia], [campo]: novo } } });

  // Copia o horário do primeiro dia marcado para os outros dias marcados
  const replicarHorario = () => {
    const base = DIAS_SEMANA.map(([dia]) => dias[dia]).find((d) => d.ativo);
    if (!base) return;
    onChange({
      temHorario,
      dias: Object.fromEntries(
        Object.entries(dias).map(([dia, d]) => [
          dia,
          d.ativo ? { ...d, inicio: base.inicio, fim: base.fim } : d,
        ])
      ),
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="radio" checked={!temHorario} onChange={() => onChange({ temHorario: false, dias })} />
          Fica ligada 24h, todos os dias
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="radio" checked={temHorario} onChange={() => onChange({ temHorario: true, dias })} />
          Só em dias e horários definidos
        </label>
      </div>

      {temHorario && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="space-y-2">
            {DIAS_SEMANA.map(([dia, nome]) => {
              const d = dias[dia];
              return (
                <div key={dia} className="flex flex-wrap items-center gap-3">
                  <label className="flex w-32 items-center gap-2 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={d.ativo}
                      onChange={(e) => alterarDia(dia, "ativo", e.target.checked)}
                    />
                    {nome}
                  </label>
                  {d.ativo ? (
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        type="time"
                        value={d.inicio}
                        onChange={(e) => alterarDia(dia, "inicio", e.target.value)}
                        className="input-field w-32 py-1.5"
                      />
                      <span className="text-gray-500">às</span>
                      <input
                        type="time"
                        value={d.fim}
                        onChange={(e) => alterarDia(dia, "fim", e.target.value)}
                        className="input-field w-32 py-1.5"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Fechado</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500">
              Se o fechamento for menor que a abertura (ex: 18:00 às 02:00), conta como virando a noite.
            </p>
            <button
              type="button"
              onClick={replicarHorario}
              className="text-sm font-semibold text-[#2457B1] hover:underline"
            >
              Usar o 1º horário em todos os dias marcados
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

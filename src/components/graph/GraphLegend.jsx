import { useState } from "react";
import { Info, X } from "lucide-react";

export default function GraphLegend() {
  const [open, setOpen] = useState(false);

  const statuses = [
    { label: "Ativo", color: "#22c55e" },
    { label: "Prospect", color: "#f59e0b" },
    { label: "Parceiro", color: "#3b82f6" },
    { label: "Cliente", color: "#8b5cf6" },
    { label: "Investidor", color: "#ec4899" },
    { label: "Inativo", color: "#94a3b8" },
  ];

  const nextSteps = [
    { label: "Pendente", color: "#f59e0b" },
    { label: "Aguardando", color: "#3b82f6" },
    { label: "Atrasado", color: "#ef4444" },
    { label: "Concluído", color: "#22c55e" },
    { label: "Sem próximo passo", color: "#94a3b8" },
  ];

  return (
    <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
      {open && (
        <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl p-3 text-xs space-y-3 shadow-xl w-64">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-200 font-semibold text-sm">Legenda</span>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <p className="text-slate-400 font-semibold mb-1.5 uppercase tracking-wide text-[10px]">Borda interna — Status</p>
            <div className="flex flex-wrap gap-2">
              {statuses.map(s => (
                <div key={s.label} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: s.color, background: "transparent" }} />
                  <span className="text-slate-300">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-slate-400 font-semibold mb-1.5 uppercase tracking-wide text-[10px]">Anel externo — Próximo Passo</p>
            <div className="flex flex-wrap gap-2">
              {nextSteps.map(s => (
                <div key={s.label} className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full border-2 opacity-50" style={{ borderColor: s.color }} />
                  <span className="text-slate-300">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-lg"
        title="Legenda"
      >
        <Info className="w-4 h-4" />
      </button>
    </div>
  );
}
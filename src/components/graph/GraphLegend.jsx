export default function GraphLegend() {
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
    <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-xl p-3 text-xs space-y-2">
      <div>
        <p className="text-slate-400 font-semibold mb-1 uppercase tracking-wide">Borda interna — Status</p>
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
        <p className="text-slate-400 font-semibold mb-1 uppercase tracking-wide">Anel externo — Próximo Passo</p>
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
  );
}
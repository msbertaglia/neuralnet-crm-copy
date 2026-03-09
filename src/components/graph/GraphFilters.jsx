import { useState } from "react";
import { Filter, X, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS = ["ativo", "inativo", "prospect", "parceiro", "cliente", "investidor"];
const NEXT_STEP_OPTIONS = ["pendente", "aguardando", "atrasado", "concluido", "sem_proximo_passo"];

export default function GraphFilters({ filters, onChange, projects }) {
  const [open, setOpen] = useState(false);

  const toggle = (key, val) => {
    const arr = filters[key] || [];
    const next = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
    onChange({ ...filters, [key]: next });
  };

  const clearAll = () => onChange({ statuses: [], nextSteps: [], projectIds: [] });
  const activeCount = (filters.statuses?.length || 0) + (filters.nextSteps?.length || 0) + (filters.projectIds?.length || 0);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700 gap-2"
      >
        <Filter className="w-4 h-4" />
        Filtros
        {activeCount > 0 && (
          <Badge className="bg-blue-500 text-white text-xs px-1.5 py-0 h-4">{activeCount}</Badge>
        )}
        <ChevronDown className="w-3 h-3" />
      </Button>

      {open && (
        <div className="absolute top-10 right-0 z-50 bg-slate-900 border border-slate-700 rounded-xl p-4 w-72 shadow-2xl space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-slate-200 font-semibold text-sm">Filtros</span>
            <div className="flex gap-2">
              {activeCount > 0 && (
                <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-300">Limpar</button>
              )}
              <button onClick={() => setOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Status do Contato</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => toggle("statuses", s)}
                  className={`px-2 py-0.5 rounded-full text-xs border transition-all ${
                    filters.statuses?.includes(s)
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "border-slate-600 text-slate-400 hover:border-slate-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Próximo Passo</p>
            <div className="flex flex-wrap gap-1.5">
              {NEXT_STEP_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => toggle("nextSteps", s)}
                  className={`px-2 py-0.5 rounded-full text-xs border transition-all ${
                    filters.nextSteps?.includes(s)
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "border-slate-600 text-slate-400 hover:border-slate-400"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {projects?.length > 0 && (
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Projeto</p>
              <div className="flex flex-wrap gap-1.5">
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => toggle("projectIds", p.id)}
                    className={`px-2 py-0.5 rounded-full text-xs border transition-all ${
                      filters.projectIds?.includes(p.id)
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "border-slate-600 text-slate-400 hover:border-slate-400"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
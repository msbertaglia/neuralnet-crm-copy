import { useState } from "react";
import { Filter, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_OPTIONS = ["ativo", "inativo", "prospect", "parceiro", "cliente", "investidor"];

const STATUS_COLORS = {
  ativo:      { active: "bg-green-500/20 border-green-500/50 text-green-300",    dot: "bg-green-400" },
  inativo:    { active: "bg-slate-500/20 border-slate-400/50 text-slate-300",    dot: "bg-slate-400" },
  prospect:   { active: "bg-amber-500/20 border-amber-500/50 text-amber-300",    dot: "bg-amber-400" },
  parceiro:   { active: "bg-blue-500/20 border-blue-500/50 text-blue-300",       dot: "bg-blue-400" },
  cliente:    { active: "bg-purple-500/20 border-purple-500/50 text-purple-300", dot: "bg-purple-400" },
  investidor: { active: "bg-pink-500/20 border-pink-500/50 text-pink-300",       dot: "bg-pink-400" },
};

export default function GraphFilters({ filters, onChange, contacts = [] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState({ statuses: filters.statuses || [], tags: filters.tags || [] });

  const activeCount = (filters.statuses?.length || 0) + (filters.tags?.length || 0);

  // Compute counts from all contacts
  const statusCounts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = contacts.filter(c => c.status === s).length;
    return acc;
  }, {});

  const allTags = Array.from(new Set(contacts.flatMap(c => c.tags || []))).sort();
  const tagCounts = allTags.reduce((acc, t) => {
    acc[t] = contacts.filter(c => (c.tags || []).includes(t)).length;
    return acc;
  }, {});

  const toggleStatus = (s) => {
    setPending(prev => ({
      ...prev,
      statuses: prev.statuses.includes(s)
        ? prev.statuses.filter(x => x !== s)
        : [...prev.statuses, s],
    }));
  };

  const toggleTag = (t) => {
    setPending(prev => ({
      ...prev,
      tags: prev.tags.includes(t)
        ? prev.tags.filter(x => x !== t)
        : [...prev.tags, t],
    }));
  };

  const applyFilters = () => {
    onChange(pending);
    setOpen(false);
  };

  const clearFilters = () => {
    const cleared = { statuses: [], tags: [] };
    setPending(cleared);
    onChange(cleared);
  };

  const pendingCount = (pending.statuses?.length || 0) + (pending.tags?.length || 0);

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
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <div className="absolute top-10 right-0 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-80">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-slate-800">
            <span className="text-slate-200 font-semibold text-sm">Filtros</span>
            <div className="flex gap-3 items-center">
              {pendingCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-red-400 hover:text-red-300">
                  Limpar
                </button>
              )}
              <button onClick={() => setOpen(false)}>
                <X className="w-4 h-4 text-slate-400 hover:text-slate-200" />
              </button>
            </div>
          </div>

          {/* Status section */}
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-2.5">Status do Contato</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map(s => {
                const colors = STATUS_COLORS[s];
                const isActive = pending.statuses.includes(s);
                const count = statusCounts[s] || 0;
                return (
                  <button
                    key={s}
                    onClick={() => toggleStatus(s)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      isActive
                        ? colors.active
                        : "border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? colors.dot : "bg-slate-600"}`} />
                    {s}
                    <span className={`text-[10px] ${isActive ? "opacity-80" : "text-slate-600"}`}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags section */}
          {allTags.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-2.5">Tags</p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {allTags.map(t => {
                  const isActive = pending.tags.includes(t);
                  const count = tagCounts[t] || 0;
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all flex items-center gap-1 ${
                        isActive
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                          : "border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {t}
                      <span className={`text-[10px] ${isActive ? "opacity-80" : "text-slate-600"}`}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-800">
            <Button
              size="sm"
              onClick={applyFilters}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white"
            >
              {pendingCount > 0 ? `Filtrar (${pendingCount} selecionado${pendingCount > 1 ? "s" : ""})` : "Filtrar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
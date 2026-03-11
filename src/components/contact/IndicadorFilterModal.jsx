import { useState, useMemo } from "react";
import { X, Search, Users, Check } from "lucide-react";

export default function IndicadorFilterModal({ contacts, activeFilter, onApply, onClose }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set(activeFilter || []));

  // Build list of introducers sorted by count desc
  const introducers = useMemo(() => {
    const map = {};
    contacts.forEach(c => {
      if (c.introduced_by_id && c.introduced_by_name) {
        if (!map[c.introduced_by_id]) {
          map[c.introduced_by_id] = { id: c.introduced_by_id, name: c.introduced_by_name, count: 0 };
        }
        map[c.introduced_by_id].count++;
      }
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [contacts]);

  const filtered = introducers.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    onApply(Array.from(selected));
    onClose();
  };

  const handleClear = () => {
    onApply([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-white font-bold text-base">Filtrar por Indicador</h3>
            <p className="text-slate-400 text-xs mt-0.5">Selecione um ou mais indicadores</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar indicador..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum indicador encontrado</p>
            </div>
          ) : (
            filtered.map(introducer => {
              const isSelected = selected.has(introducer.id);
              return (
                <button
                  key={introducer.id}
                  onClick={() => toggle(introducer.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isSelected ? "bg-blue-600/20 border border-blue-500/30" : "hover:bg-slate-800 border border-transparent"
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                    isSelected ? "bg-blue-600 border-blue-600" : "border-slate-600"
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{introducer.name}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isSelected ? "bg-blue-500/30 text-blue-300" : "bg-slate-700 text-slate-400"
                  }`}>
                    {introducer.count} contato{introducer.count !== 1 ? "s" : ""}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800 flex gap-2">
          <button
            onClick={handleClear}
            className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm transition-colors"
          >
            Limpar filtro
          </button>
          <button
            onClick={handleApply}
            disabled={selected.size === 0}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            Aplicar {selected.size > 0 && `(${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
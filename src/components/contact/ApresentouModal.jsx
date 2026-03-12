import { useState, useMemo } from "react";
import { X, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ApresentouModal({ contact, allContacts, onConfirm, onClose }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());

  // Only contacts with no introducer (sem_informacao or empty), excluding the contact itself
  const candidates = useMemo(() => {
    return allContacts.filter(c =>
      c.id !== contact.id &&
      (!c.introduced_by_id || c.introduced_by_id === "sem_informacao")
    );
  }, [allContacts, contact.id]);

  const filtered = useMemo(() => {
    if (!search) return candidates;
    const s = search.toLowerCase();
    return candidates.filter(c =>
      c.name?.toLowerCase().includes(s) ||
      c.company?.toLowerCase().includes(s)
    );
  }, [candidates, search]);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const chosen = allContacts.filter(c => selected.has(c.id));
    onConfirm(chosen);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <p className="text-white font-semibold text-sm">Apresentou contatos</p>
            <p className="text-slate-400 text-xs mt-0.5">{contact.name} apresentou quem?</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar contatos sem apresentador..."
              className="pl-9 bg-slate-800 border-slate-600 text-slate-200 text-sm h-9"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
              <Users className="w-8 h-8" />
              <p className="text-sm">Nenhum contato sem apresentador</p>
            </div>
          ) : (
            filtered.map(c => (
              <label
                key={c.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="w-4 h-4 accent-blue-500"
                />
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {c.photo_url ? (
                    <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-slate-300">
                      {c.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm font-medium truncate">{c.name}</p>
                  {c.company && <p className="text-slate-500 text-xs truncate">{c.company}</p>}
                </div>
              </label>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-700">
          <span className="text-slate-400 text-xs">
            {selected.size > 0 ? `${selected.size} selecionado(s)` : "Nenhum selecionado"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}
              className="border-slate-600 text-slate-300 hover:bg-slate-800">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={selected.size === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white">
              OK
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
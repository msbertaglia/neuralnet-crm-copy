import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_COLORS = {
  prospect:      "bg-amber-500/20 text-amber-300 border-amber-500/40",
  desconhecidos: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  empresas:      "bg-blue-500/20 text-blue-300 border-blue-500/40",
  familia:       "bg-pink-500/20 text-pink-300 border-pink-500/40",
  profissional:  "bg-green-500/20 text-green-300 border-green-500/40",
  outros:        "bg-purple-500/20 text-purple-300 border-purple-500/40",
};
const DEFAULT_COLOR = "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";

const DEFAULT_STATUSES = [
  { label: "prospect" },
  { label: "desconhecidos" },
  { label: "empresas" },
  { label: "familia" },
  { label: "profissional" },
  { label: "outros" },
];

export default function StatusManagerModal({ contacts, onClose, onStatusesChanged }) {
  const [statuses, setStatuses] = useState([]);
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selected, setSelected] = useState(new Set());

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  useEffect(() => { loadStatuses(); }, []);

  const loadStatuses = async () => {
    setLoading(true);
    let list = await base44.entities.ContactStatus.list("label");
    if (list.length === 0) {
      await base44.entities.ContactStatus.bulkCreate(DEFAULT_STATUSES);
      list = await base44.entities.ContactStatus.list("label");
    }
    setStatuses(list);
    setLoading(false);
  };

  const handleCreate = async () => {
    const trimmed = newLabel.trim().toLowerCase();
    if (!trimmed) return;
    if (statuses.some(s => s.label.toLowerCase() === trimmed)) return;
    await base44.entities.ContactStatus.create({ label: trimmed });
    setNewLabel("");
    await loadStatuses();
    if (onStatusesChanged) onStatusesChanged();
  };

  const handleDelete = async (status) => {
    await base44.entities.ContactStatus.delete(status.id);
    setConfirmDelete(null);
    await loadStatuses();
    if (onStatusesChanged) onStatusesChanged();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Status</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 mb-4 max-h-[60vh] overflow-y-auto">
            {statuses.map(s => {
              const count = contacts.filter(c => c.status === s.label).length;
              return (
                <div key={s.id} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                    className="accent-blue-500 w-4 h-4 flex-shrink-0"
                  />
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded border capitalize flex-shrink-0 ${STATUS_COLORS[s.label.toLowerCase()] || DEFAULT_COLOR}`}>
                    {s.label}
                  </span>
                  <span className="text-slate-400 text-sm ml-auto">{count} contato{count !== 1 ? "s" : ""}</span>
                  <button
                    onClick={() => setConfirmDelete(s)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-slate-800">
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            placeholder="Novo status..."
            className="bg-slate-800 border-slate-700 text-slate-200 text-sm h-9"
          />
          <Button onClick={handleCreate} size="sm" className="bg-blue-600 hover:bg-blue-700 h-9 px-3">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-xs shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <h3 className="text-white font-semibold">Apagar status?</h3>
            </div>
            <p className="text-slate-400 text-sm mb-5">
              Tem certeza que deseja apagar o status{" "}
              <span className="text-white font-medium">"{confirmDelete.label}"</span>?
              {contacts.filter(c => c.status === confirmDelete.label).length > 0 && (
                <span className="block mt-1 text-amber-400">
                  Atenção: {contacts.filter(c => c.status === confirmDelete.label).length} contato(s) usam esse status.
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)} className="flex-1 border-slate-700 text-slate-300">
                Cancelar
              </Button>
              <Button size="sm" onClick={() => handleDelete(confirmDelete)} className="flex-1 bg-red-600 hover:bg-red-700">
                Apagar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
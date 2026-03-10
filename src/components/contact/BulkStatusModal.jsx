import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_COLORS = {
  prospect:      "bg-amber-500/20 text-amber-300 border-amber-500/40",
  desconhecidos: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  empresas:      "bg-blue-500/20 text-blue-300 border-blue-500/40",
  familia:       "bg-pink-500/20 text-pink-300 border-pink-500/40",
  profissional:  "bg-green-500/20 text-green-300 border-green-500/40",
  outros:        "bg-purple-500/20 text-purple-300 border-purple-500/40",
};
const DEFAULT_COLOR = "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";

export default function BulkStatusModal({ selectedContacts, onClose, onDone }) {
  const [statuses, setStatuses] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    base44.entities.ContactStatus.list("label").then(setStatuses);
  }, []);

  const handleMigrate = async () => {
    if (!selectedStatus) return;
    setLoading(true);
    await Promise.all(
      selectedContacts.map(c => base44.entities.Contact.update(c.id, { status: selectedStatus.label }))
    );
    setLoading(false);
    onDone();
  };

  const count = selectedContacts.length;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Alterar Status</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          <span className="text-white font-semibold">{count} contato{count !== 1 ? "s" : ""}</span> selecionado{count !== 1 ? "s" : ""}. Escolha o novo status:
        </p>

        <div className="space-y-2 mb-4 max-h-[60vh] overflow-y-auto">
          {statuses.map(s => (
            <div key={s.id} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
              <input
                type="checkbox"
                checked={selectedStatus?.id === s.id}
                onChange={() => setSelectedStatus(prev => prev?.id === s.id ? null : s)}
                className="accent-blue-500 w-4 h-4 flex-shrink-0"
              />
              <span className={`text-xs font-semibold px-2.5 py-1 rounded border capitalize flex-shrink-0 ${STATUS_COLORS[s.label.toLowerCase()] || DEFAULT_COLOR}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800">
            Cancelar
          </Button>
          <Button
            onClick={handleMigrate}
            disabled={!selectedStatus || loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Alterando..." : "Alterar Status"}
          </Button>
        </div>
      </div>
    </div>
  );
}
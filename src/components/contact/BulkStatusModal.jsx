import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_COLOR = "bg-slate-700 text-slate-300 border-slate-600";

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">Alterar Status</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          <span className="text-white font-semibold">{count} contato{count !== 1 ? "s" : ""}</span> selecionado{count !== 1 ? "s" : ""}. Escolha o novo status:
        </p>

        <div className="space-y-2 mb-5 max-h-64 overflow-y-auto">
          {statuses.map(s => (
            <label
              key={s.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedStatus?.id === s.id
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-700 hover:border-slate-500 hover:bg-slate-800"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatus?.id === s.id}
                onChange={() => setSelectedStatus(prev => prev?.id === s.id ? null : s)}
                className="accent-blue-500 w-4 h-4"
              />
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border capitalize ${DEFAULT_COLOR}`}>
                {s.label}
              </span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800">
            Cancelar
          </Button>
          <Button
            onClick={handleMigrate}
            disabled={!selectedStatus || loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Migrando..." : `Migrar ${count} contato${count !== 1 ? "s" : ""} para "${selectedStatus?.label || "..."}"`}
          </Button>
        </div>
      </div>
    </div>
  );
}
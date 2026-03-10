import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_COLORS = {
  prospect:      "bg-amber-500/20 text-amber-400 border-amber-500/30",
  desconhecidos: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  empresas:      "bg-blue-500/20 text-blue-400 border-blue-500/30",
  familia:       "bg-pink-500/20 text-pink-400 border-pink-500/30",
  profissional:  "bg-green-500/20 text-green-400 border-green-500/30",
  outros:        "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const STATUSES = [
  { value: "prospect",      label: "Prospect" },
  { value: "desconhecidos", label: "Desconhecidos" },
  { value: "empresas",      label: "Empresas" },
  { value: "familia",       label: "Família" },
  { value: "profissional",  label: "Profissional" },
  { value: "outros",        label: "Outros" },
];

export default function BulkStatusModal({ selectedContacts, onClose, onDone }) {
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleMigrate = async () => {
    if (!selectedStatus) return;
    setLoading(true);
    await Promise.all(
      selectedContacts.map(c => base44.entities.Contact.update(c.id, { status: selectedStatus }))
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
                selectedStatus === s.label
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-700 hover:border-slate-500 hover:bg-slate-800"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStatus === s.label}
                onChange={() => setSelectedStatus(prev => prev === s.label ? null : s.label)}
                className="accent-blue-500 w-4 h-4"
              />
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${STATUS_COLORS[s.label] || "bg-slate-700 text-slate-300 border-slate-600"}`}>
                {s.label}
              </span>
            </label>
          ))}
          {statuses.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">Nenhum status cadastrado.</p>
          )}
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
            {loading ? "Migrando..." : `Migrar ${count} contato${count !== 1 ? "s" : ""} para "${selectedStatus || "..."}"`}
          </Button>
        </div>
      </div>
    </div>
  );
}
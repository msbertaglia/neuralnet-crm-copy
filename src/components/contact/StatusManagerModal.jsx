import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function StatusManagerModal({ contacts, onClose, onStatusesChanged }) {
  const [statuses, setStatuses] = useState([]);
  const [newLabel, setNewLabel] = useState("");
  const [deleteError, setDeleteError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStatuses(); }, []);

  const loadStatuses = async () => {
    setLoading(true);
    const list = await base44.entities.ContactStatus.list("label");
    setStatuses(list);
    setLoading(false);
  };

  const handleCreate = async () => {
    const trimmed = newLabel.trim().toLowerCase();
    if (!trimmed) return;
    const exists = statuses.some(s => s.label.toLowerCase() === trimmed);
    if (exists) return;
    await base44.entities.ContactStatus.create({ label: trimmed });
    setNewLabel("");
    await loadStatuses();
    onStatusesChanged();
  };

  const handleDelete = async (status) => {
    setDeleteError(null);
    const inUse = contacts.filter(c => c.status === status.label);
    if (inUse.length > 0) {
      setDeleteError(`Não é possível apagar "${status.label}": ${inUse.length} contato(s) com esse status.`);
      return;
    }
    await base44.entities.ContactStatus.delete(status.id);
    await loadStatuses();
    onStatusesChanged();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Gerenciar Status</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing statuses */}
        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="py-4 flex justify-center">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : statuses.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">Nenhum status cadastrado.</p>
          ) : statuses.map(status => {
            const count = contacts.filter(c => c.status === status.label).length;
            return (
              <div key={status.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                <div>
                  <span className="text-white text-sm font-medium">{status.label}</span>
                  <span className="text-slate-500 text-xs ml-2">({count} contato{count !== 1 ? 's' : ''})</span>
                </div>
                <button
                  onClick={() => handleDelete(status)}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                  title="Apagar status"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {deleteError && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-xs">{deleteError}</p>
          </div>
        )}

        {/* Add new status */}
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
    </div>
  );
}
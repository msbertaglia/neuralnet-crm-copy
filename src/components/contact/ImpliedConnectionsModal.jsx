import { AlertTriangle, Link2, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImpliedConnectionsModal({ newImplied, updatedConnections, onConfirm, onCancel, saving }) {
  const hasNew = newImplied?.length > 0;
  const hasUpdated = updatedConnections?.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-base">Alterações em Conexões</h2>
            <p className="text-slate-400 text-xs mt-0.5">Confirme as conexões afetadas por esta gravação</p>
          </div>
          <button onClick={onCancel} className="ml-auto text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-80 overflow-y-auto">
          {hasNew && (
            <div>
              <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Novas conexões implícitas
              </p>
              <div className="space-y-2">
                {newImplied.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
                    <Link2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="text-white text-sm font-medium">{c.contact_a_name}</span>
                    <span className="text-slate-500 text-xs">↔</span>
                    <span className="text-white text-sm font-medium">{c.contact_b_name}</span>
                    <span className="ml-auto text-xs text-slate-500 italic">implícita</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasUpdated && (
            <div>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Conexões atualizadas
              </p>
              <div className="space-y-2">
                {updatedConnections.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
                    <Link2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="text-white text-sm font-medium">{c.contact_a_name}</span>
                    <span className="text-slate-500 text-xs">↔</span>
                    <span className="text-white text-sm font-medium">{c.contact_b_name}</span>
                    <span className="ml-auto text-xs text-blue-400">{c.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasNew && !hasUpdated && (
            <p className="text-slate-400 text-sm text-center py-4">Nenhuma conexão será afetada.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-800">
          <Button variant="outline" onClick={onCancel} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800" disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" disabled={saving}>
            {saving ? "Salvando..." : "Confirmar e Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
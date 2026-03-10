import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function BulkIndicadorModal({ selectedContacts, allContacts, onClose, onDone }) {
  const [search, setSearch] = useState("");
  const [selectedIndicador, setSelectedIndicador] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const filteredContacts = allContacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirm = async () => {
    if (!selectedIndicador) return;
    setIsLoading(true);
    try {
      await Promise.all(
        selectedContacts.map(contact =>
          base44.entities.Contact.update(contact.id, {
            introduced_by_id: selectedIndicador.id,
            introduced_by_name: selectedIndicador.name,
          })
        )
      );
      onDone();
    } catch (error) {
      console.error("Erro ao atualizar indicadores:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh] w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 flex-shrink-0">
          <div>
            <h3 className="text-white font-bold text-lg">Indicador</h3>
            <p className="text-slate-400 text-sm mt-1">
              Selecione uma pessoa para indicar {selectedContacts.length} contato{selectedContacts.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-800 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pessoa para indicar..."
              className="pl-10 h-9 bg-slate-800 border-slate-700 text-slate-200 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Lista de contatos */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">Nenhum contato encontrado</p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setSelectedIndicador(contact)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors border ${
                  selectedIndicador?.id === contact.id
                    ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                    : "border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-400">
                    {contact.photo_url ? (
                      <img src={contact.photo_url} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      contact.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{contact.name}</p>
                    {contact.company && <p className="text-slate-500 text-xs truncate">{contact.company}</p>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-slate-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedIndicador || isLoading}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {isLoading ? "Atualizando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
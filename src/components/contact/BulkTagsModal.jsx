import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BulkTagsModal({ selectedContacts, allContacts, onClose, onDone }) {
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Extrai tags únicas de todos os contatos
    const tagSet = new Set();
    allContacts.forEach(c => {
      (c.tags || []).forEach(t => tagSet.add(t));
    });
    setTags(Array.from(tagSet).sort());
  }, [allContacts]);

  const toggleTag = (tag) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  const handleAddTags = async () => {
    if (selectedTags.size === 0) return;
    setLoading(true);
    
    const tagsToAdd = Array.from(selectedTags);
    await Promise.all(
      selectedContacts.map(c => {
        const currentTags = c.tags || [];
        const newTags = Array.from(new Set([...currentTags, ...tagsToAdd]));
        return base44.entities.Contact.update(c.id, { tags: newTags });
      })
    );
    
    setLoading(false);
    onDone();
  };

  const count = selectedContacts.length;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Adicionar Tags</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          <span className="text-white font-semibold">{count} contato{count !== 1 ? "s" : ""}</span> selecionado{count !== 1 ? "s" : ""}. Escolha as tags para adicionar:
        </p>

        <div className="space-y-2 mb-4 max-h-[60vh] overflow-y-auto">
          {tags.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">Nenhuma tag disponível</p>
          ) : (
            tags.map(tag => (
              <div key={tag} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selectedTags.has(tag)}
                  onChange={() => toggleTag(tag)}
                  className="accent-blue-500 w-4 h-4 flex-shrink-0 bg-slate-700 border border-slate-600 rounded cursor-pointer"
                />
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-700 text-slate-300 flex-shrink-0">
                  {tag}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800">
            Cancelar
          </Button>
          <Button
            onClick={handleAddTags}
            disabled={selectedTags.size === 0 || loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Adicionando..." : "Adicionar Tags"}
          </Button>
        </div>
      </div>
    </div>
  );
}
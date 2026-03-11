import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BulkTagsModal({ selectedContacts, allContacts, onClose, onDone }) {
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [addingNew, setAddingNew] = useState(false);

  useEffect(() => {
    const tagSet = new Set();
    allContacts.forEach(c => {
      (c.tags || []).forEach(t => tagSet.add(t));
    });
    setTags(Array.from(tagSet).sort());
  }, [allContacts]);

  // Count contacts per tag from allContacts
  const tagCounts = {};
  allContacts.forEach(c => {
    (c.tags || []).forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });

  const toggleTag = (tag) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  const handleAddTags = async () => {
    if (selectedTags.size === 0) {
      // No tags selected → open new tag input
      setAddingNew(true);
      return;
    }
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

  const handleCreateNewTag = async () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    setLoading(true);
    await Promise.all(
      selectedContacts.map(c => {
        const currentTags = c.tags || [];
        if (currentTags.includes(trimmed)) return Promise.resolve();
        return base44.entities.Contact.update(c.id, { tags: [...currentTags, trimmed] });
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

        {addingNew ? (
          <div className="mb-4">
            <p className="text-slate-400 text-sm mb-2">Digite o nome da nova tag:</p>
            <input
              autoFocus
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateNewTag()}
              placeholder="Nome da nova tag..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        ) : (
          <div className="space-y-2 mb-4 max-h-[50vh] overflow-y-auto">
            {tags.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">Nenhuma tag disponível. Clique em "Adicionar Tags" para criar uma nova.</p>
            ) : (
              tags.map(tag => (
                <div key={tag} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedTags.has(tag)}
                    onChange={() => toggleTag(tag)}
                    className="accent-blue-500 w-4 h-4 flex-shrink-0 cursor-pointer"
                  />
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-700 text-slate-300 flex-shrink-0 flex-1 truncate">
                    {tag}
                  </span>
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {tagCounts[tag] || 0} contato{(tagCounts[tag] || 0) !== 1 ? "s" : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={addingNew ? () => setAddingNew(false) : onClose} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800">
            {addingNew ? "Voltar" : "Cancelar"}
          </Button>
          <Button
            onClick={addingNew ? handleCreateNewTag : handleAddTags}
            disabled={loading || (addingNew && !newTag.trim())}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 gap-1.5"
          >
            {loading ? "Salvando..." : addingNew ? "Criar tag" : selectedTags.size === 0 ? <><Plus className="w-3.5 h-3.5" /> Nova Tag</> : "Adicionar Tags"}
          </Button>
        </div>
      </div>
    </div>
  );
}
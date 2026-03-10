import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TagManagerModal({ contacts, onClose, onTagsChanged }) {
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { loadTags(); }, []);

  const loadTags = async () => {
    setLoading(true);
    // Extrai tags únicas de todos os contatos
    const tagSet = new Set();
    contacts.forEach(c => {
      (c.tags || []).forEach(t => tagSet.add(t));
    });
    setTags(Array.from(tagSet).sort());
    setLoading(false);
  };

  const handleCreate = async () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (tags.some(t => t.toLowerCase() === trimmed.toLowerCase())) return;
    
    // Apenas adiciona à lista local (as tags são criadas quando atribuídas aos contatos)
    setTags(prev => [...prev, trimmed].sort());
    setNewTag("");
  };

  const handleDelete = async (tag) => {
    // Remove a tag de todos os contatos que a têm
    await Promise.all(
      contacts
        .filter(c => (c.tags || []).includes(tag))
        .map(c => base44.entities.Contact.update(c.id, { tags: (c.tags || []).filter(t => t !== tag) }))
    );
    setConfirmDelete(null);
    await loadTags();
    if (onTagsChanged) onTagsChanged();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Tags</h2>
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
            {tags.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">Nenhuma tag criada</p>
            ) : (
              tags.map(tag => {
                const count = contacts.filter(c => (c.tags || []).includes(tag)).length;
                return (
                  <div key={tag} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-700 text-slate-300 flex-shrink-0">
                      {tag}
                    </span>
                    <span className="text-slate-400 text-sm ml-auto">{count} contato{count !== 1 ? "s" : ""}</span>
                    <button
                      onClick={() => setConfirmDelete(tag)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-slate-800">
          <Input
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            placeholder="Nova tag..."
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
              <h3 className="text-white font-semibold">Apagar tag?</h3>
            </div>
            <p className="text-slate-400 text-sm mb-5">
              Tem certeza que deseja apagar a tag{" "}
              <span className="text-white font-medium">"{confirmDelete}"</span>?
              {contacts.filter(c => (c.tags || []).includes(confirmDelete)).length > 0 && (
                <span className="block mt-1 text-amber-400">
                  Atenção: {contacts.filter(c => (c.tags || []).includes(confirmDelete)).length} contato(s) usam essa tag.
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
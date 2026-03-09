import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, Search } from "lucide-react";
import ConnectionForm from "@/components/contact/ConnectionForm";

const STRENGTH_COLORS = {
  fraca: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  media: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  forte: "bg-green-500/20 text-green-400 border-green-500/30",
};

const TYPE_LABELS = {
  profissional: "Profissional",
  pessoal: "Pessoal",
  negocios: "Negócios",
  parceria: "Parceria",
  cliente: "Cliente",
  fornecedor: "Fornecedor",
};

export default function Connections() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: () => base44.entities.Connection.list("-connection_date"),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("name"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Connection.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connections"] }),
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editingConnection
        ? base44.entities.Connection.update(editingConnection.id, data)
        : base44.entities.Connection.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      setShowForm(false);
      setEditingConnection(null);
    },
  });

  const filtered = connections.filter((c) => {
    const q = search.toLowerCase();
    return (
      (c.contact_a_name || "").toLowerCase().includes(q) ||
      (c.contact_b_name || "").toLowerCase().includes(q) ||
      (c.introduced_by_name || "").toLowerCase().includes(q)
    );
  });

  const handleEdit = (conn) => {
    setEditingConnection(conn);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingConnection(null);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white text-2xl font-bold">Conexões</h1>
          <p className="text-slate-500 text-sm mt-0.5">{connections.length} conexões registradas</p>
        </div>
        <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Nova Conexão
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome..."
          className="pl-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Contato A</th>
                <th className="px-4 py-3 text-left">Contato B</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Força</th>
                <th className="px-4 py-3 text-left">Apresentado por</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">Carregando...</td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">Nenhuma conexão encontrada</td>
                </tr>
              )}
              {filtered.map((conn, i) => (
                <tr
                  key={conn.id}
                  className={`hover:bg-slate-800/50 transition-colors ${i < filtered.length - 1 ? "border-b border-slate-800" : ""}`}
                >
                  <td className="px-4 py-3 text-white font-medium">{conn.contact_a_name || "—"}</td>
                  <td className="px-4 py-3 text-white font-medium">{conn.contact_b_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{TYPE_LABELS[conn.connection_type] || conn.connection_type || "—"}</td>
                  <td className="px-4 py-3">
                    {conn.strength ? (
                      <Badge className={`text-xs border ${STRENGTH_COLORS[conn.strength]}`}>{conn.strength}</Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{conn.introduced_by_name || <span className="text-slate-700">—</span>}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {conn.connection_date ? new Date(conn.connection_date + "T12:00:00").toLocaleDateString("pt-BR") : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleEdit(conn)}
                        className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(conn.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <ConnectionForm
          connection={editingConnection}
          contacts={contacts}
          onSave={(data) => saveMutation.mutate(data)}
          onCancel={() => { setShowForm(false); setEditingConnection(null); }}
        />
      )}
    </div>
  );
}
import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, Search, ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw } from "lucide-react";
import ConnectionForm from "@/components/contact/ConnectionForm";
import SmartDate from "@/components/ui/SmartDate";

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

const COLUMNS = [
  { key: "contact_a_name", label: "Contato A", width: 200, type: "alpha" },
  { key: "contact_b_name", label: "Contato B", width: 200, type: "alpha" },
  { key: "connection_type", label: "Tipo", width: 130, type: "alpha" },
  { key: "strength", label: "Força", width: 100, type: "alpha" },
  { key: "introduced_by_name", label: "Apresentado por", width: 180, type: "alpha" },
  { key: "connection_date", label: "Data da Conexão", width: 160, type: "date" },
  { key: "origin", label: "Origem", width: 110, type: "alpha" },
];

const ACTIONS_WIDTH = 80;

function SortIcon({ colKey, sortKey, sortDir }) {
  if (sortKey !== colKey) return <ChevronsUpDown className="w-3 h-3 text-slate-600 ml-1 inline flex-shrink-0" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 text-blue-400 ml-1 inline flex-shrink-0" />
    : <ChevronDown className="w-3 h-3 text-blue-400 ml-1 inline flex-shrink-0" />;
}

export default function Connections() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [sortKey, setSortKey] = useState("connection_date");
  const [sortDir, setSortDir] = useState("desc");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [rebuilding, setRebuilding] = useState(false);
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: () => base44.entities.Connection.list(),
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

  const handleSort = (col) => {
    if (sortKey === col.key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  };

  // Compute which implied connections are missing from DB
  const missingImplied = useMemo(() => {
    const implied = [];
    const usedPairs = new Set();
    connections.forEach(conn => {
      if (!conn.introduced_by_id) return;
      const intId = conn.introduced_by_id;
      const intName = conn.introduced_by_name;
      const pairs = [
        { id: conn.contact_a_id, name: conn.contact_a_name },
        { id: conn.contact_b_id, name: conn.contact_b_name },
      ];
      pairs.forEach(({ id: otherId, name: otherName }) => {
        if (otherId === intId) return;
        const pairKey = [intId, otherId].sort().join("|");
        if (usedPairs.has(pairKey)) return;
        const alreadyExists = connections.find(c =>
          (c.contact_a_id === intId && c.contact_b_id === otherId) ||
          (c.contact_b_id === intId && c.contact_a_id === otherId)
        );
        if (!alreadyExists) {
          usedPairs.add(pairKey);
          implied.push({ contact_a_id: intId, contact_a_name: intName, contact_b_id: otherId, contact_b_name: otherName });
        }
      });
    });
    return implied;
  }, [connections]);

  const handleRebuildImplied = async () => {
    if (missingImplied.length === 0) return;
    setRebuilding(true);
    for (const imp of missingImplied) {
      await base44.entities.Connection.create({
        ...imp,
        connection_type: "profissional",
        strength: "media",
        origin: "implicita",
      });
    }
    await queryClient.invalidateQueries({ queryKey: ["connections"] });
    setRebuilding(false);
  };

  const manualCount = connections.filter(c => c.origin !== "implicita").length;
  const implicitaCount = connections.filter(c => c.origin === "implicita").length;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = connections.filter((c) =>
      (c.contact_a_name || "").toLowerCase().includes(q) ||
      (c.contact_b_name || "").toLowerCase().includes(q) ||
      (c.introduced_by_name || "").toLowerCase().includes(q)
    );

    list.sort((a, b) => {
      const col = COLUMNS.find(c => c.key === sortKey);
      if (!col) return 0;
      if (col.type === "date") {
        const va = a[sortKey] ? new Date(a[sortKey]).getTime() : (sortDir === "asc" ? Infinity : -Infinity);
        const vb = b[sortKey] ? new Date(b[sortKey]).getTime() : (sortDir === "asc" ? Infinity : -Infinity);
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const va = a[sortKey] || "";
      const vb = b[sortKey] || "";
      const cmp = va.localeCompare(vb, "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [connections, search, sortKey, sortDir]);

  const totalWidth = COLUMNS.reduce((acc, c) => acc + c.width, 0) + ACTIONS_WIDTH;

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white text-2xl font-bold">Conexões</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {manualCount} manuais · <span className="text-slate-600">{implicitaCount} implícitas</span>
            {missingImplied.length > 0 && (
              <span className="text-amber-500 ml-2">· {missingImplied.length} implícita{missingImplied.length > 1 ? "s" : ""} ausente{missingImplied.length > 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-amber-600/50 text-amber-400 hover:bg-amber-600/10 gap-2"
            onClick={handleRebuildImplied}
            disabled={rebuilding || missingImplied.length === 0}
          >
            <RefreshCw className={`w-4 h-4 ${rebuilding ? "animate-spin" : ""}`} />
            {rebuilding ? "Recriando..." : `Recriar Implícitas${missingImplied.length > 0 ? ` (${missingImplied.length})` : ""}`}
          </Button>
          <Button onClick={() => { setEditingConnection(null); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Plus className="w-4 h-4" /> Nova Conexão
          </Button>
        </div>
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
          <div style={{ minWidth: totalWidth }}>
            {/* Header */}
            <div className="flex items-center border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10">
              {COLUMNS.map(col => (
                <div
                  key={col.key}
                  style={{ width: col.width, minWidth: col.width }}
                  className="flex-shrink-0 px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide select-none cursor-pointer hover:text-slate-300 transition-colors whitespace-nowrap"
                  onClick={() => handleSort(col)}
                >
                  <span className="flex items-center">
                    {col.label}
                    <SortIcon colKey={col.key} sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </div>
              ))}
              <div style={{ width: ACTIONS_WIDTH, minWidth: ACTIONS_WIDTH }} className="flex-shrink-0 px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center whitespace-nowrap">
                Ações
              </div>
            </div>

            {/* Rows */}
            {isLoading && (
              <div className="text-center py-12 text-slate-500 text-sm">Carregando...</div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-sm">Nenhuma conexão encontrada</div>
            )}
            {filtered.map((conn, i) => (
              <div
                key={conn.id}
                className={`flex items-center hover:bg-slate-800/50 transition-colors whitespace-nowrap ${i < filtered.length - 1 ? "border-b border-slate-800" : ""}`}
              >
                <div style={{ width: 200, minWidth: 200 }} className="flex-shrink-0 px-3 py-3 overflow-hidden">
                  <span className="text-white text-sm font-semibold truncate block">{conn.contact_a_name || <span className="text-slate-700">—</span>}</span>
                </div>
                <div style={{ width: 200, minWidth: 200 }} className="flex-shrink-0 px-3 py-3 overflow-hidden">
                  <span className="text-white text-sm font-semibold truncate block">{conn.contact_b_name || <span className="text-slate-700">—</span>}</span>
                </div>
                <div style={{ width: 130, minWidth: 130 }} className="flex-shrink-0 px-3 py-3 overflow-hidden">
                  <span className="text-slate-400 text-sm">{TYPE_LABELS[conn.connection_type] || conn.connection_type || <span className="text-slate-700">—</span>}</span>
                </div>
                <div style={{ width: 100, minWidth: 100 }} className="flex-shrink-0 px-3 py-3 overflow-hidden">
                  {conn.strength
                    ? <Badge className={`text-xs border ${STRENGTH_COLORS[conn.strength]}`}>{conn.strength}</Badge>
                    : <span className="text-slate-700">—</span>}
                </div>
                <div style={{ width: 180, minWidth: 180 }} className="flex-shrink-0 px-3 py-3 overflow-hidden">
                  <span className="text-slate-400 text-sm truncate block">{conn.introduced_by_name || <span className="text-slate-700">—</span>}</span>
                </div>
                <div style={{ width: 160, minWidth: 160 }} className="flex-shrink-0 px-3 py-3 overflow-hidden">
                  <SmartDate date={conn.connection_date} />
                </div>
                <div style={{ width: 110, minWidth: 110 }} className="flex-shrink-0 px-3 py-3 overflow-hidden">
                  {conn.origin === "implicita"
                    ? <Badge className="text-xs border bg-purple-500/15 text-purple-400 border-purple-500/30">Implícita</Badge>
                    : <Badge className="text-xs border bg-blue-500/15 text-blue-400 border-blue-500/30">Manual</Badge>
                  }
                </div>
                <div style={{ width: ACTIONS_WIDTH, minWidth: ACTIONS_WIDTH }} className="flex-shrink-0 px-3 py-3 flex items-center justify-center gap-1">
                  <button
                    onClick={() => { setEditingConnection(conn); setShowForm(true); }}
                    className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(conn.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {confirmDeleteId && (() => {
        const conn = connections.find(c => c.id === confirmDeleteId);
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
              <h3 className="text-white font-bold text-lg mb-2">Confirmar exclusão</h3>
              <p className="text-slate-400 text-sm mb-1">Tem certeza que deseja apagar a conexão entre:</p>
              <p className="text-white font-semibold text-sm mb-4">
                {conn?.contact_a_name} ↔ {conn?.contact_b_name}
              </p>
              <p className="text-slate-500 text-xs mb-6">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setConfirmDeleteId(null)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => { deleteMutation.mutate(confirmDeleteId); setConfirmDeleteId(null); }}
                >
                  Apagar
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Form Modal */}
      {showForm && (
        <ConnectionForm
          connection={editingConnection}
          contacts={contacts}
          existingConnections={connections}
          onSave={(data) => saveMutation.mutate(data)}
          onClose={() => { setShowForm(false); setEditingConnection(null); }}
        />
      )}
    </div>
  );
}
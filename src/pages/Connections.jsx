import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
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
  { key: "contact_a_name", label: "Contato A", width: 220, type: "alpha" },
  { key: "contact_b_name", label: "Contato B", width: 220, type: "alpha" },
  { key: "connection_type", label: "Tipo", width: 140, type: "alpha" },
  { key: "strength", label: "Força", width: 110, type: "alpha" },
  { key: "introduced_by_name", label: "Apresentado por", width: 200, type: "alpha" },
  { key: "connection_date", label: "Data da Conexão", width: 200, type: "date" },
];

const ACTIONS_WIDTH = 72;

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

  // Compute implied connections (introducer ↔ each contact)
  const impliedConnections = useMemo(() => {
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
        if (otherId === intId) return; // introducer is one of the contacts, skip
        const pairKey = [intId, otherId].sort().join("|");
        if (usedPairs.has(pairKey)) return;
        const alreadyExists = connections.find(c =>
          (c.contact_a_id === intId && c.contact_b_id === otherId) ||
          (c.contact_b_id === intId && c.contact_a_id === otherId)
        );
        if (!alreadyExists) {
          usedPairs.add(pairKey);
          implied.push({
            id: `implied-${conn.id}-${otherId}`,
            contact_a_id: intId,
            contact_a_name: intName,
            contact_b_id: otherId,
            contact_b_name: otherName,
            connection_type: null,
            strength: "fraca",
            introduced_by_id: null,
            introduced_by_name: null,
            connection_date: conn.connection_date,
            isImplied: true,
          });
        }
      });
    });
    return implied;
  }, [connections]);

  const allConnections = useMemo(() => [...connections, ...impliedConnections], [connections, impliedConnections]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = allConnections.filter((c) =>
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
  }, [allConnections, search, sortKey, sortDir]);

  const totalWidth = COLUMNS.reduce((acc, c) => acc + c.width, 0) + ACTIONS_WIDTH;

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white text-2xl font-bold">Conexões</h1>
          <p className="text-slate-500 text-sm mt-0.5">{connections.length} conexões registradas · <span className="text-slate-600">{impliedConnections.length} implícitas</span></p>
        </div>
        <Button onClick={() => { setEditingConnection(null); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
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
                {/* Contato A */}
                <div style={{ width: 220, minWidth: 220 }} className="flex-shrink-0 px-3 py-3 overflow-hidden">
                  <span className="text-white text-sm font-semibold">{conn.contact_a_name || <span className="text-slate-700">—</span>}</span>
                </div>
                {/* Contato B */}
                <div style={{ width: 220, minWidth: 220 }} className="flex-shrink-0 px-3 py-3 overflow-hidden">
                  <span className="text-white text-sm font-semibold">{conn.contact_b_name || <span className="text-slate-700">—</span>}</span>
                </div>
                {/* Tipo */}
                <div style={{ width: 140, minWidth: 140 }} className="flex-shrink-0 px-3 py-3 overflow-hidden">
                  <span className="text-slate-400 text-sm">{TYPE_LABELS[conn.connection_type] || conn.connection_type || <span className="text-slate-700">—</span>}</span>
                </div>
                {/* Força */}
                <div style={{ width: 110, minWidth: 110 }} className="flex-shrink-0 px-3 py-3 overflow-hidden">
                  {conn.strength
                    ? <Badge className={`text-xs border ${STRENGTH_COLORS[conn.strength]}`}>{conn.strength}</Badge>
                    : <span className="text-slate-700">—</span>}
                </div>
                {/* Apresentado por */}
                <div style={{ width: 200, minWidth: 200 }} className="flex-shrink-0 px-3 py-3 overflow-hidden">
                  <span className="text-slate-400 text-sm">{conn.introduced_by_name || <span className="text-slate-700">—</span>}</span>
                </div>
                {/* Data */}
                <div style={{ width: 200, minWidth: 200 }} className="flex-shrink-0 px-3 py-3 overflow-hidden">
                  <SmartDate date={conn.connection_date} />
                </div>
                {/* Ações */}
                <div style={{ width: ACTIONS_WIDTH, minWidth: ACTIONS_WIDTH }} className="flex-shrink-0 px-3 py-3 flex items-center justify-center gap-1">
                  {conn.isImplied ? (
                    <span className="text-xs text-slate-600 italic px-1">implícita</span>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditingConnection(conn); setShowForm(true); }}
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
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

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
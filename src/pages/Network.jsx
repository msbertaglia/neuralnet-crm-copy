import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Link2, Search, ZoomIn, ZoomOut, Maximize2, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NetworkGraph from "@/components/graph/NetworkGraph";
import GraphLegend from "@/components/graph/GraphLegend";
import GraphFilters from "@/components/graph/GraphFilters";
import ContactSidebar from "@/components/contact/ContactSidebar";
import ContactForm from "@/components/contact/ContactForm";
import MeetingLogForm from "@/components/contact/MeetingLogForm";
import LayoutModelToggle from "@/components/graph/LayoutModelToggle";

export default function Network() {
  const [contacts, setContacts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [selectedContact, setSelectedContact] = useState(null);
  const [centralContactId, setCentralContactId] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  const [showLogForm, setShowLogForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ statuses: [], tags: [], filterMode: "completo" });
  const [layoutModel, setLayoutModel] = useState("padrao");
  const [orbitDistance, setOrbitDistance] = useState(180);
  const [orbitInputValue, setOrbitInputValue] = useState("180");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [c, conn, p, l, d, u] = await Promise.all([
      base44.entities.Contact.list("-created_date", 500),
      base44.entities.Connection.list("-created_date", 500),
      base44.entities.Project.list(),
      base44.entities.MeetingLog.list("-date", 500),
      base44.entities.Document.list(),
      base44.auth.me().catch(() => null),
    ]);
    setContacts(c);
    setConnections(conn);
    setProjects(p);
    setLogs(l);
    setDocuments(d);
    setUser(u);
    // Set central contact to Mauro Bertaglia (always)
    const mauroContact = c.find(contact => contact.name === "Mauro Bertaglia");
    setCentralContactId(mauroContact?.id || null);
    setLoading(false);
  };

  const canEdit = user?.role === "admin" || user?.role === "editor";

  const filteredContacts = useMemo(() => {
    let list = contacts;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(s) ||
        c.company?.toLowerCase().includes(s) ||
        c.position?.toLowerCase().includes(s) ||
        c.tags?.some(t => t.toLowerCase().includes(s))
      );
    }
    if (filters.statuses?.length > 0) list = list.filter(c => filters.statuses.includes(c.status));
    if (filters.tags?.length > 0) list = list.filter(c => filters.tags.some(t => (c.tags || []).includes(t)));
    return list;
  }, [contacts, search, filters]);

  const hasActiveFilters = useMemo(() => {
    return (filters.statuses?.length > 0) || (filters.tags?.length > 0) || !!search;
  }, [filters, search]);

  // Build ancestor set: for each matched contact, walk up introduced_by chain
  const { highlightedIds, ancestorIds } = useMemo(() => {
    if (!hasActiveFilters) return { highlightedIds: null, ancestorIds: null };

    const matchedIds = new Set(filteredContacts.map(c => c.id));
    const ancestors = new Set();

    // Build a map: contactId -> introducerId
    const parentOf = {};
    contacts.forEach(c => {
      if (c.introduced_by_id && c.introduced_by_id !== "sem_informacao") {
        parentOf[c.id] = c.introduced_by_id === "direto" ? centralContactId : c.introduced_by_id;
      }
    });

    matchedIds.forEach(id => {
      let current = parentOf[id];
      while (current) {
        if (matchedIds.has(current)) break; // already highlighted
        ancestors.add(current);
        current = parentOf[current];
      }
    });

    return { highlightedIds: matchedIds, ancestorIds: ancestors };
  }, [hasActiveFilters, filteredContacts, contacts, centralContactId]);

  const handleSaveContact = async (data) => {
    await doSaveContact(data, editingContact?.id);
  };

  const doSaveContact = async (data, editingId) => {
    if (editingId) {
      await base44.entities.Contact.update(editingId, data);
    } else {
      await base44.entities.Contact.create(data);
    }
    setShowContactForm(false);
    setEditingContact(null);
    await loadAll();
  };



  const handleSaveLog = async (data) => {
    await base44.entities.MeetingLog.create(data);
    setShowLogForm(false);
    // update last contact date
    if (data.contact_id) {
      await base44.entities.Contact.update(data.contact_id, { last_contact_date: data.date });
    }
    await loadAll();
  };

  const contactLogs = selectedContact ? logs.filter(l => l.contact_id === selectedContact.id) : [];
  const contactDocs = selectedContact ? documents.filter(d => d.contact_id === selectedContact.id) : [];

  const stats = useMemo(() => {
    const atrasados = contacts.filter(c => c.next_step_status === "atrasado").length;
    const pendentes = contacts.filter(c => c.next_step_status === "pendente").length;
    const aguardando = contacts.filter(c => c.next_step_status === "aguardando").length;
    return { total: contacts.length, atrasados, pendentes, aguardando };
  }, [contacts]);

  return (
    <div className="h-screen w-full bg-slate-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex-shrink-0 relative z-50">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-base hidden sm:block">NetMap</span>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar pessoas..."
            className="pl-9 h-8 bg-slate-800 border-slate-700 text-slate-200 text-sm placeholder:text-slate-500"
          />
        </div>

        {/* Stats pills */}
        <div className="hidden md:flex items-center gap-2">
          <StatPill label="Total" value={stats.total} color="text-slate-300" />
          {stats.atrasados > 0 && <StatPill label="Atrasados" value={stats.atrasados} color="text-red-400" dot="#ef4444" />}
          {stats.pendentes > 0 && <StatPill label="Pendentes" value={stats.pendentes} color="text-amber-400" dot="#f59e0b" />}
          {stats.aguardando > 0 && <StatPill label="Aguardando" value={stats.aguardando} color="text-blue-400" dot="#3b82f6" />}
        </div>

        <div className="flex-1" />

        {/* Orbit distance input */}
        <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1">
          <span className="text-slate-400 text-xs whitespace-nowrap">Distância órbitas</span>
          <Input
            type="number"
            min={100}
            max={2000}
            value={orbitInputValue}
            onChange={e => setOrbitInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                const v = Math.min(2000, Math.max(100, Number(orbitInputValue)));
                setOrbitDistance(v);
                setOrbitInputValue(String(v));
              }
            }}
            className="w-16 h-6 text-xs bg-slate-700 border-slate-600 text-slate-200 px-1.5 text-center"
          />
          <button
            onClick={() => {
              const v = Math.min(2000, Math.max(100, Number(orbitInputValue)));
              setOrbitDistance(v);
              setOrbitInputValue(String(v));
            }}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded px-1.5 py-0.5"
          >OK</button>
        </div>

        {/* Layout models */}
        <LayoutModelToggle value={layoutModel} onChange={setLayoutModel} />

        {/* Filters */}
        <GraphFilters filters={filters} onChange={setFilters} contacts={contacts} />

        {/* Actions */}
        {canEdit && (
          <>

            <Button
              size="sm"
              onClick={() => { setEditingContact(null); setShowContactForm(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              <Plus className="w-4 h-4" /> Contato
            </Button>
          </>
        )}
      </div>



      {/* Graph area */}
      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-400 text-sm">Carregando rede...</p>
            </div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                <Users className="w-10 h-10 text-slate-600" />
              </div>
              <div>
                <p className="text-slate-300 font-semibold text-lg">Nenhum contato ainda</p>
                <p className="text-slate-500 text-sm mt-1">Adicione seu primeiro contato para começar a rede</p>
              </div>
              {canEdit && (
                <Button onClick={() => { setEditingContact(null); setShowContactForm(true); }} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Contato
                </Button>
              )}
            </div>
          </div>
        ) : (
          <NetworkGraph
            contacts={contacts}
            highlightedIds={highlightedIds}
            ancestorIds={ancestorIds}
            filterMode={filters.filterMode || "completo"}
            layoutModel={layoutModel}
            orbitDistance={orbitDistance}
            onNodeClick={setSelectedContact}
            onNodeDoubleClick={(c) => { setEditingContact(c); setShowContactForm(true); }}
            centralContactId={centralContactId}
          />
        )}

        <GraphLegend />

        {/* Zoom hint */}
        <div className="absolute top-4 right-4 text-slate-600 text-xs hidden md:block">
          Scroll para zoom · Arrastar para mover · Duplo clique para editar
        </div>

        {/* Reload */}
        <button
          onClick={loadAll}
          className="absolute top-4 left-4 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg p-2 text-slate-400 hover:text-white transition-colors"
          title="Recarregar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

      </div>

      {/* Sidebar */}
      {selectedContact && (
        <ContactSidebar
          contact={selectedContact}
          logs={contactLogs}
          documents={contactDocs}
          onClose={() => setSelectedContact(null)}
          onEdit={(c) => { setEditingContact(c); setShowContactForm(true); setSelectedContact(null); }}
          onAddLog={() => setShowLogForm(true)}
        />
      )}

      {/* Log form trigger from sidebar */}
      {selectedContact && showLogForm && (
        <MeetingLogForm
          contactId={selectedContact.id}
          contactName={selectedContact.name}
          onSave={handleSaveLog}
          onClose={() => setShowLogForm(false)}
        />
      )}

      {showContactForm && (
        <ContactForm
          contact={editingContact}
          contacts={contacts}
          onSave={handleSaveContact}
          onClose={() => { setShowContactForm(false); setEditingContact(null); }}
        />
      )}


    </div>
  );
}

function StatPill({ label, value, color, dot }) {
  return (
    <div className={`flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-full px-2.5 py-1 text-xs ${color}`}>
      {dot && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />}
      <span className="font-bold">{value}</span>
      <span className="text-slate-500">{label}</span>
    </div>
  );
}
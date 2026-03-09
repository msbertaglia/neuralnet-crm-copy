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
import ConnectionForm from "@/components/contact/ConnectionForm";
import MeetingLogForm from "@/components/contact/MeetingLogForm";

export default function Network() {
  const [contacts, setContacts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [selectedContact, setSelectedContact] = useState(null);
  const [centralContactId] = useState(() => localStorage.getItem("netmap_central_contact_id") || null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ statuses: [], nextSteps: [], projectIds: [] });

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
    if (filters.statuses?.length) list = list.filter(c => filters.statuses.includes(c.status));
    if (filters.nextSteps?.length) list = list.filter(c => filters.nextSteps.includes(c.next_step_status));
    if (filters.projectIds?.length) {
      const projectContacts = new Set();
      projects.filter(p => filters.projectIds.includes(p.id)).forEach(p => {
        p.contact_ids?.forEach(id => projectContacts.add(id));
      });
      list = list.filter(c => projectContacts.has(c.id));
    }
    return list;
  }, [contacts, search, filters, projects]);

  const filteredConnections = useMemo(() => {
    const ids = new Set(filteredContacts.map(c => c.id));
    return connections.filter(conn => ids.has(conn.contact_a_id) && ids.has(conn.contact_b_id));
  }, [connections, filteredContacts]);

  const handleSaveContact = async (data) => {
    if (editingContact) {
      await base44.entities.Contact.update(editingContact.id, data);
    } else {
      await base44.entities.Contact.create(data);
    }
    setShowContactForm(false);
    setEditingContact(null);
    await loadAll();
  };

  const handleSaveConnection = async (data) => {
    await base44.entities.Connection.create(data);
    setShowConnectionForm(false);
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
    <div className="h-screen w-full bg-slate-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex-shrink-0">
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

        {/* Filters */}
        <GraphFilters filters={filters} onChange={setFilters} projects={projects} />

        {/* Actions */}
        {canEdit && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowConnectionForm(true)}
              className="bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700 gap-1.5 hidden sm:flex"
            >
              <Link2 className="w-3.5 h-3.5" /> Conexão
            </Button>
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
            contacts={filteredContacts}
            connections={filteredConnections}
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

      {showConnectionForm && (
        <ConnectionForm
          contacts={contacts}
          existingConnections={connections}
          onSave={handleSaveConnection}
          onClose={() => setShowConnectionForm(false)}
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
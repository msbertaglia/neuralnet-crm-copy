import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Building2, Clock, AlertCircle, Timer, CheckCircle2, Users, Pencil, Trash2, LayoutList, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ContactForm from "@/components/contact/ContactForm";
import ContactSidebar from "@/components/contact/ContactSidebar";
import MeetingLogForm from "@/components/contact/MeetingLogForm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS = {
  ativo: "bg-green-500/20 text-green-400 border-green-500/30",
  inativo: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  prospect: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  parceiro: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  cliente: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  investidor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

const NEXT_STEP_ICONS = {
  pendente: <Timer className="w-3.5 h-3.5 text-amber-400" />,
  aguardando: <Clock className="w-3.5 h-3.5 text-blue-400" />,
  atrasado: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
  concluido: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
  sem_proximo_passo: null,
};

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedContact, setSelectedContact] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showLogForm, setShowLogForm] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "list" | "grid"
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [c, l, d, u] = await Promise.all([
      base44.entities.Contact.list("-created_date", 500),
      base44.entities.MeetingLog.list("-date", 500),
      base44.entities.Document.list(),
      base44.auth.me().catch(() => null),
    ]);
    setContacts(c);
    setLogs(l);
    setDocuments(d);
    setUser(u);
    setLoading(false);
  };

  const canEdit = user?.role === "admin" || user?.role === "editor";

  const filtered = useMemo(() => {
    let list = contacts;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(s) ||
        c.company?.toLowerCase().includes(s) ||
        c.position?.toLowerCase().includes(s)
      );
    }
    if (statusFilter !== "todos") list = list.filter(c => c.status === statusFilter);
    return list;
  }, [contacts, search, statusFilter]);

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

  const handleDelete = async (id) => {
    await base44.entities.Contact.delete(id);
    setDeleteConfirm(null);
    await loadAll();
  };

  const handleSaveLog = async (data) => {
    await base44.entities.MeetingLog.create(data);
    if (data.contact_id) await base44.entities.Contact.update(data.contact_id, { last_contact_date: data.date });
    setShowLogForm(false);
    await loadAll();
  };

  const contactLogs = selectedContact ? logs.filter(l => l.contact_id === selectedContact.id) : [];
  const contactDocs = selectedContact ? documents.filter(d => d.contact_id === selectedContact.id) : [];

  const fmtDate = (d) => {
    if (!d) return null;
    try { return format(new Date(d), "dd MMM", { locale: ptBR }); } catch { return d; }
  };

  const statusCounts = useMemo(() => {
    const counts = {};
    contacts.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [contacts]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" /> Contatos
            </h1>
            <p className="text-slate-400 text-sm">{contacts.length} pessoas na sua rede</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-9 h-9 bg-slate-800 border-slate-700 text-slate-200 text-sm w-48"
              />
            </div>
            {/* View toggle */}
            <div className="flex bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${viewMode === "list" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                title="Visão lista"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${viewMode === "grid" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                title="Visão cards"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => { setEditingContact(null); setShowContactForm(true); }}
                className="bg-blue-600 hover:bg-blue-700 gap-1.5"
              >
                <Plus className="w-4 h-4" /> Novo
              </Button>
            )}
          </div>
        </div>

        {/* Status filters */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <FilterChip label="Todos" count={contacts.length} active={statusFilter === "todos"} onClick={() => setStatusFilter("todos")} />
          {Object.entries(statusCounts).map(([s, count]) => (
            <FilterChip key={s} label={s} count={count} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum contato encontrado</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <span>Nome</span>
              <span>Empresa / Cargo</span>
              <span>Conhecemos em</span>
              <span>Último contato</span>
              <span>Próximo passo</span>
              {canEdit && <span className="w-16 text-center">Ações</span>}
            </div>
            {filtered.map((contact, i) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                fmtDate={fmtDate}
                canEdit={canEdit}
                onView={() => setSelectedContact(contact)}
                onEdit={() => { setEditingContact(contact); setShowContactForm(true); }}
                onDelete={() => setDeleteConfirm(contact)}
                isLast={i === filtered.length - 1}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(contact => (
              <ContactCard
                key={contact.id}
                contact={contact}
                canEdit={canEdit}
                onClick={() => setSelectedContact(contact)}
                onEdit={() => { setEditingContact(contact); setShowContactForm(true); }}
                onDelete={() => setDeleteConfirm(contact)}
                fmtDate={fmtDate}
              />
            ))}
          </div>
        )}
      </div>

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

      {showLogForm && selectedContact && (
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

function ContactCard({ contact, onClick, fmtDate }) {
  const nextIcon = NEXT_STEP_ICONS[contact.next_step_status];
  return (
    <button
      onClick={onClick}
      className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl p-4 text-left transition-all hover:bg-slate-800/50 group"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          {contact.photo_url ? (
            <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-slate-300">
              {contact.name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate group-hover:text-blue-300 transition-colors">{contact.name}</p>
          {contact.position && <p className="text-slate-400 text-xs truncate">{contact.position}</p>}
          {contact.company && (
            <div className="flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
              <p className="text-slate-500 text-xs truncate">{contact.company}</p>
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
      </div>

      <div className="flex items-center justify-between mt-3">
        <Badge className={`text-xs border ${STATUS_COLORS[contact.status] || STATUS_COLORS.prospect}`}>
          {contact.status}
        </Badge>
        {nextIcon && (
          <div className="flex items-center gap-1">
            {nextIcon}
            {contact.next_step_date && (
              <span className="text-xs text-slate-500">{fmtDate(contact.next_step_date)}</span>
            )}
          </div>
        )}
      </div>

      {contact.last_contact_date && (
        <p className="text-slate-600 text-xs mt-2 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {fmtDate(contact.last_contact_date)}
        </p>
      )}
    </button>
  );
}

function FilterChip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
        active
          ? "bg-blue-600 border-blue-500 text-white"
          : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
      }`}
    >
      {label} <span className={active ? "text-blue-200" : "text-slate-500"}>{count}</span>
    </button>
  );
}
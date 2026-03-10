import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Plus, Search, Building2, Clock, AlertCircle, Timer, CheckCircle2, Users, Pencil, Trash2, LayoutList, LayoutGrid, Tags, Link2, Info } from "lucide-react";
import StatusManagerModal from "@/components/contact/StatusManagerModal";
import BulkStatusModal from "@/components/contact/BulkStatusModal";
import TagManagerModal from "@/components/contact/TagManagerModal";
import BulkTagsModal from "@/components/contact/BulkTagsModal";
import BulkIndicadorModal from "@/components/contact/BulkIndicadorModal";
import ContactTable from "@/components/contact/ContactTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ContactForm from "@/components/contact/ContactForm";
import ContactSidebar from "@/components/contact/ContactSidebar";
import MeetingLogForm from "@/components/contact/MeetingLogForm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS = {
  prospect:      "bg-amber-500/20 text-amber-400 border-amber-500/30",
  desconhecidos: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  empresas:      "bg-blue-500/20 text-blue-400 border-blue-500/30",
  familia:       "bg-pink-500/20 text-pink-400 border-pink-500/30",
  profissional:  "bg-green-500/20 text-green-400 border-green-500/30",
  outros:        "bg-purple-500/20 text-purple-400 border-purple-500/30",
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
  const [tagFilter, setTagFilter] = useState("todas");
  const [selectedContact, setSelectedContact] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showLogForm, setShowLogForm] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "list" | "grid"
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [connections, setConnections] = useState([]);
  const [showStatusManager, setShowStatusManager] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showBulkTags, setShowBulkTags] = useState(false);
  const [showBulkIndicador, setShowBulkIndicador] = useState(false);
  const [showConnectionHelp, setShowConnectionHelp] = useState(false);


  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [c, l, d, u, conn] = await Promise.all([
      base44.entities.Contact.list("-created_date", 500),
      base44.entities.MeetingLog.list("-date", 500),
      base44.entities.Document.list(),
      base44.auth.me().catch(() => null),
      base44.entities.Connection.list("-created_date", 500),
    ]);
    setContacts(c);
    setLogs(l);
    setDocuments(d);
    setUser(u);
    setConnections(conn);
    setLoading(false);
  };


  const canEdit = user?.role === "admin" || user?.role === "editor";

  // All tags from contacts filtered by current status
  const availableTags = useMemo(() => {
    let list = statusFilter === "todos" ? contacts : contacts.filter(c => c.status === statusFilter);
    const tagSet = new Set();
    list.forEach(c => (c.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [contacts, statusFilter]);

  // Find Mauro Bertaglia as the central contact (user profile card)
  const userContact = contacts.find(c => c.name === "Mauro Bertaglia") || (user?.email ? contacts.find(c => c.created_by === user.email) : null);

  const filtered = useMemo(() => {
    let list = contacts;
    // Exclude user's own contact from the main list (will show in card above)
    if (userContact) {
      list = list.filter(c => c.id !== userContact.id);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(s) ||
        c.company?.toLowerCase().includes(s) ||
        c.position?.toLowerCase().includes(s)
      );
    }
    if (statusFilter !== "todos") list = list.filter(c => c.status === statusFilter);
    if (tagFilter !== "todas") list = list.filter(c => (c.tags || []).includes(tagFilter));
    return list;
  }, [contacts, search, statusFilter, tagFilter, user?.email]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = (contacts) => {
    const allSelected = contacts.every(c => selectedIds.has(c.id));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        contacts.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        contacts.forEach(c => next.add(c.id));
        return next;
      });
    }
  };

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

  // Counts based on search (but not status/tag filter) so tabs show accurate numbers
  const searchFiltered = useMemo(() => {
    let list = contacts;
    if (userContact) list = list.filter(c => c.id !== userContact.id);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(s) ||
        c.company?.toLowerCase().includes(s) ||
        c.position?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [contacts, search, userContact]);

  const statusCounts = useMemo(() => {
    const counts = {};
    searchFiltered.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [searchFiltered]);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" /> Contatos
            </h1>
            <p className="text-slate-400 text-sm">{filtered.length} pessoas na sua rede</p>
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
            <button
              onClick={() => selectedIds.size > 0 ? setShowBulkStatus(true) : setShowStatusManager(true)}
              className={`px-3 h-9 flex items-center gap-2 rounded-lg transition-colors text-sm font-medium ${
                selectedIds.size > 0
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
              }`}
            >
              <Tags className="w-4 h-4" /> Status {selectedIds.size > 0 && `(${selectedIds.size})`}
            </button>
            <button
              onClick={() => selectedIds.size > 0 ? setShowBulkTags(true) : setShowTagManager(true)}
              className={`px-3 h-9 flex items-center gap-2 rounded-lg transition-colors text-sm font-medium ${
                selectedIds.size > 0
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
              }`}
            >
              <Tags className="w-4 h-4" /> Tags {selectedIds.size > 0 && `(${selectedIds.size})`}
            </button>
            <button
              onClick={() => setShowBulkIndicador(true)}
              disabled={selectedIds.size === 0}
              className={`px-3 h-9 flex items-center gap-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedIds.size > 0
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
              }`}
            >
              <Link2 className="w-4 h-4" /> Indicador {selectedIds.size > 0 && `(${selectedIds.size})`}
            </button>
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

        {/* Status tabs (row 1) */}
        <div className="flex gap-1 mt-3 flex-wrap border-b border-slate-800 pb-0">
          <StatusTab label="Todos" count={searchFiltered.length} active={statusFilter === "todos"} onClick={() => { setStatusFilter("todos"); setTagFilter("todas"); }} />
          {Object.entries(statusCounts).map(([s, count]) => (
            <StatusTab key={s} label={s} count={count} active={statusFilter === s} onClick={() => { setStatusFilter(s); setTagFilter("todas"); }} status={s} />
          ))}
        </div>

        {/* Tag sub-tabs (row 2) */}
        {availableTags.length > 0 && (
          <div className="flex gap-1 mt-0 pt-1.5 flex-wrap border-b border-slate-800 pb-1.5">
            <TagTab label="Todas" active={tagFilter === "todas"} onClick={() => setTagFilter("todas")} />
            {availableTags.map(tag => {
              const count = contacts.filter(c =>
                (statusFilter === "todos" || c.status === statusFilter) && (c.tags || []).includes(tag)
              ).length;
              return <TagTab key={tag} label={tag} count={count} active={tagFilter === tag} onClick={() => setTagFilter(tag)} />;
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
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
          <ContactTable
            contacts={filtered}
            canEdit={canEdit}
            onView={setSelectedContact}
            onEdit={(c) => { setEditingContact(c); setShowContactForm(true); }}
            onDelete={setDeleteConfirm}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
          />
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


      {showBulkStatus && (
        <BulkStatusModal
          selectedContacts={contacts.filter(c => selectedIds.has(c.id))}
          onClose={() => setShowBulkStatus(false)}
          onDone={() => { setShowBulkStatus(false); setSelectedIds(new Set()); loadAll(); }}
        />
      )}

      {showStatusManager && (
        <StatusManagerModal
          contacts={contacts}
          onClose={() => setShowStatusManager(false)}
          onStatusesChanged={loadAll}
        />
      )}

      {showTagManager && (
        <TagManagerModal
          contacts={contacts}
          onClose={() => setShowTagManager(false)}
          onTagsChanged={loadAll}
        />
      )}

      {showBulkTags && (
        <BulkTagsModal
          selectedContacts={contacts.filter(c => selectedIds.has(c.id))}
          allContacts={contacts}
          onClose={() => setShowBulkTags(false)}
          onDone={() => { setShowBulkTags(false); setSelectedIds(new Set()); loadAll(); }}
        />
      )}

      {showBulkIndicador && (
        <BulkIndicadorModal
          selectedContacts={contacts.filter(c => selectedIds.has(c.id))}
          allContacts={contacts}
          onClose={() => setShowBulkIndicador(false)}
          onDone={() => { setShowBulkIndicador(false); setSelectedIds(new Set()); loadAll(); }}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-white font-bold text-lg mb-2">Confirmar exclusão</h3>
            <p className="text-slate-400 text-sm mb-6">Tem certeza que deseja excluir <span className="text-white font-semibold">{deleteConfirm.name}</span>? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactRow({ contact, fmtDate, canEdit, onView, onEdit, onDelete, isLast }) {
  const nextIcon = NEXT_STEP_ICONS[contact.next_step_status];
  const NEXT_STEP_COLORS = { pendente: "text-amber-400", aguardando: "text-blue-400", atrasado: "text-red-400", concluido: "text-green-400" };

  return (
    <div
      className={`grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 items-center hover:bg-slate-800/50 transition-colors cursor-pointer ${!isLast ? "border-b border-slate-800" : ""}`}
      onClick={onView}
    >
      {/* Nome */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 text-xs font-bold text-slate-300">
          {contact.photo_url ? <img src={contact.photo_url} alt="" className="w-full h-full object-cover" /> : contact.name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold truncate">{contact.name}</p>
          <Badge className={`text-xs border mt-0.5 ${STATUS_COLORS[contact.status] || STATUS_COLORS.prospect}`}>{contact.status}</Badge>
        </div>
      </div>

      {/* Empresa */}
      <div className="min-w-0">
        {contact.company && <p className="text-slate-300 text-sm truncate flex items-center gap-1"><Building2 className="w-3 h-3 text-slate-500 flex-shrink-0" />{contact.company}</p>}
        {contact.position && <p className="text-slate-500 text-xs truncate mt-0.5">{contact.position}</p>}
      </div>

      {/* Conhecemos em */}
      <div>
        {contact.met_date ? (
          <p className="text-slate-400 text-sm">{fmtDate(contact.met_date)}</p>
        ) : <p className="text-slate-600 text-sm">—</p>}
      </div>

      {/* Último contato */}
      <div>
        {contact.last_contact_date ? (
          <p className="text-slate-400 text-sm flex items-center gap-1"><Clock className="w-3 h-3 text-slate-500" />{fmtDate(contact.last_contact_date)}</p>
        ) : <p className="text-slate-600 text-sm">—</p>}
      </div>

      {/* Próximo passo */}
      <div>
        {nextIcon ? (
          <div className="flex items-center gap-1.5">
            {nextIcon}
            <span className={`text-xs ${NEXT_STEP_COLORS[contact.next_step_status] || ""}`}>
              {contact.next_step_date ? fmtDate(contact.next_step_date) : contact.next_step_status?.replace("_", " ")}
            </span>
          </div>
        ) : <p className="text-slate-600 text-sm">—</p>}
      </div>

      {/* Ações */}
      {canEdit && (
        <div className="flex items-center gap-1 w-16 justify-center" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors" title="Editar">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors" title="Excluir">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function ContactCard({ contact, onClick, onEdit, onDelete, canEdit, fmtDate }) {
  const nextIcon = NEXT_STEP_ICONS[contact.next_step_status];
  return (
    <div
      onClick={onClick}
      className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl p-4 text-left transition-all hover:bg-slate-800/50 group cursor-pointer relative"
    >
      {canEdit && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
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
        <div className="flex-1 min-w-0 pr-12">
          <p className="text-white font-semibold text-sm truncate group-hover:text-blue-300 transition-colors">{contact.name}</p>
          {contact.position && <p className="text-slate-400 text-xs truncate">{contact.position}</p>}
          {contact.company && (
            <div className="flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
              <p className="text-slate-500 text-xs truncate">{contact.company}</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <Badge className={`text-xs border ${STATUS_COLORS[contact.status] || STATUS_COLORS.prospect}`}>{contact.status}</Badge>
        {nextIcon && (
          <div className="flex items-center gap-1">
            {nextIcon}
            {contact.next_step_date && <span className="text-xs text-slate-500">{fmtDate(contact.next_step_date)}</span>}
          </div>
        )}
      </div>
      {contact.last_contact_date && (
        <p className="text-slate-600 text-xs mt-2 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {fmtDate(contact.last_contact_date)}
        </p>
      )}
    </div>
  );
}

const STATUS_TAB_COLORS = {
  prospect:      { active: "border-b-2 border-amber-400 text-amber-300",   count: "text-amber-500" },
  desconhecidos: { active: "border-b-2 border-slate-400 text-slate-300",   count: "text-slate-500" },
  empresas:      { active: "border-b-2 border-blue-400 text-blue-300",     count: "text-blue-500" },
  familia:       { active: "border-b-2 border-pink-400 text-pink-300",     count: "text-pink-500" },
  profissional:  { active: "border-b-2 border-green-400 text-green-300",   count: "text-green-500" },
  outros:        { active: "border-b-2 border-purple-400 text-purple-300", count: "text-purple-500" },
};

function StatusTab({ label, count, active, onClick, status }) {
  const colors = status ? STATUS_TAB_COLORS[status] : null;
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all rounded-t-md -mb-px ${
        active
          ? colors
            ? `bg-slate-800/60 ${colors.active} text-white`
            : "bg-slate-800/60 border-b-2 border-blue-400 text-white"
          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1.5 text-[10px] font-normal ${active && colors ? colors.count : "text-slate-600"}`}>
          ({count})
        </span>
      )}
    </button>
  );
}

function TagTab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all border ${
        active
          ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
          : "border-slate-700/60 text-slate-500 hover:text-slate-300 hover:border-slate-600"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1 ${active ? "text-amber-500" : "text-slate-600"}`}>({count})</span>
      )}
    </button>
  );
}
import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Plus, Search, Building2, Clock, AlertCircle, Timer, CheckCircle2, Users, Pencil, Trash2, LayoutList, LayoutGrid, Share2 } from "lucide-react";
import ContactTable from "@/components/contact/ContactTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ContactForm from "@/components/contact/ContactForm";
import ContactSidebar from "@/components/contact/ContactSidebar";
import MeetingLogForm from "@/components/contact/MeetingLogForm";
import ImpliedConnectionsModal from "@/components/contact/ImpliedConnectionsModal";
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
  const [tagFilter, setTagFilter] = useState("todas");
  const [selectedContact, setSelectedContact] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showLogForm, setShowLogForm] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "list" | "grid"
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [connections, setConnections] = useState([]);
  const [pendingSave, setPendingSave] = useState(null); // { contactData, editingId, newImplied, saving }
  const [showImpliedModal, setShowImpliedModal] = useState(false);

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

  // Detect new implied connections that would be created for a contact
  const detectImpliedConnections = (contactData, editingId, currentConnections, currentContacts) => {
    // Find all connections where this contact is an introducer
    const asIntroducer = currentConnections.filter(c => c.introduced_by_id === editingId);
    // Find all connections where this contact is involved and has an introducer
    const asParty = currentConnections.filter(c =>
      (c.contact_a_id === editingId || c.contact_b_id === editingId) && c.introduced_by_id
    );
    // Also check if contact has introduced_by_id set (new or changed)
    const newImplied = [];
    const usedPairs = new Set();

    // For connections involving this contact with an introducer, check introducer↔otherParty
    [...asIntroducer, ...asParty].forEach(conn => {
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
        const alreadyExists = currentConnections.find(c =>
          (c.contact_a_id === intId && c.contact_b_id === otherId) ||
          (c.contact_b_id === intId && c.contact_a_id === otherId)
        );
        if (!alreadyExists) {
          usedPairs.add(pairKey);
          newImplied.push({ contact_a_id: intId, contact_a_name: intName, contact_b_id: otherId, contact_b_name: otherName });
        }
      });
    });

    // If this contact has an introduced_by set (new contact or changed introducer)
    if (contactData.introduced_by_id) {
      const intId = contactData.introduced_by_id;
      const intName = contactData.introduced_by_name;
      const contactId = editingId || "__new__";
      const contactName = contactData.name;
      const pairKey = [intId, contactId].sort().join("|");
      if (!usedPairs.has(pairKey)) {
        const alreadyExists = currentConnections.find(c =>
          (c.contact_a_id === intId && c.contact_b_id === editingId) ||
          (c.contact_b_id === intId && c.contact_a_id === editingId)
        );
        if (!alreadyExists && editingId) {
          usedPairs.add(pairKey);
          newImplied.push({ contact_a_id: intId, contact_a_name: intName, contact_b_id: editingId, contact_b_name: contactName });
        }
      }
    }

    return newImplied;
  };

  const canEdit = user?.role === "admin" || user?.role === "editor";

  // All tags from contacts filtered by current status
  const availableTags = useMemo(() => {
    let list = statusFilter === "todos" ? contacts : contacts.filter(c => c.status === statusFilter);
    const tagSet = new Set();
    list.forEach(c => (c.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [contacts, statusFilter]);

  const userContact = user?.email ? contacts.find(c => c.created_by === user.email) : null;

  const filtered = useMemo(() => {
    let list = contacts.filter(c => c.created_by !== user?.email); // Exclude user's own contact
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

  const handleSaveContact = async (data) => {
    const newImplied = detectImpliedConnections(data, editingContact?.id, connections, contacts);
    if (newImplied.length > 0) {
      setPendingSave({ contactData: data, editingId: editingContact?.id, newImplied });
      setShowImpliedModal(true);
      return;
    }
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

  const handleConfirmImplied = async () => {
    if (!pendingSave) return;
    setPendingSave(prev => ({ ...prev, saving: true }));
    await doSaveContact(pendingSave.contactData, pendingSave.editingId);
    setShowImpliedModal(false);
    setPendingSave(null);
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
            <a
              href={createPageUrl(`Network?status=${statusFilter}&tag=${tagFilter}`)}
              className="px-3 h-9 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Share2 className="w-4 h-4" /> Rede Visual
            </a>
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
          <StatusTab label="Todos" count={contacts.length} active={statusFilter === "todos"} onClick={() => { setStatusFilter("todos"); setTagFilter("todas"); }} />
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
          <ContactTable
            contacts={filtered}
            canEdit={canEdit}
            onView={setSelectedContact}
            onEdit={(c) => { setEditingContact(c); setShowContactForm(true); }}
            onDelete={setDeleteConfirm}
            centralContactId={centralContactId}
            onSetCentral={handleSetCentral}
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

      {showImpliedModal && pendingSave && (
        <ImpliedConnectionsModal
          newImplied={pendingSave.newImplied}
          updatedConnections={[]}
          onConfirm={handleConfirmImplied}
          onCancel={() => { setShowImpliedModal(false); setPendingSave(null); }}
          saving={pendingSave.saving}
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
  ativo:     { active: "border-b-2 border-green-400 text-green-300",  count: "text-green-500" },
  inativo:   { active: "border-b-2 border-slate-400 text-slate-300",  count: "text-slate-500" },
  prospect:  { active: "border-b-2 border-amber-400 text-amber-300",  count: "text-amber-500" },
  parceiro:  { active: "border-b-2 border-blue-400 text-blue-300",    count: "text-blue-500" },
  cliente:   { active: "border-b-2 border-purple-400 text-purple-300",count: "text-purple-500" },
  investidor:{ active: "border-b-2 border-pink-400 text-pink-300",    count: "text-pink-500" },
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
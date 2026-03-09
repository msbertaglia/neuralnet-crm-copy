import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Clock, Timer, AlertCircle, CheckCircle2, Circle } from "lucide-react";
import SmartDate from "@/components/ui/SmartDate";

const STATUS_COLORS = {
  ativo: "bg-green-500/20 text-green-400 border-green-500/30",
  inativo: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  prospect: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  parceiro: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  cliente: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  investidor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

const NEXT_STEP_STATUS_CONFIG = {
  pendente: { icon: Timer, color: "text-amber-400", label: "Pendente" },
  aguardando: { icon: Clock, color: "text-blue-400", label: "Aguardando" },
  atrasado: { icon: AlertCircle, color: "text-red-400", label: "Atrasado" },
  concluido: { icon: CheckCircle2, color: "text-green-400", label: "Concluído" },
  sem_proximo_passo: { icon: null, color: "text-slate-600", label: "—" },
};

const NEXT_STEP_TYPE_LABELS = {
  eu_contato: "Eu contato",
  aguardando_deles: "Aguardando deles",
};

// Brand icons as inline SVG
function LinkedInIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill={active ? "#0A66C2" : "#475569"}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

function InstagramIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill={active ? "#E1306C" : "#475569"}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  );
}

function TwitterIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill={active ? "#1DA1F2" : "#475569"}>
      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
    </svg>
  );
}

const RADIO_WIDTH = 40;
const CONNECTION_INDICATOR_WIDTH = 50;

const COLUMNS = [
  { key: "name", label: "Nome", width: 280, type: "alpha" },
  { key: "status", label: "Status", width: 120, type: "alpha" },
  { key: "nickname", label: "Apelido", width: 160, type: "alpha" },
  { key: "tags", label: "Tags", width: 220, type: "alpha" },
  { key: "company", label: "Empresa", width: 200, type: "alpha" },
  { key: "social", label: "Redes Sociais", width: 120, sortable: false },
  { key: "met_date", label: "Relacionamento", width: 200, type: "date" },
  { key: "last_contact_date", label: "Último Contato", width: 200, type: "date" },
  { key: "next_step_type", label: "Tipo Próx. Passo", width: 160, type: "alpha" },
  { key: "next_step_date", label: "Data Limite", width: 200, type: "date" },
  { key: "next_step_status", label: "Status Próx. Passo", width: 160, type: "alpha" },
];

function SortIcon({ col, sortKey, sortDir }) {
  if (col.sortable === false) return null;
  if (sortKey !== col.key) return <ChevronsUpDown className="w-3 h-3 text-slate-600 ml-1 inline flex-shrink-0" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 text-blue-400 ml-1 inline flex-shrink-0" />
    : <ChevronDown className="w-3 h-3 text-blue-400 ml-1 inline flex-shrink-0" />;
}

export default function ContactTable({ contacts, canEdit, onView, onEdit, onDelete }) {
  const [sortKey, setSortKey] = useState("met_date");
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = (col) => {
    if (col.sortable === false) return;
    if (sortKey === col.key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const list = [...contacts];
    list.sort((a, b) => {
      // Default: met_date asc, then alpha
      if (sortKey === "met_date" && !a.met_date && !b.met_date) {
        return (a.name || "").localeCompare(b.name || "", "pt-BR");
      }

      let valA, valB;

      const col = COLUMNS.find(c => c.key === sortKey);
      if (!col) return 0;

      if (col.type === "date") {
        valA = a[sortKey] ? new Date(a[sortKey]).getTime() : (sortDir === "asc" ? Infinity : -Infinity);
        valB = b[sortKey] ? new Date(b[sortKey]).getTime() : (sortDir === "asc" ? Infinity : -Infinity);
        return sortDir === "asc" ? valA - valB : valB - valA;
      }

      if (col.type === "alpha") {
        if (sortKey === "tags") {
          valA = (a.tags || []).join(",");
          valB = (b.tags || []).join(",");
        } else {
          valA = a[sortKey] || "";
          valB = b[sortKey] || "";
        }
        const cmp = valA.localeCompare(valB, "pt-BR");
        return sortDir === "asc" ? cmp : -cmp;
      }

      return 0;
    });
    return list;
  }, [contacts, sortKey, sortDir]);

  const actionsWidth = canEdit ? 72 : 0;
  const totalWidth = COLUMNS.reduce((acc, c) => acc + c.width, 0) + actionsWidth + CONNECTION_INDICATOR_WIDTH;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          {/* Header */}
          <div className="flex items-center border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10">
             {/* Connection indicator header */}
             <div style={{ width: CONNECTION_INDICATOR_WIDTH, minWidth: CONNECTION_INDICATOR_WIDTH }} className="flex-shrink-0 px-3 py-2.5" title="Status da conexão">
               <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Conexão</span>
             </div>
             {COLUMNS.map(col => (
              <div
                key={col.key}
                style={{ width: col.width, minWidth: col.width }}
                className={`flex-shrink-0 px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide select-none ${col.sortable !== false ? "cursor-pointer hover:text-slate-300 transition-colors" : ""}`}
                onClick={() => handleSort(col)}
              >
                <span className="flex items-center whitespace-nowrap">
                  {col.label}
                  <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
                </span>
              </div>
            ))}
            {canEdit && (
              <div style={{ width: actionsWidth, minWidth: actionsWidth }} className="flex-shrink-0 px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">
                Ações
              </div>
            )}
          </div>

          {/* Rows */}
          {sorted.map((contact, i) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              columns={COLUMNS}
              canEdit={canEdit}
              actionsWidth={actionsWidth}
              isLast={i === sorted.length - 1}
              onView={() => onView(contact)}
              onEdit={() => onEdit(contact)}
              onDelete={() => onDelete(contact)}
            />
          ))}
          {sorted.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">Nenhum contato encontrado</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactRow({ contact, columns, canEdit, actionsWidth, isLast, isCentral, centralContactId, onSetCentral, onView, onEdit, onDelete }) {
  const ns = NEXT_STEP_STATUS_CONFIG[contact.next_step_status] || NEXT_STEP_STATUS_CONFIG.sem_proximo_passo;
  const NsIcon = ns.icon;

  // Determine connection indicator color
  // Green: há conexão direta (introduced_by_id = central contact's ID)
  // Yellow: indicação de conexão "Direto" (introduced_by_id === "direto")
  // Red: Sem informação (introduced_by_id === "sem_informacao" ou vazio)
  const getConnectionIndicator = () => {
    if (!centralContactId || centralContactId === contact.id) return null;
    
    const introducedBy = contact.introduced_by_id;
    
    if (!introducedBy || introducedBy === "sem_informacao") {
      return { color: "#ef4444", label: "Sem informação" }; // Red
    } else if (introducedBy === "direto") {
      return { color: "#eab308", label: "Direto" }; // Yellow
    } else if (introducedBy === centralContactId) {
      return { color: "#22c55e", label: "Conexão direta" }; // Green
    } else {
      return { color: "#94a3b8", label: "Outra conexão" }; // Gray (outro intermediário)
    }
  };

  const indicator = getConnectionIndicator();

  const renderCell = (col) => {
    switch (col.key) {
      case "name":
        return (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 text-xs font-bold text-slate-300">
              {contact.photo_url
                ? <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
                : contact.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
              }
            </div>
            <p className="text-white text-sm font-semibold whitespace-nowrap">{contact.name}</p>
          </div>
        );
      case "status":
        return (
          <Badge className={`text-xs border whitespace-nowrap ${STATUS_COLORS[contact.status] || STATUS_COLORS.prospect}`}>{contact.status}</Badge>
        );
      case "nickname":
        return <span className="text-slate-300 text-sm whitespace-nowrap">{contact.nickname || <span className="text-slate-700">—</span>}</span>;
      case "tags":
        return contact.tags?.length
          ? <div className="flex gap-1 flex-wrap">
              {contact.tags.map(t => (
                <span key={t} className="bg-slate-700 text-slate-300 text-xs px-1.5 py-0.5 rounded whitespace-nowrap">{t}</span>
              ))}
            </div>
          : <span className="text-slate-700">—</span>;
      case "company":
        return contact.company
          ? <span className="text-slate-300 text-sm whitespace-nowrap">{contact.company}</span>
          : <span className="text-slate-700">—</span>;
      case "social":
        return (
          <div className="flex items-center gap-2">
            <a
              href={contact.linkedin_url || undefined}
              target={contact.linkedin_url ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={e => { if (!contact.linkedin_url) e.preventDefault(); e.stopPropagation(); }}
              title="LinkedIn"
              className={contact.linkedin_url ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-40"}
            >
              <LinkedInIcon active={!!contact.linkedin_url} />
            </a>
            <a
              href={contact.instagram_url || undefined}
              target={contact.instagram_url ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={e => { if (!contact.instagram_url) e.preventDefault(); e.stopPropagation(); }}
              title="Instagram"
              className={contact.instagram_url ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-40"}
            >
              <InstagramIcon active={!!contact.instagram_url} />
            </a>
            <a
              href={contact.twitter_url || undefined}
              target={contact.twitter_url ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={e => { if (!contact.twitter_url) e.preventDefault(); e.stopPropagation(); }}
              title="Twitter / X"
              className={contact.twitter_url ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-40"}
            >
              <TwitterIcon active={!!contact.twitter_url} />
            </a>
          </div>
        );
      case "met_date":
        return <SmartDate date={contact.met_date} />;
      case "last_contact_date":
        return <SmartDate date={contact.last_contact_date} />;
      case "next_step_type":
        return contact.next_step_type
          ? <span className="text-slate-400 text-xs whitespace-nowrap">{NEXT_STEP_TYPE_LABELS[contact.next_step_type] || contact.next_step_type}</span>
          : <span className="text-slate-700">—</span>;
      case "next_step_date":
        return <SmartDate date={contact.next_step_date} />;
      case "next_step_status":
        return (
          <div className={`flex items-center gap-1.5 ${ns.color}`}>
            {NsIcon && <NsIcon className="w-3.5 h-3.5 flex-shrink-0" />}
            <span className="text-xs whitespace-nowrap">{ns.label}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`flex items-center hover:bg-slate-800/50 transition-colors cursor-pointer whitespace-nowrap ${!isLast ? "border-b border-slate-800" : ""}`}
      onClick={onView}
    >
      {/* Radio button */}
      <div
        style={{ width: RADIO_WIDTH, minWidth: RADIO_WIDTH }}
        className="flex-shrink-0 px-3 py-3 flex items-center justify-center"
        onClick={e => { e.stopPropagation(); onSetCentral(); }}
      >
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${isCentral ? "border-blue-400 bg-blue-400/20" : "border-slate-600 hover:border-slate-400"}`}>
          {isCentral && <div className="w-2 h-2 rounded-full bg-blue-400" />}
        </div>
      </div>
      {/* Connection indicator */}
      <div
        style={{ width: CONNECTION_INDICATOR_WIDTH, minWidth: CONNECTION_INDICATOR_WIDTH }}
        className="flex-shrink-0 px-3 py-3 flex items-center justify-center"
        title={indicator?.label || ""}
      >
        {indicator && (
          <Circle className="w-3 h-3 flex-shrink-0" style={{ color: indicator.color, fill: indicator.color }} />
        )}
      </div>
      {columns.map(col => (
        <div
          key={col.key}
          style={{ width: col.width, minWidth: col.width }}
          className="flex-shrink-0 px-3 py-3 overflow-hidden"
        >
          {renderCell(col)}
        </div>
      ))}
      {canEdit && (
        <div
          style={{ width: actionsWidth, minWidth: actionsWidth }}
          className="flex-shrink-0 px-3 py-3 flex items-center justify-center gap-1"
          onClick={e => e.stopPropagation()}
        >
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
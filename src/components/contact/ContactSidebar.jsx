import { useState } from "react";
import { X, Phone, Mail, Linkedin, Instagram, Twitter, Building2, MapPin, Calendar, User, ExternalLink, Clock, CheckCircle2, AlertCircle, Timer, MessageSquare, FileText, Link2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhoneNumber } from "@/components/lib/phoneFormatter";
import ApresentouModal from "@/components/contact/ApresentouModal";
import { base44 } from "@/api/base44Client";

const STATUS_COLORS = {
  ativo: "bg-green-500/20 text-green-400 border-green-500/30",
  inativo: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  prospect: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  parceiro: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  cliente: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  investidor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

const NEXT_STEP_ICONS = {
  pendente: <Timer className="w-4 h-4 text-amber-400" />,
  aguardando: <Clock className="w-4 h-4 text-blue-400" />,
  atrasado: <AlertCircle className="w-4 h-4 text-red-400" />,
  concluido: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  sem_proximo_passo: <MessageSquare className="w-4 h-4 text-slate-400" />,
};

const NEXT_STEP_COLORS = {
  pendente: "text-amber-400",
  aguardando: "text-blue-400",
  atrasado: "text-red-400",
  concluido: "text-green-400",
  sem_proximo_passo: "text-slate-400",
};

export default function ContactSidebar({ contact, onClose, onEdit, logs, documents, allContacts = [], onRefresh }) {
  const [tab, setTab] = useState("info");
  const [showApresentouModal, setShowApresentouModal] = useState(false);
  const [savingApresentou, setSavingApresentou] = useState(false);

  const handleApresentouConfirm = async (chosen) => {
    setSavingApresentou(true);
    await Promise.all(
      chosen.map(c =>
        base44.entities.Contact.update(c.id, {
          introduced_by_id: contact.id,
          introduced_by_name: contact.name,
        })
      )
    );
    setSavingApresentou(false);
    setShowApresentouModal(false);
    if (onRefresh) onRefresh();
  };
  if (!contact) return null;

  const fmtDate = (d) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd MMM yyyy", { locale: ptBR }); } catch { return d; }
  };

  const tabs = [
    { key: "info", label: "Perfil" },
    { key: "logs", label: `Logs (${logs?.length || 0})` },
    { key: "docs", label: `Docs (${documents?.length || 0})` },
  ];

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="relative p-6 border-b border-slate-700">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-600 flex items-center justify-center overflow-hidden flex-shrink-0">
            {contact.photo_url ? (
              <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-slate-300">
                {contact.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-lg leading-tight truncate">{contact.name}</h2>
            {contact.position && <p className="text-slate-400 text-sm truncate">{contact.position}</p>}
            {contact.company && (
              <div className="flex items-center gap-1 mt-1">
                {contact.company_logo_url ? (
                  <img src={contact.company_logo_url} className="w-4 h-4 rounded" alt="" />
                ) : (
                  <Building2 className="w-3 h-3 text-slate-500" />
                )}
                <span className="text-slate-400 text-xs truncate">{contact.company}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-3">
          <Badge className={`text-xs border w-fit ${STATUS_COLORS[contact.status] || STATUS_COLORS.prospect}`}>
            {contact.status}
          </Badge>
          <div className="flex flex-col gap-2">
            {contact.tags?.map(t => (
              <Badge key={t} variant="outline" className="text-xs border-slate-600 text-slate-400 w-fit whitespace-nowrap">{t}</Badge>
            ))}
          </div>
        </div>

        {/* Next step */}
        {contact.next_step_description && (
          <div className={`mt-3 p-2.5 rounded-lg bg-slate-800 border border-slate-700 flex items-start gap-2`}>
            {NEXT_STEP_ICONS[contact.next_step_status]}
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${NEXT_STEP_COLORS[contact.next_step_status]}`}>
                {contact.next_step_type === "eu_contato" ? "Eu devo contatar" : "Aguardando contato deles"}
                {contact.next_step_date && ` · até ${fmtDate(contact.next_step_date)}`}
              </p>
              <p className="text-slate-300 text-xs mt-0.5 truncate">{contact.next_step_description}</p>
            </div>
          </div>
        )}

        <Button size="sm" onClick={() => onEdit(contact)} className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white">
          Editar Contato
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              tab === t.key ? "text-blue-400 border-b-2 border-blue-500" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "info" && (
          <>
            <Section title="Contato">
               <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={contact.email} link={contact.email ? `mailto:${contact.email}` : null} />
               <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Telefone" value={contact.phone ? formatPhoneNumber(contact.phone) : null} link={contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, "")}` : null} />
               <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Cidade" value={[contact.city, contact.state, contact.country].filter(Boolean).join(", ")} />
             </Section>

            <Section title="Redes Sociais">
              <InfoRow icon={<Linkedin className="w-3.5 h-3.5" />} label="LinkedIn" value={contact.linkedin_url ? "Ver perfil" : null} link={contact.linkedin_url} />
              <InfoRow icon={<Instagram className="w-3.5 h-3.5" />} label="Instagram" value={contact.instagram_url ? `@${contact.instagram_url.replace(/^@/, "")}` : null} link={contact.instagram_url ? `https://www.instagram.com.br/${contact.instagram_url.replace(/^@/, "")}` : null} />
              <InfoRow icon={<Twitter className="w-3.5 h-3.5" />} label="Twitter" value={contact.twitter_url ? "Ver perfil" : null} link={contact.twitter_url} />
            </Section>

            <Section title="Relacionamento">
              <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Conhecemos em" value={fmtDate(contact.met_date)} />
              <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Apresentado por" value={contact.introduced_by_name} />
              <div className="flex items-center gap-2">
                <span className="text-slate-500 flex-shrink-0"><UserPlus className="w-3.5 h-3.5" /></span>
                <span className="text-slate-500 text-xs w-20 flex-shrink-0">Apresentou</span>
                <button
                  onClick={() => setShowApresentouModal(true)}
                  className="text-blue-400 text-xs hover:underline hover:text-blue-300 flex items-center gap-1"
                >
                  Selecionar contatos
                </button>
              </div>
              <InfoRow icon={<Clock className="w-3.5 h-3.5" />} label="Último contato" value={fmtDate(contact.last_contact_date)} />
            </Section>

            {contact.notes && (
              <Section title="Observações">
                <p className="text-slate-300 text-xs leading-relaxed">{contact.notes}</p>
              </Section>
            )}
          </>
        )}

        {tab === "logs" && (
          <div className="space-y-2">
            {logs?.length === 0 && <p className="text-slate-500 text-sm text-center py-8">Nenhum log registrado</p>}
            {logs?.map(log => (
              <div key={log.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">{log.type?.replace(/_/g, " ")}</Badge>
                  <span className="text-slate-500 text-xs">{fmtDate(log.date)}</span>
                </div>
                {log.summary && <p className="text-slate-300 text-xs">{log.summary}</p>}
                {log.outcome && <p className="text-emerald-400 text-xs mt-1">→ {log.outcome}</p>}
              </div>
            ))}
          </div>
        )}

        {tab === "docs" && (
          <div className="space-y-2">
            {documents?.length === 0 && <p className="text-slate-500 text-sm text-center py-8">Nenhum documento</p>}
            {documents?.map(doc => (
              <div key={doc.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center gap-3">
                <FileText className="w-8 h-8 text-slate-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-xs font-semibold truncate">{doc.name}</p>
                  <p className="text-slate-500 text-xs">{doc.document_type?.replace(/_/g, " ")} · {doc.visibility}</p>
                </div>
                {doc.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 text-blue-400" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {showApresentouModal && (
        <ApresentouModal
          contact={contact}
          allContacts={allContacts}
          onConfirm={handleApresentouConfirm}
          onClose={() => setShowApresentouModal(false)}
        />
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ icon, label, value, link }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 flex-shrink-0">{icon}</span>
      <span className="text-slate-500 text-xs w-20 flex-shrink-0">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline flex items-center gap-1 truncate">
          {value} <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      ) : (
        <span className="text-slate-300 text-xs truncate">{value}</span>
      )}
    </div>
  );
}
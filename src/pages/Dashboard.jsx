import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Link2, FolderOpen, AlertCircle, Timer, Clock, TrendingUp, CalendarDays } from "lucide-react";
import { createPageUrl } from "@/utils";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const [contacts, setContacts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [c, conn, p] = await Promise.all([
      base44.entities.Contact.list("-created_date", 500),
      base44.entities.Connection.list(),
      base44.entities.Project.list(),
    ]);
    setContacts(c);
    setConnections(conn);
    setProjects(p);
    setLoading(false);
  };

  const stats = {
    total: contacts.length,
    connections: connections.length,
    activeProjects: projects.filter(p => p.status === "ativo").length,
    atrasados: contacts.filter(c => c.next_step_status === "atrasado"),
    pendentes: contacts.filter(c => c.next_step_status === "pendente"),
    aguardando: contacts.filter(c => c.next_step_status === "aguardando"),
  };

  const urgentContacts = [...stats.atrasados, ...stats.pendentes].slice(0, 8);
  const recentContacts = [...contacts].slice(0, 6);

  const fmtDate = (d) => {
    if (!d) return "";
    try { return format(new Date(d), "dd MMM", { locale: ptBR }); } catch { return ""; }
  };

  const isOverdue = (d) => {
    if (!d) return false;
    return differenceInDays(new Date(), new Date(d)) > 0;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm">Visão geral da sua rede profissional</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users className="w-5 h-5 text-blue-400" />} value={stats.total} label="Contatos" color="border-blue-500/20" href={createPageUrl("Contacts")} />
          <StatCard icon={<Link2 className="w-5 h-5 text-purple-400" />} value={stats.connections} label="Conexões" color="border-purple-500/20" href={createPageUrl("Network")} />
          <StatCard icon={<FolderOpen className="w-5 h-5 text-green-400" />} value={stats.activeProjects} label="Projetos Ativos" color="border-green-500/20" href={createPageUrl("Projects")} />
          <StatCard icon={<AlertCircle className="w-5 h-5 text-red-400" />} value={stats.atrasados.length} label="Atrasados" color="border-red-500/20" href={createPageUrl("Contacts")} />
        </div>

        {/* Next Steps urgentes */}
        {urgentContacts.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Timer className="w-4 h-4 text-amber-400" />
              Próximos Passos Pendentes
            </h2>
            <div className="space-y-2">
              {urgentContacts.map(c => (
                <div key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border ${
                  c.next_step_status === "atrasado" ? "border-red-500/20 bg-red-500/5" : "border-slate-700 bg-slate-800/50"
                }`}>
                  <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-300">
                    {c.name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{c.name}</p>
                    <p className="text-slate-400 text-xs truncate">{c.next_step_description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.next_step_status === "atrasado" ? (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Timer className="w-4 h-4 text-amber-400" />
                    )}
                    {c.next_step_date && (
                      <span className={`text-xs ${isOverdue(c.next_step_date) ? "text-red-400" : "text-slate-400"}`}>
                        {fmtDate(c.next_step_date)}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.next_step_type === "eu_contato" ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300"
                    }`}>
                      {c.next_step_type === "eu_contato" ? "Eu contato" : "Eles me contactam"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contatos recentes */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-400" />
              Contatos Recentes
            </h2>
            <div className="space-y-2">
              {recentContacts.map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0 overflow-hidden">
                    {c.photo_url
                      ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                      : c.name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{c.name}</p>
                    {c.company && <p className="text-slate-500 text-xs truncate">{c.company}</p>}
                  </div>
                  <span className="text-slate-600 text-xs flex-shrink-0">{fmtDate(c.created_date)}</span>
                </div>
              ))}
              {contacts.length === 0 && <p className="text-slate-500 text-sm">Nenhum contato ainda</p>}
            </div>
            <a href={createPageUrl("Contacts")} className="text-blue-400 text-xs hover:text-blue-300 mt-3 block">
              Ver todos →
            </a>
          </div>

          {/* Distribuição de status */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Distribuição por Status
            </h2>
            <div className="space-y-2.5">
              {[
                { key: "prospect", label: "Prospect", color: "#f59e0b" },
                { key: "ativo", label: "Ativo", color: "#22c55e" },
                { key: "cliente", label: "Cliente", color: "#8b5cf6" },
                { key: "parceiro", label: "Parceiro", color: "#3b82f6" },
                { key: "investidor", label: "Investidor", color: "#ec4899" },
                { key: "inativo", label: "Inativo", color: "#94a3b8" },
              ]
                .map(s => {
                  const count = contacts.filter(c => c.status === s.key).length;
                  const pct = contacts.length ? Math.round((count / contacts.length) * 100) : 0;
                  return { ...s, count, pct };
                })
                .sort((a, b) => b.pct - a.pct)
                .map(s => (
                  <div key={s.key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">{s.label}</span>
                      <span className="text-slate-500">{s.count} ({s.pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, background: s.color }} />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, color, href }) {
  return (
    <a href={href} className={`bg-slate-900 border ${color} rounded-xl p-5 hover:bg-slate-800 transition-colors block`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-slate-400 text-sm mt-1">{label}</p>
    </a>
  );
}
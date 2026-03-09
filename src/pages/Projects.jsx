import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, X, Users, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [p, c, u] = await Promise.all([
      base44.entities.Project.list(),
      base44.entities.Contact.list("-created_date", 500),
      base44.auth.me().catch(() => null),
    ]);
    setProjects(p);
    setContacts(c);
    setUser(u);
    setLoading(false);
  };

  const canEdit = user?.role === "admin" || user?.role === "editor";

  const handleDelete = async (id) => {
    await base44.entities.Project.delete(id);
    await loadAll();
  };

  const STATUS_COLORS = {
    ativo: "bg-green-500/20 text-green-400",
    concluido: "bg-slate-500/20 text-slate-400",
    pausado: "bg-amber-500/20 text-amber-400",
    cancelado: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><FolderOpen className="w-5 h-5 text-blue-400" /> Projetos</h1>
          <p className="text-slate-400 text-sm">{projects.length} projetos</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
            <Plus className="w-4 h-4" /> Novo Projeto
          </Button>
        )}
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum projeto ainda</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(p => {
              const projectContacts = contacts.filter(c => p.contact_ids?.includes(c.id));
              return (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {p.color && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />}
                      <h3 className="text-white font-bold text-base">{p.name}</h3>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge className={`text-xs ${STATUS_COLORS[p.status] || ""}`}>{p.status}</Badge>
                      {canEdit && (
                        <button onClick={() => { setEditing(p); setShowForm(true); }} className="text-slate-500 hover:text-slate-300 text-xs">editar</button>
                      )}
                    </div>
                  </div>
                  {p.description && <p className="text-slate-400 text-sm mb-3">{p.description}</p>}
                  {projectContacts.length > 0 && (
                    <div>
                      <p className="text-slate-500 text-xs mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> {projectContacts.length} pessoas</p>
                      <div className="flex flex-wrap gap-1">
                        {projectContacts.slice(0, 5).map(c => (
                          <div key={c.id} className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-300" title={c.name}>
                            {c.name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}
                          </div>
                        ))}
                        {projectContacts.length > 5 && <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs text-slate-400">+{projectContacts.length - 5}</div>}
                      </div>
                    </div>
                  )}
                  {p.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {p.tags.map(t => <Badge key={t} variant="outline" className="text-xs border-slate-700 text-slate-400">{t}</Badge>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <ProjectForm
          project={editing}
          contacts={contacts}
          onSave={async (data) => {
            if (editing) await base44.entities.Project.update(editing.id, data);
            else await base44.entities.Project.create(data);
            setShowForm(false);
            setEditing(null);
            await loadAll();
          }}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ProjectForm({ project, contacts, onSave, onClose }) {
  const [form, setForm] = useState({
    name: "", description: "", status: "ativo",
    contact_ids: [], contact_names: [],
    start_date: "", end_date: "", tags: [], color: "#3b82f6",
    ...project,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleContact = (c) => {
    const ids = form.contact_ids || [];
    const names = form.contact_names || [];
    if (ids.includes(c.id)) {
      set("contact_ids", ids.filter(id => id !== c.id));
      set("contact_names", names.filter(n => n !== c.name));
    } else {
      set("contact_ids", [...ids, c.id]);
      set("contact_names", [...names, c.name]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-white font-bold">{project ? "Editar Projeto" : "Novo Projeto"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-slate-400 text-xs">Nome *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Cor</Label>
              <input type="color" value={form.color} onChange={e => set("color", e.target.value)} className="w-10 h-9 rounded-lg border border-slate-600 bg-slate-800 cursor-pointer" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">Descrição</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className="bg-slate-800 border-slate-600 text-white" />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">Status</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {["ativo","concluido","pausado","cancelado"].map(s => (
                  <SelectItem key={s} value={s} className="text-slate-200">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">Pessoas envolvidas</Label>
            <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-700 rounded-lg p-2">
              {contacts.map(c => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-700 rounded p-1">
                  <input
                    type="checkbox"
                    checked={form.contact_ids?.includes(c.id)}
                    onChange={() => toggleContact(c)}
                    className="accent-blue-500"
                  />
                  <span className="text-slate-200 text-sm">{c.name}</span>
                  {c.company && <span className="text-slate-500 text-xs">· {c.company}</span>}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Início</Label>
              <Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Fim</Label>
              <Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-700">
          <Button variant="outline" onClick={onClose} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800">Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name} className="flex-1 bg-blue-600 hover:bg-blue-700">Salvar</Button>
        </div>
      </div>
    </div>
  );
}
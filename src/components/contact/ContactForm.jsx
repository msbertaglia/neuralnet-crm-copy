import { useState, useEffect } from "react";
import { X, Upload, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const TABS = ["Básico", "Empresa", "Redes", "Relacionamento", "Próximo Passo"];

export default function ContactForm({ contact, contacts, onSave, onClose }) {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusOptions, setStatusOptions] = useState([]);
  const [form, setForm] = useState({
    name: "", nickname: "", photo_url: "", birth_date: "",
    company: "", company_logo_url: "", position: "", sector: "", status: "prospect",
    email: "", phone: "", address: "", city: "", state: "", country: "",
    linkedin_url: "", instagram_url: "", twitter_url: "", other_social: "",
    met_date: "", introduced_by_id: "", introduced_by_name: "", last_contact_date: "",
    tags: [], notes: "",
    next_step_description: "", next_step_date: "", next_step_type: "eu_contato", next_step_status: "sem_proximo_passo",
    visibility: "publico",
    ...contact,
  });
  const [tagInput, setTagInput] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true);
    
    // Don't save special states as names - only save actual contact names
    let introducedByName = "";
    let introducedById = form.introduced_by_id;
    
    if (form.introduced_by_id === "sem_informacao" || form.introduced_by_id === "direto") {
      introducedById = form.introduced_by_id; // Keep the special state
      introducedByName = ""; // Don't set a name
    } else if (form.introduced_by_id) {
      const found = contacts.find(c => c.id === form.introduced_by_id);
      introducedByName = found?.name || "";
    }
    
    await onSave({ ...form, introduced_by_id: introducedById, introduced_by_name: introducedByName });
    setLoading(false);
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags?.includes(tagInput.trim())) {
      set("tags", [...(form.tags || []), tagInput.trim()]);
      setTagInput("");
    }
  };

  const uploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("photo_url", file_url);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-white font-bold text-lg">{contact ? "Editar Contato" : "Novo Contato"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {/* Tab nav */}
        <div className="flex border-b border-slate-700 px-2">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`px-3 py-2.5 text-xs font-semibold transition-colors ${
                tab === i ? "text-blue-400 border-b-2 border-blue-500" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 0 && (
            <>
              <div className="flex gap-4 items-start">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-600 overflow-hidden flex items-center justify-center">
                    {form.photo_url ? (
                      <img src={form.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-slate-400 text-lg font-bold">
                        {form.name ? form.name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase() : "?"}
                      </span>
                    )}
                  </div>
                  <label className="cursor-pointer text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Foto
                    <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
                  </label>
                </div>
                <div className="flex-1 space-y-3">
                  <Field label="Nome completo *">
                    <Input value={form.name} onChange={e => set("name", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
                  </Field>
                  <Field label="Apelido">
                    <Input value={form.nickname} onChange={e => set("nickname", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
                  </Field>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <Select value={form.status} onValueChange={v => set("status", v)}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {["prospect","desconhecidos","empresas","familia","profissional","outros"].map(s => (
                        <SelectItem key={s} value={s} className="text-slate-200">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Data de nascimento">
                  <Input type="date" value={form.birth_date} onChange={e => set("birth_date", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
                </Field>
                <Field label="Email">
                  <Input value={form.email} onChange={e => set("email", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
                </Field>
                <Field label="Telefone">
                  <Input value={form.phone} onChange={e => set("phone", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
                </Field>
              </div>
              <Field label="Visibilidade">
                <Select value={form.visibility} onValueChange={v => set("visibility", v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="publico" className="text-slate-200">Público (time todo)</SelectItem>
                    <SelectItem value="privado" className="text-slate-200">Privado (só eu)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tags">
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} placeholder="Digite e pressione Enter" className="bg-slate-800 border-slate-600 text-white" />
                  <Button size="sm" onClick={addTag} className="bg-slate-700 hover:bg-slate-600"><Plus className="w-4 h-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags?.map(t => (
                    <span key={t} className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      {t}
                      <button onClick={() => set("tags", form.tags.filter(x => x !== t))}><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                </div>
              </Field>
              <Field label="Observações">
                <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} className="bg-slate-800 border-slate-600 text-white" />
              </Field>
            </>
          )}

          {tab === 1 && (
            <div className="space-y-3">
              <Field label="Empresa">
                <Input value={form.company} onChange={e => set("company", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
              </Field>
              <Field label="URL do Logo da Empresa">
                <Input value={form.company_logo_url} onChange={e => set("company_logo_url", e.target.value)} placeholder="https://..." className="bg-slate-800 border-slate-600 text-white" />
              </Field>
              <Field label="Cargo">
                <Input value={form.position} onChange={e => set("position", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
              </Field>
              <Field label="Setor">
                <Input value={form.sector} onChange={e => set("sector", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
              </Field>
              <Field label="Endereço">
                <Input value={form.address} onChange={e => set("address", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Cidade">
                  <Input value={form.city} onChange={e => set("city", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
                </Field>
                <Field label="Estado">
                  <Input value={form.state} onChange={e => set("state", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
                </Field>
                <Field label="País">
                  <Input value={form.country} onChange={e => set("country", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
                </Field>
              </div>
            </div>
          )}

          {tab === 2 && (
            <div className="space-y-3">
              <Field label="LinkedIn URL"><Input value={form.linkedin_url} onChange={e => set("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/..." className="bg-slate-800 border-slate-600 text-white" /></Field>
              <Field label="Instagram URL"><Input value={form.instagram_url} onChange={e => set("instagram_url", e.target.value)} placeholder="https://instagram.com/..." className="bg-slate-800 border-slate-600 text-white" /></Field>
              <Field label="Twitter/X URL"><Input value={form.twitter_url} onChange={e => set("twitter_url", e.target.value)} placeholder="https://twitter.com/..." className="bg-slate-800 border-slate-600 text-white" /></Field>
              <Field label="Outra rede"><Input value={form.other_social} onChange={e => set("other_social", e.target.value)} className="bg-slate-800 border-slate-600 text-white" /></Field>
            </div>
          )}

          {tab === 3 && (
            <div className="space-y-3">
              <Field label="Data que nos conhecemos">
                <Input type="date" value={form.met_date} onChange={e => set("met_date", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
              </Field>
              <Field label="Apresentado por">
                <Select value={form.introduced_by_id || "sem_informacao"} onValueChange={v => {
                  set("introduced_by_id", v);
                  // Name will be set on submit
                }}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="sem_informacao" className="text-slate-400">Sem informação (campo vazio)</SelectItem>
                    <SelectItem value="direto" className="text-slate-400">Direto (sem intermediário)</SelectItem>
                    {contacts.filter(c => c.id !== contact?.id).map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-slate-200">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Último contato">
                <Input type="date" value={form.last_contact_date} onChange={e => set("last_contact_date", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
              </Field>
            </div>
          )}

          {tab === 4 && (
            <div className="space-y-3">
              <Field label="Descrição do próximo passo">
                <Textarea value={form.next_step_description} onChange={e => set("next_step_description", e.target.value)} rows={3} className="bg-slate-800 border-slate-600 text-white" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data limite">
                  <Input type="date" value={form.next_step_date} onChange={e => set("next_step_date", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
                </Field>
                <Field label="Tipo">
                  <Select value={form.next_step_type} onValueChange={v => set("next_step_type", v)}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="eu_contato" className="text-slate-200">Eu devo contatar</SelectItem>
                      <SelectItem value="aguardando_deles" className="text-slate-200">Aguardando deles</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Status do próximo passo">
                <Select value={form.next_step_status} onValueChange={v => set("next_step_status", v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {["pendente","aguardando","atrasado","concluido","sem_proximo_passo"].map(s => (
                      <SelectItem key={s} value={s} className="text-slate-200">{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-700">
          <Button variant="outline" onClick={onClose} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !form.name} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-slate-400 text-xs">{label}</Label>
      {children}
    </div>
  );
}
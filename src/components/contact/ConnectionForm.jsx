import { useState, useMemo } from "react";
import { X, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ConnectionForm({ contacts, connection, existingConnections = [], onSave, onClose }) {
  const [form, setForm] = useState({
    contact_a_id: "", contact_b_id: "",
    connection_date: "", discovered_date: "",
    introduced_by_id: "",
    connection_type: "profissional",
    strength: "media",
    notes: "",
    ...connection,
  });
  const [pendingImplied, setPendingImplied] = useState(null); // suggested implicit connection

  const set = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      return next;
    });
    setPendingImplied(null);
  };

  // Detect missing implied connection: if introducer is set, check if introducer↔contactB exists
  const missingImplied = useMemo(() => {
    if (!form.introduced_by_id || !form.contact_b_id) return null;
    const introId = form.introduced_by_id;
    const bId = form.contact_b_id;
    if (introId === bId) return null;
    const alreadyExists = existingConnections.find(c =>
      (c.contact_a_id === introId && c.contact_b_id === bId) ||
      (c.contact_b_id === introId && c.contact_a_id === bId)
    );
    if (alreadyExists) return null;
    const intro = contacts.find(c => c.id === introId);
    const b = contacts.find(c => c.id === bId);
    return intro && b ? { introId, bId, introName: intro.name, bName: b.name } : null;
  }, [form.introduced_by_id, form.contact_b_id, existingConnections, contacts]);

  const handleSubmit = async () => {
    const a = contacts.find(c => c.id === form.contact_a_id);
    const b = contacts.find(c => c.id === form.contact_b_id);
    const intro = contacts.find(c => c.id === form.introduced_by_id);
    await onSave({
      ...form,
      contact_a_name: a?.name || "",
      contact_b_name: b?.name || "",
      introduced_by_name: intro?.name || "",
    });
    // If user approved suggested implied connection, save it too
    if (pendingImplied) {
      const introContact = contacts.find(c => c.id === pendingImplied.introId);
      const bContact = contacts.find(c => c.id === pendingImplied.bId);
      await onSave({
        contact_a_id: pendingImplied.introId,
        contact_b_id: pendingImplied.bId,
        contact_a_name: introContact?.name || "",
        contact_b_name: bContact?.name || "",
        connection_type: form.connection_type,
        strength: "media",
        introduced_by_id: "",
        introduced_by_name: "",
        notes: "Conexão criada automaticamente pela hierarquia de apresentação.",
        connection_date: form.connection_date,
        discovered_date: form.discovered_date,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-white font-bold text-lg">{connection ? "Editar Conexão" : "Nova Conexão"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Pessoa A *">
            <ContactSelect contacts={contacts} value={form.contact_a_id} onChange={v => set("contact_a_id", v)} exclude={form.contact_b_id} />
          </Field>
          <Field label="Conheceu Pessoa B *">
            <ContactSelect contacts={contacts} value={form.contact_b_id} onChange={v => set("contact_b_id", v)} exclude={form.contact_a_id} />
          </Field>
          <Field label="Por intermediário de">
            <ContactSelect contacts={contacts} value={form.introduced_by_id || "none"} onChange={v => set("introduced_by_id", v === "none" ? "" : v)} allowNone />
          </Field>
          <Field label="Data da conexão">
            <Input type="date" value={form.connection_date} onChange={e => set("connection_date", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={form.connection_type} onValueChange={v => set("connection_type", v)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {["profissional","pessoal","negocios","parceria","cliente","fornecedor"].map(t => (
                    <SelectItem key={t} value={t} className="text-slate-200">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Intensidade">
            <Select value={form.strength} onValueChange={v => set("strength", v)}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="fraca" className="text-slate-200">Fraca</SelectItem>
                <SelectItem value="media" className="text-slate-200">Média</SelectItem>
                <SelectItem value="forte" className="text-slate-200">Forte</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notas">
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="bg-slate-800 border-slate-600 text-white" />
          </Field>

          {/* Suggested implied connection */}
          {missingImplied && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-amber-300 text-xs leading-relaxed">
                  <strong>{missingImplied.introName}</strong> está como apresentador, mas não há conexão cadastrada entre <strong>{missingImplied.introName}</strong> e <strong>{missingImplied.bName}</strong>. Para manter a hierarquia correta na rede, crie essa conexão também.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs h-7"
                  onClick={() => setPendingImplied(missingImplied)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {pendingImplied ? "✓ Será criada junto" : `Criar ${missingImplied.introName} ↔ ${missingImplied.bName}`}
                </Button>
                {pendingImplied && (
                  <Button size="sm" variant="ghost" className="text-slate-400 text-xs h-7" onClick={() => setPendingImplied(null)}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-700">
          <Button variant="outline" onClick={onClose} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.contact_a_id || !form.contact_b_id} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
            {pendingImplied ? "Salvar (2 conexões)" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ContactSelect({ contacts, value, onChange, exclude, allowNone }) {
  const getDisplayName = (val) => {
    if (val === "sem_informacao") return "Sem informação";
    if (val === "direto") return "Direto";
    const contact = contacts.find(c => c.id === val);
    return contact?.name || "";
  };

  return (
    <Select value={value || "sem_informacao"} onValueChange={onChange}>
      <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
        <SelectValue placeholder="Selecione...">
          {getDisplayName(value)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-slate-800 border-slate-700">
        {allowNone && (
          <>
            <SelectItem value="sem_informacao" className="text-slate-400">Sem informação</SelectItem>
            <SelectItem value="direto" className="text-slate-400">Direto</SelectItem>
          </>
        )}
        {contacts.filter(c => c.id !== exclude).map(c => (
          <SelectItem key={c.id} value={c.id} className="text-slate-200">{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
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
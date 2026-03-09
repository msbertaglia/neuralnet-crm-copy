import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ConnectionForm({ contacts, connection, onSave, onClose }) {
  const [form, setForm] = useState({
    contact_a_id: "", contact_b_id: "",
    connection_date: "", discovered_date: "",
    introduced_by_id: "",
    connection_type: "profissional",
    strength: "media",
    notes: "",
    ...connection,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
          <Field label="Pessoa B *">
            <ContactSelect contacts={contacts} value={form.contact_b_id} onChange={v => set("contact_b_id", v)} exclude={form.contact_a_id} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data da conexão">
              <Input type="date" value={form.connection_date} onChange={e => set("connection_date", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
            </Field>
            <Field label="Data descoberta (por mim)">
              <Input type="date" value={form.discovered_date} onChange={e => set("discovered_date", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
            </Field>
          </div>
          <Field label="Quem apresentou">
            <ContactSelect contacts={contacts} value={form.introduced_by_id || "none"} onChange={v => set("introduced_by_id", v === "none" ? "" : v)} allowNone />
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
          </div>
          <Field label="Notas">
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="bg-slate-800 border-slate-600 text-white" />
          </Field>
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-700">
          <Button variant="outline" onClick={onClose} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.contact_a_id || !form.contact_b_id} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Salvar</Button>
        </div>
      </div>
    </div>
  );
}

function ContactSelect({ contacts, value, onChange, exclude, allowNone }) {
  return (
    <Select value={value || "none"} onValueChange={onChange}>
      <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
      <SelectContent className="bg-slate-800 border-slate-700">
        {allowNone && <SelectItem value="none" className="text-slate-400">Ninguém</SelectItem>}
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
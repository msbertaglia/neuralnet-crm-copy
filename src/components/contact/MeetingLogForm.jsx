import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function MeetingLogForm({ contactId, contactName, onSave, onClose }) {
  const [form, setForm] = useState({
    contact_id: contactId,
    contact_name: contactName,
    date: new Date().toISOString().split("T")[0],
    type: "reuniao_presencial",
    summary: "",
    outcome: "",
    duration_minutes: "",
    visibility: "publico",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div>
            <h2 className="text-white font-bold text-lg">Novo Log</h2>
            <p className="text-slate-400 text-xs">{contactName}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
            </Field>
            <Field label="Tipo">
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {["reuniao_presencial","videochamada","ligacao","email","whatsapp","linkedin","evento","outro"].map(t => (
                    <SelectItem key={t} value={t} className="text-slate-200">{t.replace(/_/g," ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Resumo">
            <Textarea value={form.summary} onChange={e => set("summary", e.target.value)} rows={3} className="bg-slate-800 border-slate-600 text-white" />
          </Field>
          <Field label="Resultado / próximo passo acordado">
            <Textarea value={form.outcome} onChange={e => set("outcome", e.target.value)} rows={2} className="bg-slate-800 border-slate-600 text-white" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duração (min)">
              <Input type="number" value={form.duration_minutes} onChange={e => set("duration_minutes", e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
            </Field>
            <Field label="Visibilidade">
              <Select value={form.visibility} onValueChange={v => set("visibility", v)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="publico" className="text-slate-200">Público</SelectItem>
                  <SelectItem value="privado" className="text-slate-200">Privado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-700">
          <Button variant="outline" onClick={onClose} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800">Cancelar</Button>
          <Button onClick={() => onSave(form)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Salvar Log</Button>
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
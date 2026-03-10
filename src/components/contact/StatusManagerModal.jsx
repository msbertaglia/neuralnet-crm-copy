import { X } from "lucide-react";

const STATUSES = [
  { value: "prospect",      label: "Prospect",      color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { value: "desconhecidos", label: "Desconhecidos",  color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  { value: "empresas",      label: "Empresas",       color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "familia",       label: "Família",        color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  { value: "profissional",  label: "Profissional",   color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { value: "outros",        label: "Outros",         color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
];

export default function StatusManagerModal({ contacts, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Status</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {STATUSES.map(s => {
            const count = contacts.filter(c => c.status === s.value).length;
            return (
              <div key={s.value} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${s.color}`}>
                  {s.label}
                </span>
                <span className="text-slate-400 text-sm">
                  {count} contato{count !== 1 ? "s" : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
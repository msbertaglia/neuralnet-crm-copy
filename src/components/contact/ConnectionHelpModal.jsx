import { X } from "lucide-react";

export default function ConnectionHelpModal({ onClose }) {
  const rules = [
    {
      color: "bg-red-500",
      label: "Vermelho",
      description: "Sem informação ou sem conexão definida"
    },
    {
      color: "bg-yellow-500",
      label: "Amarelo",
      description: "Conexão direta ou conexão com o usuário logado"
    },
    {
      color: "bg-green-500",
      label: "Verde",
      description: "Conexão com algum contato que não seja o central"
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Índice de Cores - Conexões</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-slate-400 text-sm mb-4">
            As cores indicam o tipo de conexão de cada contato em relação ao campo "apresentado por":
          </p>

          {rules.map((rule, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${rule.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{rule.label}</p>
                <p className="text-slate-400 text-xs mt-0.5">{rule.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
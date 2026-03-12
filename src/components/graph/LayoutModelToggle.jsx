import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const LAYOUT_MODELS = [
  {
    id: "padrao",
    label: "Padrão",
    icon: "◉",
    description: "Órbitas mínimas com espaçamento variável entre camadas. Planetas mais próximos dos pais sem cruzar arestas.",
  },
  {
    id: "voronoi",
    label: "Orgânico",
    icon: "⬡",
    description: "Filhos se agrupam ao redor do pai em leque. N2+ se posicionam relativamente ao pai, como no NeuralNet original.",
  },
  {
    id: "proporcional",
    label: "Proporcional",
    icon: "◎",
    description: "Setores proporcionais ao nº de filhos, de dentro pra fora. Arestas nunca se cruzam.",
  },
  {
    id: "arvore",
    label: "Árvore",
    icon: "⋈",
    description: "Filhos agrupados em cone estreito sob o pai. Visual de árvore hierárquica.",
  },
  {
    id: "espiral",
    label: "Espiral",
    icon: "↺",
    description: "Filhos distribuídos em leque assimétrico. Cada família rotaciona levemente.",
  },
];

export default function LayoutModelToggle({ value, onChange }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
        {LAYOUT_MODELS.map((m) => (
          <Tooltip key={m.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onChange(m.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  value === m.id
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                }`}
              >
                <span className="text-sm leading-none">{m.icon}</span>
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px] text-center">
              <p className="font-semibold">{m.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
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
  {
    id: "fibonacci",
    label: "Fibonacci",
    icon: "🌀",
    description: "Posicionamento baseado na espiral áurea de Fibonacci. Ângulo dourado (137.5°) entre irmãos, órbitas em proporção áurea.",
  },
];

export default function LayoutModelToggle({ value, onChange }) {
  const current = LAYOUT_MODELS.find(m => m.id === value) || LAYOUT_MODELS[0];

  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 pl-7 pr-2 text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-lg appearance-none cursor-pointer hover:bg-slate-700 transition-colors"
      >
        {LAYOUT_MODELS.map(m => (
          <option key={m.id} value={m.id}>{m.icon} {m.label}</option>
        ))}
      </select>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none">{current.icon}</span>
    </div>
  );
}
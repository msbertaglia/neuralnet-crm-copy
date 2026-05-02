import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle, Loader2, Database } from "lucide-react";

const ENTITIES = [
  { name: "Contact", label: "Contatos" },
  { name: "Connection", label: "Conexões" },
  { name: "Project", label: "Projetos" },
  { name: "MeetingLog", label: "Reuniões / Logs" },
  { name: "Document", label: "Documentos" },
  { name: "ContactStatus", label: "Status Customizados" },
];

export default function ExportData() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState([]);

  const handleExportCSV = async () => {
    setLoading(true);
    try {
      const contacts = await base44.entities.Contact.list(undefined, 9999);
      const headers = ["Nome", "Status", "Tags", "Empresa"];
      const rows = contacts.map(c => [
        `"${(c.name || "").replace(/"/g, '""')}"`,
        `"${(c.status || "").replace(/"/g, '""')}"`,
        `"${(Array.isArray(c.tags) ? c.tags.join(", ") : "").replace(/"/g, '""')}"`,
        `"${(c.company || "").replace(/"/g, '""')}"`,
      ]);
      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contatos_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setDone(false);
    setProgress([]);

    const allData = {};
    const log = [];

    for (const entity of ENTITIES) {
      try {
        // Fetch all records (up to 9999)
        const records = await base44.entities[entity.name].list(undefined, 9999);
        allData[entity.name] = records;
        log.push({ label: entity.label, count: records.length, ok: true });
      } catch (e) {
        allData[entity.name] = [];
        log.push({ label: entity.label, count: 0, ok: false, error: e.message });
      }
      setProgress([...log]);
    }

    // Download as JSON
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `netmap_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setLoading(false);
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Exportar Banco de Dados</h1>
            <p className="text-slate-400 text-sm">Baixa todos os dados em formato JSON</p>
          </div>
        </div>

        <div className="mb-6 space-y-2">
          {ENTITIES.map((e) => {
            const p = progress.find(x => x.label === e.label);
            return (
              <div key={e.name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50">
                <span className="text-slate-300 text-sm">{e.label}</span>
                {p ? (
                  p.ok
                    ? <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />{p.count} registros</span>
                    : <span className="text-red-400 text-xs">Erro</span>
                ) : (
                  <span className="text-slate-600 text-xs">—</span>
                )}
              </div>
            );
          })}
        </div>

        <Button
          onClick={handleExportCSV}
          disabled={loading}
          className="w-full mb-3 bg-green-700 hover:bg-green-800 text-white"
        >
          <Download className="w-4 h-4" /> Exportar Contatos (CSV simples)
        </Button>

        <Button
          onClick={handleExport}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Exportando...</>
          ) : done ? (
            <><CheckCircle className="w-4 h-4" /> Exportado com sucesso!</>
          ) : (
            <><Download className="w-4 h-4" /> Exportar tudo (.json)</>
          )}
        </Button>

        {done && (
          <p className="text-slate-400 text-xs text-center mt-3">
            Arquivo baixado. Use-o para importar no outro app Base44.
          </p>
        )}
      </div>
    </div>
  );
}
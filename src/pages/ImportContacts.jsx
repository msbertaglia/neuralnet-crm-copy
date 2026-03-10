import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertCircle, FileText } from "lucide-react";

export default function ImportContacts() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const response = await base44.functions.invoke('importDexContacts', { csv_url: file_url });
    
    if (response.data.error) {
      setError(response.data.error);
    } else {
      setResult(response.data);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Importar Contatos do DEX</h1>
          <p className="text-slate-400 text-sm mt-1">Selecione o arquivo CSV exportado do DEX</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 space-y-5">
          <label className="block cursor-pointer">
            <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              file ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500'
            }`}>
              <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
              {file ? (
                <p className="text-blue-400 font-medium text-sm">{file.name}</p>
              ) : (
                <p className="text-slate-400 text-sm">Clique para selecionar o CSV</p>
              )}
            </div>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { setFile(e.target.files[0]); setResult(null); setError(null); }}
            />
          </label>

          <Button
            onClick={handleImport}
            disabled={!file || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload className="w-4 h-4 mr-2" />
            {loading ? "Importando..." : "Importar Contatos"}
          </Button>

          {result && (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-green-300 text-sm font-medium">
                {result.imported} contatos importados com sucesso!
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
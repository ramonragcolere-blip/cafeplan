import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

const CSV_COLUNAS = [
  'nome', 'ingrediente_ativo', 'fornecedor', 'grupo',
  'dose_viveiro', 'dose_plantio', 'dose_1ano_recepa', 'unidade_aplicacao',
  'dose_producao', 'dose_esqueletado', 'instrucoes_uso', 'funcao_composicao', 'intervalo_seguranca'
];

function parseCSV(texto) {
  const linhas = texto.trim().split(/\r?\n/);
  if (linhas.length < 2) return [];
  const cabecalho = linhas[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  return linhas.slice(1).map(linha => {
    // Handle quoted fields with commas
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    cols.push(current.trim());
    const obj = {};
    cabecalho.forEach((col, idx) => { obj[col] = (cols[idx] || '').replace(/^"|"$/g, '').trim(); });
    return obj;
  }).filter(r => r.nome);
}

export default function ImportarInsumoCSV({ open, onOpenChange, nomesExistentes, onImportado }) {
  const [preview, setPreview] = useState([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setResultado(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const linhas = parseCSV(ev.target.result);
      setPreview(linhas);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const nomesSet = new Set((nomesExistentes || []).map(n => n.toLowerCase().trim()));

  const novos = preview.filter(r => !nomesSet.has((r.nome || '').toLowerCase().trim()));
  const duplicatas = preview.filter(r => nomesSet.has((r.nome || '').toLowerCase().trim()));

  const handleImportar = async () => {
    if (!novos.length) return;
    setLoading(true);
    let criados = 0;
    let erros = 0;
    for (const row of novos) {
      const data = {};
      CSV_COLUNAS.forEach(col => { if (row[col]) data[col] = row[col]; });
      try {
        await base44.entities.FertilizanteFormulado.create(data);
        criados++;
      } catch {
        erros++;
      }
    }
    setLoading(false);
    setResultado({ criados, erros, duplicatas: duplicatas.length });
    queryClient.invalidateQueries({ queryKey: ['fertilizantes'] });
    if (onImportado) onImportado();
    toast({ title: `Importação concluída: ${criados} produto(s) criado(s)` + (erros ? `, ${erros} erro(s)` : '') });
  };

  const handleClose = () => {
    setPreview([]);
    setFileName('');
    setResultado(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5" />Importar Insumos via CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instruções */}
          <div className="bg-muted/40 rounded-xl p-4 text-sm space-y-2">
            <p className="font-medium text-sm">Colunas esperadas no CSV (separadas por vírgula):</p>
            <div className="flex flex-wrap gap-1">
              {CSV_COLUNAS.map(c => <code key={c} className="bg-card border border-border rounded px-1.5 py-0.5 text-xs">{c}</code>)}
            </div>
            <p className="text-xs text-muted-foreground">A coluna <strong>nome</strong> é obrigatória. Produtos com nome já existente serão pulados.</p>
          </div>

          {/* Upload */}
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:bg-muted/30 transition-colors">
            <FileText className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{fileName || 'Clique para selecionar um arquivo CSV'}</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </label>

          {/* Preview */}
          {preview.length > 0 && !resultado && (
            <div className="space-y-2">
              <div className="flex gap-3 text-sm">
                <span className="flex items-center gap-1.5 text-green-700"><CheckCircle2 className="w-4 h-4" />{novos.length} para importar</span>
                {duplicatas.length > 0 && <span className="flex items-center gap-1.5 text-amber-600"><AlertCircle className="w-4 h-4" />{duplicatas.length} duplicata(s) serão puladas</span>}
              </div>
              <div className="border border-border rounded-lg overflow-auto max-h-48">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-3 py-2">Nome</th>
                      <th className="text-left px-3 py-2">Grupo</th>
                      <th className="text-left px-3 py-2">Fornecedor</th>
                      <th className="text-left px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => {
                      const isDup = nomesSet.has((r.nome || '').toLowerCase().trim());
                      return (
                        <tr key={i} className="border-t border-border/50">
                          <td className="px-3 py-1.5">{r.nome}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.grupo || '—'}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.fornecedor || '—'}</td>
                          <td className="px-3 py-1.5">
                            {isDup
                              ? <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Duplicata</Badge>
                              : <Badge variant="outline" className="text-xs text-green-700 border-green-300">Novo</Badge>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-1">
              <p className="font-medium text-green-800">Importação concluída!</p>
              <p className="text-green-700">{resultado.criados} produto(s) criado(s)</p>
              {resultado.duplicatas > 0 && <p className="text-amber-600">{resultado.duplicatas} duplicata(s) pulada(s)</p>}
              {resultado.erros > 0 && <p className="text-red-600">{resultado.erros} erro(s)</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
          {!resultado && novos.length > 0 && (
            <Button onClick={handleImportar} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importar {novos.length} produto(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
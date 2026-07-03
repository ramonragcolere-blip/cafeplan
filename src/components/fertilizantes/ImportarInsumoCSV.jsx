import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText, RefreshCw } from 'lucide-react';
const CSV_COLUNAS = [
  'nome', 'ingrediente_ativo', 'fornecedor', 'grupo',
  'dose_viveiro', 'dose_plantio', 'dose_1ano_recepa', 'unidade_costal',
  'dose_producao', 'dose_esqueletado', 'unidade_aplicacao',
  'instrucoes_uso', 'funcao_composicao', 'intervalo_seguranca'
];

function parseCSV(texto) {
  const parseErrors = [];
  const linhas = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (ch === '"') { inQuotes = !inQuotes; current += ch; }
    else if (ch === '\n' && !inQuotes) { linhas.push(current.replace(/\r$/, '')); current = ''; }
    else { current += ch; }
  }
  if (current.trim()) linhas.push(current);
  if (linhas.length < 2) return { rows: [], parseErrors };

  const cabecalho = linhas[0].split(',').map(c => c.trim().replace(/^"|"$/g, '').toLowerCase());

  const rows = [];
  for (let li = 1; li < linhas.length; li++) {
    const linha = linhas[li];
    if (!linha.trim()) continue;
    const cols = [];
    let cel = '';
    let inQ = false;
    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cel.trim()); cel = ''; }
      else { cel += ch; }
    }
    cols.push(cel.trim());
    const obj = {};
    cabecalho.forEach((col, idx) => { obj[col] = (cols[idx] || '').replace(/^"|"$/g, '').trim(); });
    if (obj.nome) rows.push(obj);
  }
  return { rows, parseErrors };
}

export default function ImportarInsumoCSV({ open, onOpenChange, produtosExistentes = [], onImportado }) {
  const [preview, setPreview] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mapa nome (lowercase) → produto existente completo (com id)
  const mapaExistentes = new Map(
    produtosExistentes.map(p => [p.nome.toLowerCase().trim(), p])
  );

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setResultado(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows, parseErrors: errs } = parseCSV(ev.target.result);
      setPreview(rows);
      setParseErrors(errs);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const novos = preview.filter(r => !mapaExistentes.has((r.nome || '').toLowerCase().trim()));
  const aAtualizar = preview.filter(r => mapaExistentes.has((r.nome || '').toLowerCase().trim()));

  const handleImportar = async () => {
    if (!novos.length && !aAtualizar.length) return;
    setLoading(true);
    let criados = 0;
    let atualizados = 0;
    let erros = 0;

    for (const row of novos) {
      const data = {};
      CSV_COLUNAS.forEach(col => { if (row[col]) data[col] = row[col]; });
      try {
        await base44.entities.FertilizanteFormulado.create(data);
        criados++;
      } catch { erros++; }
    }

    for (const row of aAtualizar) {
      const existente = mapaExistentes.get((row.nome || '').toLowerCase().trim());
      const data = {};
      CSV_COLUNAS.forEach(col => { if (row[col]) data[col] = row[col]; });
      try {
        await base44.entities.FertilizanteFormulado.update(existente.id, data);
        atualizados++;
      } catch { erros++; }
    }

    setLoading(false);
    setResultado({ criados, atualizados, erros });
    queryClient.invalidateQueries({ queryKey: ['fertilizantes'] });
    if (onImportado) onImportado();
    toast({ title: `Importação concluída: ${criados} criado(s), ${atualizados} atualizado(s)` + (erros ? `, ${erros} erro(s)` : '') });
  };

  const handleClose = () => {
    setPreview([]);
    setParseErrors([]);
    setFileName('');
    setResultado(null);
    onOpenChange(false);
  };

  const totalParaImportar = novos.length + aAtualizar.length;

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
            <p className="text-xs text-muted-foreground">A coluna <strong>nome</strong> é obrigatória. Produtos com nome já existente serão <strong>atualizados</strong>.</p>
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
              {parseErrors.length > 0 && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {parseErrors.length} linha(s) ignorada(s) por formato inválido: {parseErrors.map(e => e.message).join('; ')}
                </div>
              )}
              <div className="flex gap-4 text-sm flex-wrap">
                {novos.length > 0 && (
                  <span className="flex items-center gap-1.5 text-green-700"><CheckCircle2 className="w-4 h-4" />{novos.length} novo(s)</span>
                )}
                {aAtualizar.length > 0 && (
                  <span className="flex items-center gap-1.5 text-blue-600"><RefreshCw className="w-4 h-4" />{aAtualizar.length} a atualizar</span>
                )}
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
                      const isExistente = mapaExistentes.has((r.nome || '').toLowerCase().trim());
                      return (
                        <tr key={i} className="border-t border-border/50">
                          <td className="px-3 py-1.5">{r.nome}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.grupo || '—'}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.fornecedor || '—'}</td>
                          <td className="px-3 py-1.5">
                            {isExistente
                              ? <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">Atualizar</Badge>
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
              {resultado.criados > 0 && <p className="text-green-700">{resultado.criados} produto(s) criado(s)</p>}
              {resultado.atualizados > 0 && <p className="text-blue-700">{resultado.atualizados} produto(s) atualizado(s)</p>}
              {resultado.erros > 0 && <p className="text-red-600">{resultado.erros} erro(s)</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
          {!resultado && totalParaImportar > 0 && (
            <Button onClick={handleImportar} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importar {totalParaImportar} produto(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText, RefreshCw } from 'lucide-react';

const COLUNAS_ESPERADAS = [
  'produtor_codigo', 'produtor_nome', 'produtor_fazenda', 'produtor_municipio',
  'produtor_uf', 'produtor_contato', 'talhao_nome', 'fase_atual', 'area_ha',
  'num_plantas', 'cultivar', 'espacamento', 'metodo_colheita', 'declividade',
  'pct_mec_colheita', 'pct_mec_rocada', 'pct_mec_herbicida', 'pct_mec_adubacao',
  'rendimento_colheita_manual_lppd', 'observacoes',
];

const FASE_ENUM = ['Em produção', 'Em formação', 'Safra zero', 'Recepado/Brotando'];
const METODO_ENUM = ['Manual', 'Derriçadeira', 'Colhedora', 'Recolhedora', 'Varrição Manual', 'Varrição Mecanizada'];
const DECLIVIDADE_ENUM = ['Plano 0-8%', 'Suave ondulado 8-20%', 'Ondulado 20-45%', 'Forte ondulado >45%'];

const NUM_FIELDS = ['area_ha', 'num_plantas', 'pct_mec_colheita', 'pct_mec_rocada', 'pct_mec_herbicida', 'pct_mec_adubacao', 'rendimento_colheita_manual_lppd'];

function parseNum(v) {
  if (v == null || v === '') return undefined;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? undefined : n;
}

function matchEnum(val, list) {
  if (!val) return null;
  const lower = val.trim().toLowerCase();
  return list.find(e => e.toLowerCase() === lower) || null;
}

function analyzeRows(rows, produtoresExistentes, talhoesExistentes) {
  // Mapa codigo → produtor existente
  const mapaProd = new Map(produtoresExistentes.map(p => [p.codigo?.toLowerCase().trim(), p]));
  // Mapa "codigo_produtor|nome" → talhão existente
  const mapaTal = new Map(talhoesExistentes.map(t => [`${(t.codigo_produtor || '').toLowerCase().trim()}|${(t.nome || '').toLowerCase().trim()}`, t]));

  const produtoresMap = new Map(); // codigo → { data, linhas, isNovo }
  const talhoesLista = []; // { rowIdx, row, prodCodigo, isNovo, avisos }
  const erros = []; // { linha, msg }

  rows.forEach((row, idx) => {
    const lineNum = idx + 2; // 1-based + header
    const codigo = (row.produtor_codigo || '').trim();
    const nome = (row.produtor_nome || '').trim();
    const fazenda = (row.produtor_fazenda || '').trim();

    if (!codigo) {
      erros.push({ linha: lineNum, msg: 'produtor_codigo obrigatório' });
      return;
    }

    // Upsert produtor (agrupa por codigo, usa primeira ocorrência para campos obrigatórios)
    if (!produtoresMap.has(codigo.toLowerCase())) {
      if (!nome || !fazenda) {
        erros.push({ linha: lineNum, msg: `Produtor ${codigo}: nome e fazenda obrigatórios na primeira ocorrência` });
        return;
      }
      const existente = mapaProd.get(codigo.toLowerCase()) || null;
      produtoresMap.set(codigo.toLowerCase(), {
        codigo, nome, fazenda,
        municipio: row.produtor_municipio?.trim() || '',
        uf: row.produtor_uf?.trim() || '',
        contato: row.produtor_contato?.trim() || '',
        existente,
        isNovo: !existente,
      });
    } else {
      // Linhas subsequentes do mesmo produtor: enriquecer campos vazios
      const p = produtoresMap.get(codigo.toLowerCase());
      if (!p.municipio && row.produtor_municipio?.trim()) p.municipio = row.produtor_municipio.trim();
      if (!p.uf && row.produtor_uf?.trim()) p.uf = row.produtor_uf.trim();
      if (!p.contato && row.produtor_contato?.trim()) p.contato = row.produtor_contato.trim();
    }

    // Talhão — só se talhao_nome presente
    const talhaoNome = (row.talhao_nome || '').trim();
    if (!talhaoNome) return;

    const chave = `${codigo.toLowerCase()}|${talhaoNome.toLowerCase()}`;
    const existenteTal = mapaTal.get(chave) || null;
    const avisos = [];

    const faseVal = row.fase_atual?.trim();
    const faseOk = faseVal ? matchEnum(faseVal, FASE_ENUM) : null;
    if (faseVal && !faseOk) avisos.push(`fase_atual inválida ("${faseVal}")`);

    const metodoVal = row.metodo_colheita?.trim();
    const metodoOk = metodoVal ? matchEnum(metodoVal, METODO_ENUM) : null;
    if (metodoVal && !metodoOk) avisos.push(`metodo_colheita inválido ("${metodoVal}")`);

    const declVal = row.declividade?.trim();
    const declOk = declVal ? matchEnum(declVal, DECLIVIDADE_ENUM) : null;
    if (declVal && !declOk) avisos.push(`declividade inválida ("${declVal}")`);

    talhoesLista.push({
      rowIdx: lineNum,
      talhaoNome,
      prodCodigo: codigo.toLowerCase(),
      isNovo: !existenteTal,
      existente: existenteTal,
      row,
      faseOk,
      metodoOk,
      declOk,
      avisos,
    });
  });

  return { produtoresMap, talhoesLista, erros };
}

export default function ImportarProdutoresTalhoesCSV({ open, onOpenChange, produtoresExistentes = [], talhoesExistentes = [], onImportado }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { produtoresMap, talhoesLista, erros } = useMemo(
    () => rows.length > 0 ? analyzeRows(rows, produtoresExistentes, talhoesExistentes) : { produtoresMap: new Map(), talhoesLista: [], erros: [] },
    [rows, produtoresExistentes, talhoesExistentes]
  );

  const prodArray = Array.from(produtoresMap.values());
  const prodNovos = prodArray.filter(p => p.isNovo).length;
  const prodAtualizar = prodArray.filter(p => !p.isNovo).length;
  const talNovos = talhoesLista.filter(t => t.isNovo).length;
  const talAtualizar = talhoesLista.filter(t => !t.isNovo).length;
  const totalAvisos = talhoesLista.filter(t => t.avisos.length > 0);
  const totalLinhasProblema = [...erros, ...totalAvisos.map(t => ({ linha: t.rowIdx, msg: t.avisos.join('; ') }))];

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setResultado(null);
    setRows([]);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase(),
      complete: (result) => setRows(result.data || []),
    });
  };

  const handleImportar = async () => {
    setLoading(true);
    let prodCriados = 0, prodAtualizados = 0, prodErros = 0;
    let talCriados = 0, talAtualizados = 0, talErros = 0;

    // Mapa codigo → id do produtor após criação/atualização
    const prodIdMap = new Map();

    // 1. Upsert produtores
    for (const p of prodArray) {
      const data = { codigo: p.codigo, nome: p.nome, fazenda: p.fazenda };
      if (p.municipio) data.municipio = p.municipio;
      if (p.uf) data.uf = p.uf;
      if (p.contato) data.contato = p.contato;
      try {
        if (p.isNovo) {
          const criado = await base44.entities.Produtor.create(data);
          prodIdMap.set(p.codigo.toLowerCase(), criado.id);
          prodCriados++;
        } else {
          await base44.entities.Produtor.update(p.existente.id, data);
          prodIdMap.set(p.codigo.toLowerCase(), p.existente.id);
          prodAtualizados++;
        }
      } catch {
        prodErros++;
        // Usa id existente se disponível para não bloquear talhões
        if (p.existente) prodIdMap.set(p.codigo.toLowerCase(), p.existente.id);
      }
    }

    // 2. Upsert talhões
    for (const t of talhoesLista) {
      const prodId = prodIdMap.get(t.prodCodigo);
      if (!prodId) { talErros++; continue; }

      const data = { nome: t.talhaoNome, codigo_produtor: t.row.produtor_codigo?.trim(), produtor_id: prodId };
      if (t.faseOk) data.fase_atual = t.faseOk;
      if (t.metodoOk) data.metodo_colheita = t.metodoOk;
      if (t.declOk) data.declividade = t.declOk;
      NUM_FIELDS.forEach(f => {
        const v = parseNum(t.row[f]);
        if (v !== undefined) data[f] = v;
      });
      if (t.row.cultivar?.trim()) data.cultivar = t.row.cultivar.trim();
      if (t.row.espacamento?.trim()) data.espacamento = t.row.espacamento.trim();
      if (t.row.observacoes?.trim()) data.observacoes = t.row.observacoes.trim();

      try {
        if (t.isNovo) {
          await base44.entities.Talhao.create(data);
          talCriados++;
        } else {
          await base44.entities.Talhao.update(t.existente.id, data);
          talAtualizados++;
        }
      } catch {
        talErros++;
      }
    }

    setLoading(false);
    setResultado({ prodCriados, prodAtualizados, prodErros, talCriados, talAtualizados, talErros });
    queryClient.invalidateQueries({ queryKey: ['produtores'] });
    queryClient.invalidateQueries({ queryKey: ['talhoes'] });
    if (onImportado) onImportado();
    toast({ title: `Importação concluída: ${prodCriados + prodAtualizados} produtor(es), ${talCriados + talAtualizados} talhão(ões)` });
  };

  const handleClose = () => {
    setRows([]);
    setFileName('');
    setResultado(null);
    onOpenChange(false);
  };

  const temDados = prodArray.length > 0 || talhoesLista.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5" />Importar Produtores + Talhões via CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instruções */}
          <div className="bg-muted/40 rounded-xl p-4 text-sm space-y-2">
            <p className="font-medium text-sm">Colunas esperadas no CSV (uma linha por talhão):</p>
            <div className="flex flex-wrap gap-1">
              {COLUNAS_ESPERADAS.map(c => (
                <code key={c} className="bg-card border border-border rounded px-1.5 py-0.5 text-xs">{c}</code>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Obrigatórios: <strong>produtor_codigo, produtor_nome, produtor_fazenda</strong>.
              Produtores existentes serão <strong>atualizados</strong>; talhões identificados por código+nome.
              Linhas sem <em>talhao_nome</em> criam/atualizam apenas o produtor.
            </p>
          </div>

          {/* Upload */}
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:bg-muted/30 transition-colors">
            <FileText className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{fileName || 'Clique para selecionar um arquivo CSV'}</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </label>

          {/* Preview */}
          {temDados && !resultado && (
            <div className="space-y-3">
              {/* Resumo */}
              <div className="flex flex-wrap gap-3 text-sm">
                {prodNovos > 0 && (
                  <span className="flex items-center gap-1.5 text-green-700"><CheckCircle2 className="w-4 h-4" />{prodNovos} produtor(es) novo(s)</span>
                )}
                {prodAtualizar > 0 && (
                  <span className="flex items-center gap-1.5 text-blue-600"><RefreshCw className="w-4 h-4" />{prodAtualizar} produtor(es) a atualizar</span>
                )}
                {talNovos > 0 && (
                  <span className="flex items-center gap-1.5 text-green-700"><CheckCircle2 className="w-4 h-4" />{talNovos} talhão(ões) novo(s)</span>
                )}
                {talAtualizar > 0 && (
                  <span className="flex items-center gap-1.5 text-blue-600"><RefreshCw className="w-4 h-4" />{talAtualizar} talhão(ões) a atualizar</span>
                )}
              </div>

              {/* Linhas com problema */}
              {totalLinhasProblema.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                    <AlertCircle className="w-4 h-4" /> {totalLinhasProblema.length} linha(s) com aviso/erro:
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-0.5">
                    {totalLinhasProblema.map((e, i) => (
                      <p key={i} className="text-xs text-amber-700">Linha {e.linha}: {e.msg}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabela preview */}
              <div className="border border-border rounded-lg overflow-auto max-h-52">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">Linha</th>
                      <th className="text-left px-3 py-2">Produtor</th>
                      <th className="text-left px-3 py-2">Talhão</th>
                      <th className="text-left px-3 py-2">Área (ha)</th>
                      <th className="text-left px-3 py-2">Status Prod.</th>
                      <th className="text-left px-3 py-2">Status Tal.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const codigo = (row.produtor_codigo || '').trim().toLowerCase();
                      const p = produtoresMap.get(codigo);
                      const tNome = (row.talhao_nome || '').trim();
                      const t = talhoesLista.find(x => x.rowIdx === i + 2);
                      if (!p) return null;
                      return (
                        <tr key={i} className="border-t border-border/50">
                          <td className="px-3 py-1.5 text-muted-foreground">{i + 2}</td>
                          <td className="px-3 py-1.5 font-medium">{p.nome} <span className="text-muted-foreground">({p.codigo})</span></td>
                          <td className="px-3 py-1.5">{tNome || <span className="text-muted-foreground italic">—</span>}</td>
                          <td className="px-3 py-1.5 tabular-nums">{row.area_ha || '—'}</td>
                          <td className="px-3 py-1.5">
                            {p.isNovo
                              ? <Badge variant="outline" className="text-xs text-green-700 border-green-300">Novo</Badge>
                              : <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">Atualizar</Badge>}
                          </td>
                          <td className="px-3 py-1.5">
                            {!tNome ? <span className="text-muted-foreground text-xs">—</span>
                              : t?.isNovo
                                ? <Badge variant="outline" className="text-xs text-green-700 border-green-300">Novo</Badge>
                                : <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">Atualizar</Badge>}
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
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-2">
              <p className="font-semibold text-green-800">Importação concluída!</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                {resultado.prodCriados > 0 && <p className="text-green-700">✔ {resultado.prodCriados} produtor(es) criado(s)</p>}
                {resultado.prodAtualizados > 0 && <p className="text-blue-700">↻ {resultado.prodAtualizados} produtor(es) atualizado(s)</p>}
                {resultado.prodErros > 0 && <p className="text-red-600">✗ {resultado.prodErros} erro(s) em produtores</p>}
                {resultado.talCriados > 0 && <p className="text-green-700">✔ {resultado.talCriados} talhão(ões) criado(s)</p>}
                {resultado.talAtualizados > 0 && <p className="text-blue-700">↻ {resultado.talAtualizados} talhão(ões) atualizado(s)</p>}
                {resultado.talErros > 0 && <p className="text-red-600">✗ {resultado.talErros} erro(s) em talhões</p>}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
          {!resultado && temDados && erros.length < rows.length && (
            <Button onClick={handleImportar} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importar {prodArray.length} produtor(es) · {talhoesLista.length} talhão(ões)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
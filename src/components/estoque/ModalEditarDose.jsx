import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { UNIDADES_DOSE, parseDose, fmtQtd } from '@/lib/estoqueInsumos';

// Editor de Dose/ha. Define/altera a dose usada no cálculo de hectares.
// - Vínculo a FertilizanteFormulado: permite "Salvar na Base" (padrão) ou override.
// - Vínculo a FonteSimples: apenas override (fontes não têm dose_producao).
// - Sem vínculo: override, ou "Cadastrar na Base" (repassa ao ModalCadastrarInsumo).
export default function ModalEditarDose({ row, open, onClose, onCadastrarNaBase, onConcluido }) {
  const qc = useQueryClient();
  const [valor, setValor] = useState('');
  const [unidade, setUnidade] = useState('L/ha');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open && row) {
      setErro('');
      // pré-preenche com override do estoque, senão com dose da base
      if (row.config?.dose_ha != null && row.config.unidade_dose) {
        setValor(String(row.config.dose_ha));
        setUnidade(row.config.unidade_dose);
      } else if (row.dose) {
        const v = row.dose.unit === 'l' ? row.dose.valor : row.dose.unit === 'kg' ? row.dose.valor : row.dose.valor;
        setValor(String(v));
        setUnidade(row.dose.unit === 'kg' ? 'kg/ha' : 'L/ha');
      } else {
        setValor('');
        setUnidade('L/ha');
      }
    }
  }, [open, row?.key]);

  const dosePreview = useMemo(() => parseDose(`${valor || '0'} ${unidade}`), [valor, unidade]);

  if (!row) return null;

  const haPreview = (dosePreview && row.saldo > 0 && row.unidade === dosePreview.unit)
    ? Math.round((row.saldo / dosePreview.valor) * 100) / 100 : null;

  const getParsed = () => {
    const v = parseFloat(String(valor).replace(',', '.'));
    if (isNaN(v) || v <= 0) return null;
    return v;
  };

  const upsertConfig = async (doseVal, unidadeDose) => {
    const existing = await base44.entities.ConfiguracaoEstoqueProduto.filter({
      produtor_id: row.produtor_id, produto_chave: row.produto_chave,
    });
    const payload = {
      produtor_id: row.produtor_id,
      produto_chave: row.produto_chave,
      produto_nome: row.produto_nome,
      produto_id: row.produto_id || null,
      produto_tipo: row.produto_tipo,
      dose_ha: doseVal,
      unidade_dose: unidadeDose,
    };
    if (existing && existing.length) {
      await base44.entities.ConfiguracaoEstoqueProduto.update(existing[0].id, payload);
    } else {
      await base44.entities.ConfiguracaoEstoqueProduto.create(payload);
    }
    await qc.invalidateQueries({ queryKey: ['configs_estoque'] });
  };

  const salvarSomenteEstoque = async () => {
    setErro('');
    const v = getParsed();
    if (v == null) { setErro('Informe uma dose válida.'); return; }
    setSalvando(true);
    try {
      await upsertConfig(v, unidade);
      onConcluido?.();
      onClose?.();
    } catch (e) {
      setErro('Erro ao salvar: ' + (e?.message || String(e)));
    } finally { setSalvando(false); }
  };

  const salvarNaBase = async () => {
    setErro('');
    const v = getParsed();
    if (v == null) { setErro('Informe uma dose válida.'); return; }
    setSalvando(true);
    try {
      await base44.entities.FertilizanteFormulado.update(row.produto_id, {
        dose_producao: `${v} ${unidade}`,
        unidade_aplicacao: unidade,
      });
      // remove override para a dose da Base ter prioridade
      const existing = await base44.entities.ConfiguracaoEstoqueProduto.filter({
        produtor_id: row.produtor_id, produto_chave: row.produto_chave,
      });
      if (existing && existing.length) await base44.entities.ConfiguracaoEstoqueProduto.delete(existing[0].id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['fertilizantes_formulados'] }),
        qc.invalidateQueries({ queryKey: ['configs_estoque'] }),
      ]);
      onConcluido?.();
      onClose?.();
    } catch (e) {
      setErro('Erro ao salvar na Base: ' + (e?.message || String(e)));
    } finally { setSalvando(false); }
  };

  const cadastrarNaBase = () => {
    setErro('');
    const v = getParsed();
    if (v == null) { setErro('Informe uma dose válida.'); return; }
    onCadastrarNaBase?.(row, v, unidade);
    onClose?.();
  };

  const vinculadoFert = row.vinculado && row.insumo?.tipo === 'fert';
  const vinculadoFonte = row.vinculado && row.insumo?.tipo === 'fonte';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Dose/ha</DialogTitle>
          <DialogDescription>{row.produto_nome}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-muted rounded px-2 py-1">Saldo: <strong>{fmtQtd(row.saldo)} {row.unidade}</strong></span>
            {row.vinculado
              ? <span className="text-green-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Vinculado à Base de Insumos: {row.insumo_nome}</span>
              : <span className="text-amber-700">Produto ainda não vinculado à Base de Insumos</span>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Dose/ha</label>
              <Input type="number" inputMode="decimal" step="any" min="0" value={valor}
                onChange={e => setValor(e.target.value)} className="h-9" placeholder="Ex.: 0,5" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Unidade</label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES_DOSE.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-primary/5 rounded-lg p-3 text-sm">
            Hectares possíveis: <strong className="text-primary tabular-nums">
              {haPreview != null ? `${fmtQtd(haPreview)} ha` : '—'}
            </strong>
            {haPreview == null && valor && (
              <span className="block text-xs text-muted-foreground mt-0.5">
                A unidade da dose deve ser compatível com a unidade do saldo ({row.unidade}).
              </span>
            )}
          </div>

          {vinculadoFert && (
            <p className="text-xs text-muted-foreground">
              Deseja salvar esta dosagem na Base de Insumos para utilizar como padrão nas próximas compras e nos demais módulos?
            </p>
          )}

          {erro && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{erro}</p>}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button variant="secondary" onClick={salvarSomenteEstoque} disabled={salvando}>
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Não, somente neste estoque
            </Button>
            {vinculadoFert && (
              <Button onClick={salvarNaBase} disabled={salvando}>
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Sim, salvar na Base
              </Button>
            )}
            {!row.vinculado && (
              <Button onClick={cadastrarNaBase} disabled={salvando}>Cadastrar na Base</Button>
            )}
            {vinculadoFonte && (
              <span className="text-xs text-muted-foreground self-center">Fontes simples não possuem dose padrão editável.</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const METODOS = ['Manual', 'Derriçadeira', 'Colhedora', 'Recolhedora', 'Varrição Manual', 'Varrição Mecanizada'];

function fmt(n, dec = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtDate(d) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yy', { locale: ptBR }); } catch { return '—'; }
}

function TalhaoRow({ t, planejamentoRow, onSave, saving, index }) {
  const [form, setForm] = useState({
    litros_por_pe: t.litros_por_pe ?? '',
    pct_colher: t.pct_colher ?? 1,
    seq_colheita: t.seq_colheita ?? '',
    metodo_colheita: t.metodo_colheita ?? 'Manual',
    preco_por_medida: t.preco_por_medida ?? '',
  });
  const [dirty, setDirty] = useState(false);

  // Reset form se o talhão mudar (troca de produtor)
  useEffect(() => {
    setForm({
      litros_por_pe: t.litros_por_pe ?? '',
      pct_colher: t.pct_colher ?? 1,
      seq_colheita: t.seq_colheita ?? '',
      metodo_colheita: t.metodo_colheita ?? 'Manual',
      preco_por_medida: t.preco_por_medida ?? '',
    });
    setDirty(false);
  }, [t.id]);

  const update = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setDirty(true);
  };

  const handleSave = () => {
    onSave(t.id, {
      litros_por_pe: form.litros_por_pe !== '' ? Number(form.litros_por_pe) : null,
      pct_colher: form.pct_colher !== '' && form.pct_colher != null ? Number(form.pct_colher) : 1,
      seq_colheita: form.seq_colheita !== '' ? Number(form.seq_colheita) : null,
      metodo_colheita: form.metodo_colheita,
      preco_por_medida: form.preco_por_medida !== '' ? Number(form.preco_por_medida) : null,
    });
    setDirty(false);
  };

  const pr = planejamentoRow || {};

  return (
    <TableRow className={index % 2 === 0 ? 'bg-muted/20' : ''}>
      {/* Seq */}
      <TableCell className="text-center">
        <Input
          type="number"
          min="1"
          value={form.seq_colheita}
          onChange={e => update('seq_colheita', e.target.value)}
          className="w-14 h-8 text-center text-sm px-1"
        />
      </TableCell>

      {/* Nome */}
      <TableCell className="font-medium text-sm min-w-[120px]">{t.nome}</TableCell>

      {/* Área */}
      <TableCell className="text-right text-sm text-muted-foreground">{t.area_ha ?? '—'}</TableCell>

      {/* Plantas */}
      <TableCell className="text-right text-sm">{t.num_plantas?.toLocaleString('pt-BR') ?? '—'}</TableCell>

      {/* Cultivar */}
      <TableCell className="text-sm text-muted-foreground">{t.cultivar || '—'}</TableCell>

      {/* Espaçamento */}
      <TableCell className="text-sm text-center text-muted-foreground">{t.espacamento || '—'}</TableCell>

      {/* Litros/Planta — editável */}
      <TableCell>
        <Input
          type="number"
          step="0.1"
          value={form.litros_por_pe}
          onChange={e => update('litros_por_pe', e.target.value)}
          className="w-20 h-8 text-sm text-right px-2"
          placeholder="0"
        />
      </TableCell>

      {/* % a Colher — editável */}
      <TableCell>
        <Input
          type="number"
          step="0.05"
          min="0"
          max="1"
          value={form.pct_colher}
          onChange={e => update('pct_colher', e.target.value)}
          className="w-16 h-8 text-sm text-right px-2"
        />
      </TableCell>

      {/* Método — editável */}
      <TableCell className="min-w-[140px]">
        <Select value={form.metodo_colheita} onValueChange={v => update('metodo_colheita', v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METODOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Preço — editável */}
      <TableCell>
        <Input
          type="number"
          step="0.50"
          value={form.preco_por_medida}
          onChange={e => update('preco_por_medida', e.target.value)}
          className="w-20 h-8 text-sm text-right px-2"
          placeholder="—"
        />
      </TableCell>

      {/* Calculados — somente leitura */}
      <TableCell className="text-right text-sm font-medium">{fmt(pr.litrosTotais, 0)}</TableCell>
      <TableCell className="text-right text-sm font-medium">{fmt(pr.medidasPrevistas, 1)}</TableCell>
      <TableCell className="text-right text-sm">{fmt(pr.diasNecessarios, 1)}</TableCell>
      <TableCell className="text-right text-sm text-muted-foreground">{fmtDate(pr.dataInicio)}</TableCell>
      <TableCell className="text-right text-sm text-muted-foreground">{fmtDate(pr.dataFim)}</TableCell>
      <TableCell className="text-right text-sm">{fmt(pr.sacasEstimadas, 1)}</TableCell>

      {/* Salvar */}
      <TableCell>
        <Button
          size="sm"
          variant={dirty ? 'default' : 'ghost'}
          onClick={handleSave}
          disabled={saving || !dirty}
          className="h-8 w-8 p-0"
          title="Salvar talhão"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function TalhaoTable({ talhoes, planejamento, produtor, onSaveTalhao, saving, loading }) {
  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Carregando talhões...
      </div>
    );
  }

  if (talhoes.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
        <p className="font-medium">Nenhum talhão cadastrado para este produtor.</p>
        <p className="text-sm mt-1">Cadastre talhões na aba "Talhões" com o código <span className="font-mono bg-muted px-1 rounded">{produtor?.codigo}</span>.</p>
      </div>
    );
  }

  // Mapa id → linha calculada
  const planMap = {};
  (planejamento?.talhoes || []).forEach(t => { planMap[t.id] = t; });

  // Linha de totais
  const p = planejamento || {};

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold">🌱 Detalhamento por Talhão</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Edite os campos em branco e clique em 💾 para salvar cada linha.
            A sequência de colheita define a ordem e as datas.
          </p>
        </div>
        <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
          {talhoes.length} talhões
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-center w-16">Seq.</TableHead>
              <TableHead className="min-w-[120px]">Talhão</TableHead>
              <TableHead className="text-right">Área (ha)</TableHead>
              <TableHead className="text-right">Plantas</TableHead>
              <TableHead>Cultivar</TableHead>
              <TableHead className="text-center">Espaç.</TableHead>
              {/* Editáveis */}
              <TableHead className="text-right bg-amber-50 dark:bg-amber-950/30">L/Planta</TableHead>
              <TableHead className="text-right bg-amber-50 dark:bg-amber-950/30">% Colher</TableHead>
              <TableHead className="bg-amber-50 dark:bg-amber-950/30">Método</TableHead>
              <TableHead className="text-right bg-amber-50 dark:bg-amber-950/30">Preço/Med</TableHead>
              {/* Calculados */}
              <TableHead className="text-right bg-green-50 dark:bg-green-950/30">L. Totais</TableHead>
              <TableHead className="text-right bg-green-50 dark:bg-green-950/30">Med. Prev.</TableHead>
              <TableHead className="text-right bg-green-50 dark:bg-green-950/30">Dias Nec.</TableHead>
              <TableHead className="text-right bg-green-50 dark:bg-green-950/30">Dt. Início</TableHead>
              <TableHead className="text-right bg-green-50 dark:bg-green-950/30">Dt. Fim</TableHead>
              <TableHead className="text-right bg-green-50 dark:bg-green-950/30">Sacas Est.</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {talhoes.map((t, i) => (
              <TalhaoRow
                key={t.id}
                t={t}
                planejamentoRow={planMap[t.id]}
                onSave={onSaveTalhao}
                saving={saving}
                index={i}
              />
            ))}

            {/* Linha de totais */}
            <TableRow className="bg-primary/5 font-bold border-t-2 border-primary/20">
              <TableCell colSpan={10} className="text-right text-sm pr-4">TOTAL</TableCell>
              <TableCell className="text-right text-sm">{(p.totalLitros || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
              <TableCell className="text-right text-sm">{(p.totalMedidas || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</TableCell>
              <TableCell className="text-right text-sm">{(p.totalDias || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</TableCell>
              <TableCell colSpan={2} />
              <TableCell className="text-right text-sm">{(p.totalSacas || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="px-5 py-3 border-t border-border bg-muted/30 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-950 inline-block border border-amber-300" /> Campos editáveis</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 dark:bg-green-950 inline-block border border-green-300" /> Calculados automaticamente</span>
        <span>Datas calculadas conforme sequência e dias/semana configurados</span>
      </div>
    </div>
  );
}
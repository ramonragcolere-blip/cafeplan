import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Sprout, ChevronDown, ChevronUp, Search, Save, Loader2 } from 'lucide-react';
import { FAIXAS, NUTRIENTES_KEYS, classificar, CLASS_BADGE, CLASS_LABEL } from './FoliarNutrienteUtils';
import ImportarAnaliseFoliarPDF from './ImportarAnaliseFoliarPDF';

const CAMPOS_INPUT = [
  { key: 'n_pct',  label: 'N (%)'   },
  { key: 'p_pct',  label: 'P (%)'   },
  { key: 'k_pct',  label: 'K (%)'   },
  { key: 'ca_pct', label: 'Ca (%)'  },
  { key: 'mg_pct', label: 'Mg (%)' },
  { key: 's_pct',  label: 'S (%)'   },
  { key: 'zn_ppm', label: 'Zn (ppm)' },
  { key: 'b_ppm',  label: 'B (ppm)'  },
  { key: 'cu_ppm', label: 'Cu (ppm)' },
  { key: 'mn_ppm', label: 'Mn (ppm)' },
  { key: 'fe_ppm', label: 'Fe (ppm)' },
];

function NutrienteBadge({ keyN, valor }) {
  const cls = classificar(keyN, valor);
  if (cls === null || valor == null || valor === '') return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${CLASS_BADGE[cls]}`}>
      {FAIXAS[keyN].label}: {Number(valor).toFixed(keyN.endsWith('ppm') ? 0 : 3)} {FAIXAS[keyN].unidade} — {CLASS_LABEL[cls]}
    </span>
  );
}

function TalhaoRow({ talhao, analise, safra, analises, talhoes, onSave, saving, onImportado }) {
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(analise ? { ...analise } : {});

  React.useEffect(() => {
    setForm(analise ? { ...analise } : {});
  }, [analise]);

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = () => onSave(form);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setAberto(a => !a)}>
        <div className="flex items-center gap-3">
          <Sprout className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold">{talhao.nome}</span>
          {talhao.area_ha && <span className="text-sm text-muted-foreground">{talhao.area_ha} ha</span>}
          {analise && <Badge variant="secondary" className="text-xs">Com análise</Badge>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {aberto ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {aberto && (
        <div className="border-t border-border p-4 space-y-5">
          {/* Botão importar PDF */}
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-muted-foreground">Dados da análise foliar</p>
            <ImportarAnaliseFoliarPDF
              talhoes={talhoes}
              safra={safra}
              analises={analises}
              onImportado={onImportado}
            />
          </div>

          {/* Formulário de entrada */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CAMPOS_INPUT.map(c => (
              <div key={c.key}>
                <Label className="text-xs mb-0.5 block text-muted-foreground">{c.label}</Label>
                <Input type="number" step="0.001"
                  value={form[c.key] ?? ''}
                  onChange={e => handleChange(c.key, e.target.value)}
                  className="h-8 text-sm" />
              </div>
            ))}
            <div>
              <Label className="text-xs mb-0.5 block text-muted-foreground">Data análise</Label>
              <Input type="date" value={form.data_analise ?? ''}
                onChange={e => handleChange('data_analise', e.target.value)}
                className="h-8 text-sm" />
            </div>
          </div>

          {/* Classificações */}
          {analise && (
            <div className="bg-muted/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Classificação dos nutrientes</p>
              <div className="flex flex-wrap gap-2">
                {NUTRIENTES_KEYS.map(k => (
                  <NutrienteBadge key={k} keyN={k} valor={analise[k]} />
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-border/40">
            <button type="button" onClick={() => setAberto(false)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted/40">
              <ChevronUp className="w-4 h-4" /> Recolher talhão
            </button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar análise
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AbaAnaliseFoliar({ produtor, safra, talhoes, analises, onSave, onImportado, saving }) {
  const [filtro, setFiltro] = useState('');
  const talhoesProdutor = talhoes.filter(t => t.codigo_produtor === produtor?.codigo);
  const talhoesFiltrados = filtro
    ? talhoesProdutor.filter(t => t.nome.toLowerCase().includes(filtro.toLowerCase()))
    : talhoesProdutor;

  return (
    <div className="space-y-4">
      {talhoesProdutor.length > 1 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Filtrar talhão..." value={filtro} onChange={e => setFiltro(e.target.value)} className="pl-10" />
        </div>
      )}
      {talhoesFiltrados.length === 0 && (
        <div className="text-center text-muted-foreground py-10 bg-card rounded-2xl border border-border">
          <p>Nenhum talhão encontrado.</p>
        </div>
      )}
      {talhoesFiltrados.map(talhao => {
        const analise = analises.find(a => a.talhao_id === talhao.id && a.safra === safra) || null;
        return (
          <TalhaoRow
            key={talhao.id}
            talhao={talhao}
            analise={analise}
            safra={safra}
            analises={analises}
            talhoes={talhoesProdutor}
            onSave={(data) => onSave(talhao, data)}
            saving={saving}
            onImportado={onImportado}
          />
        );
      })}
    </div>
  );
}
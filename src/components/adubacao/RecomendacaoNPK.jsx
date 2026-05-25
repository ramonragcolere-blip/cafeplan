import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Calculator } from 'lucide-react';
import { calcN, classificarP, classificarK, calcB, getDosesBase, classificarZn, classificarCu, classificarMn, calcCalagem } from '@/lib/tabelasNutricionais';

function Badge({ label, classe }) {
  const cores = {
    'Baixo': 'bg-red-100 text-red-700',
    'Médio': 'bg-yellow-100 text-yellow-700',
    'Bom': 'bg-green-100 text-green-700',
    'Bom+': 'bg-green-100 text-green-700',
    'Ótimo': 'bg-blue-100 text-blue-700',
    'Alto': 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cores[classe] || 'bg-muted'}`}>
      {label || classe}
    </span>
  );
}

function ResultRow({ label, value, unit, sub }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="font-semibold text-sm">{value != null ? `${value} ${unit || ''}` : '—'}</span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export default function RecomendacaoNPK({ analise, talhao, dados, onSave, saving }) {
  const [safraAnterior, setSafraAnterior] = useState('');
  const [safraEstimada, setSafraEstimada] = useState('');

  useEffect(() => {
    setSafraAnterior(dados?.safra_anterior_sc_ha || '');
    setSafraEstimada(dados?.safra_estimada_sc_ha || '');
  }, [dados?.id]);

  const p   = analise?.fosforo;
  const k   = analise?.potassio;
  const b   = analise?.boro;
  const zn  = analise?.zinco;
  const cu  = analise?.cobre;
  const mn  = analise?.manganes;

  const classZn   = zn != null ? classificarZn(zn) : null;
  const classCu   = cu != null ? classificarCu(cu) : null;
  const classMn   = mn != null ? classificarMn(mn) : null;
  const calagem   = calcCalagem(analise?.ph, analise?.saturacao_bases, analise?.ctc);
  const mediaBienal = safraAnterior && safraEstimada
    ? (Number(safraAnterior) + Number(safraEstimada)) / 2
    : null;

  const nCalc = calcN(safraAnterior, safraEstimada);
  const dosesBase = getDosesBase(mediaBienal);
  const classP = p != null ? classificarP(p) : null;
  const classK = k != null ? classificarK(k) : null;
  const calcBoro = b != null ? calcB(b) : null;

  const doseP = classP && dosesBase.P != null
    ? classP.dispensar ? 0 : Math.round(dosesBase.P * classP.fator)
    : null;
  const doseK = classK && dosesBase.K != null
    ? classK.dispensar ? 0 : Math.round(dosesBase.K * classK.fator)
    : null;

  // Dose total/planta/metro
  const area = talhao?.area_ha || 0;
  const plantas = talhao?.num_plantas || 0;
  const metros = talhao?.metros_lineares || (plantas > 0 && talhao?.espacamento
    ? plantas * (parseFloat(talhao.espacamento?.split(/[xX×]/)?.[0]?.replace(',', '.')) || 0) : 0);

  const calcTotais = (doseHa) => {
    if (!doseHa || !area) return {};
    const total = Math.round(doseHa * area);
    const gPe = plantas > 0 ? ((doseHa * area * 1000) / plantas).toFixed(1) : null;
    const gMt = metros > 0 ? ((doseHa * area * 1000) / metros).toFixed(1) : null;
    return { total, gPe, gMt };
  };

  const totN = calcTotais(nCalc?.dose);
  const totP = calcTotais(doseP);
  const totK = calcTotais(doseK);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-orange-50 border-b border-border">
        <Calculator className="w-4 h-4 text-orange-700" />
        <span className="font-semibold text-sm text-orange-800">Recomendação Nutricional (N-P-K-B)</span>
      </div>
      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Produtividade para cálculo N */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produtividade (para cálculo N)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Safra Anterior (sc/ha)</Label>
              <Input type="number" value={safraAnterior} onChange={e => setSafraAnterior(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Safra Estimada (sc/ha)</Label>
              <Input type="number" value={safraEstimada} onChange={e => setSafraEstimada(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          {mediaBienal != null && (
            <p className="text-xs text-muted-foreground">
              Média bienal: <strong>{mediaBienal.toFixed(1)} sc/ha</strong>
              {nCalc && <> — Pontos N/sc: <strong>{nCalc.pontos}</strong></>}
            </p>
          )}
        </div>

        {/* Resultados */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-0.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Doses Calculadas (kg/ha)</p>

          {/* N */}
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-sm font-medium">N</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{nCalc?.dose != null ? `${nCalc.dose} kg/ha` : '—'}</span>
              {nCalc && <span className="text-xs text-muted-foreground">(total: {totN.total || '—'} kg)</span>}
            </div>
          </div>

          {/* P */}
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">P₂O₅</span>
              {classP && <Badge classe={classP.classe} />}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">
                {doseP != null ? (classP?.dispensar ? 'Dispensar' : `${doseP} kg/ha`) : '—'}
              </span>
              {doseP > 0 && <span className="text-xs text-muted-foreground">(total: {totP.total || '—'} kg)</span>}
            </div>
          </div>

          {/* K */}
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">K₂O</span>
              {classK && <Badge classe={classK.classe} />}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">
                {doseK != null ? (classK?.dispensar ? 'Dispensar' : `${doseK} kg/ha`) : '—'}
              </span>
              {doseK > 0 && <span className="text-xs text-muted-foreground">(total: {totK.total || '—'} kg)</span>}
            </div>
          </div>

          {/* B */}
          <div className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">B (Boro)</span>
              {calcBoro && <Badge classe={calcBoro.classe} />}
            </div>
            <span className="font-bold text-sm">
              {calcBoro
                ? calcBoro.dispensar ? 'Dispensar'
                : calcBoro.observacao ? calcBoro.observacao
                : `${calcBoro.dose} kg/ha`
                : '—'}
            </span>
          </div>
        </div>

        {/* g/planta e g/metro */}
        {(totN.gPe || totP.gPe || totK.gPe) && (
          <div className="lg:col-span-2 bg-green-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por unidade (dose total do talhão)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {[
                { label: 'N — g/planta', v: totN.gPe }, { label: 'N — g/metro', v: totN.gMt },
                { label: 'P — g/planta', v: totP.gPe }, { label: 'K — g/planta', v: totK.gPe },
              ].map(x => x.v && (
                <div key={x.label} className="bg-white rounded-lg p-2 text-center border border-border/50">
                  <p className="text-xs text-muted-foreground">{x.label}</p>
                  <p className="font-bold">{x.v} g</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Micronutrientes: Zn, Cu, Mn */}
        {(classZn || classCu || classMn) && (
          <div className="lg:col-span-2 bg-muted/20 rounded-xl p-4 border border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Micronutrientes (mg/dm³)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Zn', nome: 'Zinco', valor: zn, result: classZn },
                { label: 'Cu', nome: 'Cobre', valor: cu, result: classCu },
                { label: 'Mn', nome: 'Manganês', valor: mn, result: classMn },
              ].filter(x => x.result).map(({ label, nome, valor, result }) => {
                const acaoCor = result.acao === 'Aplicar'
                  ? 'bg-red-100 text-red-700'
                  : result.acao === 'Avaliar'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-green-100 text-green-700';
                return (
                  <div key={label} className="bg-white rounded-lg p-3 border border-border/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{label} <span className="font-normal text-muted-foreground">({nome})</span></span>
                      <Badge classe={result.classe} />
                    </div>
                    <p className="text-xs text-muted-foreground">{valor} mg/dm³</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${acaoCor}`}>
                      {result.acao}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Calagem */}
        {(calagem.classe || calagem.observacao) && (
          <div className={`lg:col-span-2 rounded-xl p-4 border ${calagem.necessidade ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Calagem</p>
            <div className="flex flex-wrap items-center gap-3">
              {calagem.classe && (
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${calagem.necessidade ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {calagem.classe}
                </span>
              )}
              {analise?.ph != null && (
                <span className="text-xs text-muted-foreground">pH: <strong>{analise.ph}</strong></span>
              )}
              {calagem.vAtual != null && (
                <span className="text-xs text-muted-foreground">V%: <strong>{calagem.vAtual}%</strong> → meta: 60%</span>
              )}
              {calagem.nc != null && (
                <span className="text-sm font-bold text-amber-800">NC = {calagem.nc} t/ha</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{calagem.observacao}</p>
          </div>
        )}
      </div>
      <div className="px-5 pb-4 flex justify-end">
        <Button size="sm" onClick={() => onSave({ safra_anterior_sc_ha: Number(safraAnterior) || undefined, safra_estimada_sc_ha: Number(safraEstimada) || undefined })} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Produtividade
        </Button>
      </div>
    </div>
  );
}
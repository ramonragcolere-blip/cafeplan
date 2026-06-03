import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Calculator, AlertTriangle } from 'lucide-react';
import { calcN, classificarP, calcB, getDosesBase, classificarZn, classificarCu, classificarMn, calcKSomaCamadas, alertas2040, META_K } from '@/lib/tabelasNutricionais';
import CalcCalagem from '@/components/adubacao/CalcCalagem';

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

export default function RecomendacaoNPK({ analise, analise2040, talhao, dados, onSave, saving, onEnviarPlanejamento }) {
  const [safraAnterior, setSafraAnterior] = useState('');
  const [safraEstimada, setSafraEstimada] = useState('');
  const [metaK, setMetaK] = useState('bom');

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
  const mediaBienal = safraAnterior && safraEstimada
    ? (Number(safraAnterior) + Number(safraEstimada)) / 2
    : null;

  const nCalc     = calcN(safraAnterior, safraEstimada);
  const dosesBase = getDosesBase(mediaBienal);
  const classP    = p != null ? classificarP(p) : null;
  const calcBoro  = b != null ? calcB(b) : null;

  const doseP = classP && dosesBase.P != null
    ? classP.dispensar ? 0 : Math.round(dosesBase.P * classP.fator)
    : null;

  // K — lógica com soma de camadas
  // analise.potassio e analise2040.potassio estão em mmolc/dm³
  // calcKSomaCamadas converte internamente para mg/dm³ antes de classificar
  const kDecisao = k != null
    ? calcKSomaCamadas(k, analise2040?.potassio, mediaBienal, metaK)
    : null;

  const doseKBase = kDecisao?.classK && dosesBase.K != null
    ? kDecisao.classK.dispensar ? 0 : Math.round(dosesBase.K * kDecisao.classK.fator)
    : null;
  // Se dispensado pela soma, doseK = 0
  const doseK = kDecisao?.dispensar ? 0 : doseKBase;

  // Alertas 20-40 cm
  const alertasSub = alertas2040(analise2040);

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
        <span className="font-semibold text-sm text-orange-800">Recomendação Nutricional (N-P-K)</span>
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

          {/* K — com lógica de soma de camadas */}
          <div className="flex items-start justify-between py-1.5 border-b border-border/40 gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">K₂O</span>
                {kDecisao?.classK && <Badge classe={kDecisao.classK.classe} />}
              </div>
              {/* Sub-info soma de camadas */}
              {analise2040?.potassio != null && k != null && (
                <span className="text-xs text-muted-foreground">
                  Soma: {(k * 39.1).toFixed(0)} + {(analise2040.potassio * 39.1).toFixed(0)} = <strong>{kDecisao?.kTotal?.toFixed(0)} mg/dm³</strong>
                  {' '}(meta {metaK}: {META_K[metaK]} mg/dm³)
                </span>
              )}
              {kDecisao?.dispensar && analise2040?.potassio != null && (
                <span className="text-xs text-green-700 font-medium">K dispensado — soma das camadas atinge a meta</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold text-sm">
                {doseK != null ? (kDecisao?.dispensar ? 'Dispensar' : `${doseK} kg/ha`) : '—'}
              </span>
              {doseK > 0 && <span className="text-xs text-muted-foreground">(total: {totK.total || '—'} kg)</span>}
            </div>
          </div>

          {/* Seletor de meta K */}
          {k != null && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Meta K:</span>
              {[
                { v: 'minimo', l: 'Mínimo (60 mg/dm³)' },
                { v: 'bom', l: 'Bom (120 mg/dm³)' },
                { v: 'excelente', l: 'Excelente (150 mg/dm³)' },
              ].map(m => (
                <button key={m.v} type="button" onClick={() => setMetaK(m.v)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${metaK === m.v ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:bg-muted/40'}`}>
                  {m.l}
                </button>
              ))}
            </div>
          )}
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

        {/* Micronutrientes: B, Zn, Cu, Mn */}
        {(calcBoro || classZn || classCu || classMn) && (
          <div className="lg:col-span-2 bg-muted/20 rounded-xl p-4 border border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Micronutrientes</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Boro */}
              {calcBoro && (
                <div className="bg-white rounded-lg p-3 border border-border/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">B <span className="font-normal text-muted-foreground">(Boro)</span></span>
                    <Badge classe={calcBoro.classe} />
                  </div>
                  <p className="text-xs text-muted-foreground">{b} mg/dm³</p>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                    calcBoro.dispensar ? 'bg-green-100 text-green-700'
                    : calcBoro.observacao ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                  }`}>
                    {calcBoro.dispensar ? 'Dispensar' : calcBoro.observacao ? 'Avaliar' : `Aplicar ${calcBoro.dose} kg/ha`}
                  </span>
                </div>
              )}
              {/* Zn, Cu, Mn */}
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

        {/* Alertas camada 20-40 cm */}
        {alertasSub.length > 0 && (
          <div className="lg:col-span-2 rounded-xl p-4 border border-blue-200 bg-blue-50 space-y-2">
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Alertas — Camada 20–40 cm (informativos)
            </p>
            <div className="space-y-1.5">
              {alertasSub.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-blue-900">
                  <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{a.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}


      </div>
      <div className="px-5 pb-4 flex justify-end">
        <Button size="sm" onClick={() => onSave({ safra_anterior_sc_ha: Number(safraAnterior) || undefined, safra_estimada_sc_ha: Number(safraEstimada) || undefined })} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Produtividade
        </Button>
      </div>
      <CalcCalagem analise={analise} talhao={talhao} safraCtx={analise?.safra} onEnviarPlanejamento={onEnviarPlanejamento} />
    </div>
  );
}
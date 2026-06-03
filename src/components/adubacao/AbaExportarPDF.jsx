import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMetros(talhao) {
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  if (talhao?.num_plantas && linhaM > 0) return talhao.num_plantas * linhaM;
  if (talhao?.area_ha && linhaM > 0) return Math.round((talhao.area_ha * 10000) / linhaM);
  return 0;
}

// Formata total: ≥1000 kg → toneladas, <1000 kg → quilos
function fmtTotal(kg) {
  if (kg == null) return '—';
  if (kg >= 1000) return `${(kg / 1000).toFixed(2).replace('.', ',')} t`;
  return `${Math.round(kg)} kg`;
}

function fmtNum(n, dec = 1) {
  if (n == null) return '—';
  return Number(n).toFixed(dec).replace('.', ',');
}

// Normaliza key do nutriente base (remove sufixo __1, __2, etc.)
function baseKey(nutrienteKey) {
  return nutrienteKey?.split('__')[0] || nutrienteKey;
}

const NUTRIENTE_LABELS = {
  n_pct: 'N', p2o5_pct: 'P₂O₅', k2o_pct: 'K₂O', b_pct: 'B',
  ca_pct: 'Ca', mg_pct: 'Mg', s_pct: 'S', zn_pct: 'Zn',
  mn_pct: 'Mn', cu_pct: 'Cu', fe_pct: 'Fe', calagem: 'Calagem',
};

function getNutrienteLabel(key) {
  return NUTRIENTE_LABELS[baseKey(key)] || key;
}

// Constrói blocos por talhão a partir dos registros de planejamento
function buildBlocosTalhao(talhao, planejamentos, todosProdutos) {
  const plansTalhao = planejamentos.filter(p => p.talhao_id === talhao.id);
  const area = talhao.area_ha || 0;
  const numPlantas = talhao.num_plantas || 0;
  const metros = getMetros(talhao);

  const blocos = [];

  for (const plan of plansTalhao) {
    // Ignorar registros sem produto ou com "nenhum produto"
    if (!plan.produto_id) continue;
    const nome = (plan.produto_nome || '').trim().toLowerCase();
    if (nome === 'nenhum produto' || nome === '') continue;

    const produto = todosProdutos.find(p => p.id === plan.produto_id) || null;
    const isCalagem = baseKey(plan.nutriente_key) === 'calagem';
    const nutriLabel = getNutrienteLabel(plan.nutriente_key);

    // Calcular dose do produto em kg/ha
    let doseProdHa = 0;
    if (isCalagem) {
      doseProdHa = parseFloat(plan.dose_rec_manual) || 0;
    } else {
      const doseNutriHa = parseFloat(plan.dose_rec_manual) || 0;
      if (doseNutriHa <= 0) continue; // pula se sem dose
      const pctNutri = produto ? (parseFloat(produto[baseKey(plan.nutriente_key)]) || 0) : 0;
      if (pctNutri > 0) {
        doseProdHa = Math.round((doseNutriHa / (pctNutri / 100)) * 10) / 10;
      } else {
        // produto sem % do nutriente — usa dose manual como dose do produto
        doseProdHa = doseNutriHa;
      }
    }

    if (doseProdHa <= 0) continue;

    const totalKg = area > 0 ? Math.round(doseProdHa * area) : null;
    const gPlanta = numPlantas > 0 && totalKg != null ? ((totalKg * 1000) / numPlantas).toFixed(0) : null;
    const gMetro  = metros > 0 && totalKg != null ? ((totalKg * 1000) / metros).toFixed(0) : null;
    const sc50    = totalKg != null ? (totalKg / 50).toFixed(1) : null;

    // Parcelamento
    const numAplic = plan.num_aplic || 1;
    const pcts = plan.pcts?.length ? plan.pcts : [100];
    const mesesArr = plan.meses || [];

    const parcelas = Array.from({ length: numAplic }, (_, i) => {
      const pct = parseFloat(pcts[i]) || Math.round(100 / numAplic);
      const kgAplic = totalKg != null ? Math.round(totalKg * (pct / 100)) : null;
      const mesesItem = mesesArr[i];
      const mesesStr = Array.isArray(mesesItem) ? mesesItem.join(', ') : (mesesItem ? String(mesesItem) : '');
      return { pct, kg: kgAplic, meses: mesesStr };
    });

    blocos.push({
      isCalagem,
      nutriLabel,
      produtoNome: plan.produto_nome || produto?.nome || '—',
      doseProdHa,
      totalKg,
      sc50,
      gPlanta,
      gMetro,
      numAplic,
      parcelas,
      observacoes: plan.observacoes || '',
    });
  }

  // Ordenar: calagem primeiro, depois NPK por ordem
  blocos.sort((a, b) => {
    if (a.isCalagem && !b.isCalagem) return -1;
    if (!a.isCalagem && b.isCalagem) return 1;
    return 0;
  });

  return blocos;
}

// ── Geração do PDF ────────────────────────────────────────────────────────────

function gerarPDF(produtor, safra, talhoesComBlocos) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297;
  const ML = 16, MR = 16;
  const CW = PW - ML - MR;
  const hoje = new Date().toLocaleDateString('pt-BR');

  let y = 0;
  let pagina = 1;

  // Paleta de alto contraste
  const BLACK    = [10, 10, 10];
  const DARK     = [30, 30, 30];
  const MED_DARK = [60, 60, 60];
  const MED      = [100, 100, 100];
  const LINE     = [200, 200, 200];  // linhas cinza
  const WHITE    = [255, 255, 255];
  const HDR_BG   = [26, 58, 42];    // #1a3a2a
  const TAL_BG   = [26, 58, 42];    // mesmo verde escuro para talhão
  const BADGE_BG = [26, 58, 42];

  const sf = (style, size, color = DARK) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  function rodape() {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(ML, PH - 12, PW - MR, PH - 12);
    sf('normal', 8, MED);
    doc.text(
      `Página ${pagina}   |   ${produtor.nome}   |   Safra ${safra}`,
      PW / 2, PH - 6, { align: 'center' }
    );
  }

  function novaPage() {
    doc.addPage();
    pagina++;
    y = 16;
    rodape();
  }

  function checkY(h) {
    if (y + h > PH - 18) novaPage();
  }

  function hLine(yPos, color = LINE, lw = 0.3) {
    doc.setDrawColor(...color);
    doc.setLineWidth(lw);
    doc.line(ML, yPos, PW - MR, yPos);
  }

  // ── CABEÇALHO ────────────────────────────────────────────────────────────────
  doc.setFillColor(...HDR_BG);
  doc.rect(0, 0, PW, 42, 'F');

  sf('bold', 18, WHITE);
  doc.text('Planejamento de Adubação', ML, 15);
  sf('bold', 13, WHITE);
  doc.text('do Cafeeiro', ML, 24);

  sf('bold', 10, [200, 230, 210]);
  doc.text(`${produtor.nome}   ·   Fazenda ${produtor.fazenda || '—'}   ·   Safra ${safra}`, ML, 33);

  const infoExtra = [
    produtor.municipio ? `${produtor.municipio}${produtor.uf ? '/' + produtor.uf : ''}` : null,
    produtor.eng_responsavel ? `Eng.: ${produtor.eng_responsavel}` : null,
    `Emissão: ${hoje}`,
  ].filter(Boolean).join('     ');
  sf('normal', 9, [160, 210, 175]);
  doc.text(infoExtra, ML, 39);

  y = 50;
  rodape();

  // ── POR TALHÃO ────────────────────────────────────────────────────────────────
  for (const { talhao, blocos } of talhoesComBlocos) {
    if (blocos.length === 0) continue;

    checkY(22);

    // Cabeçalho talhão — fundo verde escuro igual ao header
    doc.setFillColor(...TAL_BG);
    doc.rect(ML, y, CW, 13, 'F');

    sf('bold', 13, WHITE);
    doc.text(talhao.nome, ML + 5, y + 9);

    const infos = [
      talhao.area_ha ? `${talhao.area_ha} ha` : null,
      talhao.num_plantas ? `${talhao.num_plantas.toLocaleString()} plantas` : null,
      getMetros(talhao) > 0 ? `${getMetros(talhao).toLocaleString()} m lin.` : null,
      talhao.espacamento ? `Espaç. ${talhao.espacamento}` : null,
    ].filter(Boolean).join('   ');
    sf('normal', 9, [200, 230, 210]);
    doc.text(infos, PW - MR - 4, y + 9, { align: 'right' });

    y += 16;

    // ── Blocos de produtos ──────────────────────────────────────────────────────
    for (let bi = 0; bi < blocos.length; bi++) {
      const bloco = blocos[bi];
      const { isCalagem, nutriLabel, produtoNome, doseProdHa, totalKg, sc50, gPlanta, gMetro, numAplic, parcelas, observacoes } = bloco;

      // Altura do bloco: cabeçalho produto (16) + linha dados (10) + parcelamento + obs
      const altParc = numAplic > 1 ? 6 + numAplic * 9 : 0;
      const altObs  = observacoes ? 7 : 0;
      const altBloco = 16 + 10 + altParc + altObs + 4;
      checkY(altBloco);

      // Separador entre blocos (não antes do primeiro)
      if (bi > 0) {
        hLine(y, LINE, 0.3);
        y += 2;
      }

      // ── Linha 1: badge nutriente + nome produto ──
      doc.setFillColor(...BADGE_BG);
      doc.rect(ML, y, 20, 8, 'F');
      sf('bold', 8.5, WHITE);
      doc.text(nutriLabel, ML + 10, y + 5.5, { align: 'center' });

      sf('bold', 12, BLACK);
      doc.text(produtoNome.substring(0, 58), ML + 24, y + 6);

      y += 11;

      // ── Linha 2: dados principais ──
      const cols = [
        { l: 'Dose',        v: `${fmtNum(doseProdHa, 1)} kg/ha` },
        { l: 'Total',       v: fmtTotal(totalKg) },
        sc50    ? { l: 'Sacos 50 kg', v: `${sc50} sc` }   : null,
        gPlanta ? { l: 'g / pé',      v: `${gPlanta} g` } : null,
        gMetro  ? { l: 'g / metro',   v: `${gMetro} g` }  : null,
      ].filter(Boolean);

      // Calcular largura de cada coluna e distribuir
      const colWidths = cols.map(c => {
        doc.setFontSize(11);
        const wv = doc.getTextWidth(c.v);
        doc.setFontSize(8);
        const wl = doc.getTextWidth(c.l);
        return Math.max(wv, wl) + 10;
      });

      let cx = ML + 2;
      cols.forEach((col, ci) => {
        const cw = colWidths[ci];
        // Label cinza pequeno
        sf('normal', 8, MED);
        doc.text(col.l, cx + cw / 2, y, { align: 'center' });
        // Valor preto negrito grande
        sf('bold', 11, BLACK);
        doc.text(col.v, cx + cw / 2, y + 6, { align: 'center' });
        // Separador vertical entre colunas
        if (ci < cols.length - 1) {
          doc.setDrawColor(...LINE);
          doc.setLineWidth(0.3);
          doc.line(cx + cw, y - 3, cx + cw, y + 7);
        }
        cx += cw;
      });

      y += 10;

      // ── Parcelamento ──
      if (numAplic > 1) {
        hLine(y, LINE, 0.3);
        y += 5;

        sf('bold', 9, MED_DARK);
        doc.text('Parcelamento:', ML + 2, y);
        y += 5;

        parcelas.forEach((parc, pi) => {
          sf('bold', 10, BLACK);
          doc.text(`${pi + 1}ª aplicação — ${parc.pct}%`, ML + 4, y);
          sf('normal', 10, DARK);
          const det = [
            parc.kg != null ? fmtTotal(parc.kg) : null,
            parc.meses ? `Meses: ${parc.meses}` : null,
          ].filter(Boolean).join('     ');
          if (det) doc.text(det, ML + 60, y);
          y += 7;
        });
      }

      // ── Observações ──
      if (observacoes) {
        sf('italic', 8.5, MED_DARK);
        doc.text(`Obs: ${observacoes.substring(0, 100)}`, ML + 2, y + 2);
        y += 6;
      }

      y += 5;
    }

    // Linha final separando talhões
    hLine(y, [160, 160, 160], 0.5);
    y += 8;
  }

  doc.save(`Adubacao_${produtor.codigo}_Safra${safra.replace('/', '-')}.pdf`);
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function AbaExportarPDF({ produtor, safra, talhoes }) {
  const [gerando, setGerando] = useState(false);
  const codigoProdutor = produtor?.codigo;

  const { data: planejamentos = [], isLoading } = useQuery({
    queryKey: ['base_planejamento_pdf', codigoProdutor, safra],
    queryFn: () => codigoProdutor && safra
      ? base44.entities.BasePlanejamentoAdubacao.filter({ codigo_produtor: codigoProdutor, safra })
      : Promise.resolve([]),
    enabled: !!(codigoProdutor && safra),
  });

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples  = [] } = useQuery({ queryKey: ['fontes_simples'], queryFn: () => base44.entities.FonteSimples.list() });

  const todosProdutos = useMemo(() => [
    ...fertilizantes,
    ...fontesSimples,
  ], [fertilizantes, fontesSimples]);

  const talhoesProdutor = useMemo(() =>
    talhoes.filter(t => t.codigo_produtor === codigoProdutor),
    [talhoes, codigoProdutor]);

  const talhoesComBlocos = useMemo(() =>
    talhoesProdutor.map(t => ({
      talhao: t,
      blocos: buildBlocosTalhao(t, planejamentos, todosProdutos),
    })),
    [talhoesProdutor, planejamentos, todosProdutos]);

  const totalBlocos = useMemo(() =>
    talhoesComBlocos.reduce((s, t) => s + t.blocos.length, 0),
    [talhoesComBlocos]);

  const handleGerar = async () => {
    if (!produtor || !safra) return;
    setGerando(true);
    try {
      gerarPDF(produtor, safra, talhoesComBlocos);
    } finally {
      setGerando(false);
    }
  };

  if (!produtor || !safra) return (
    <div className="text-center py-16 text-muted-foreground">
      <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-lg font-medium">Selecione produtor e safra para exportar.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileDown className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base">Exportar Planejamento de Adubação</h3>
            <p className="text-xs text-muted-foreground">PDF com todos os talhões — calagem, fertilizantes, doses e parcelamento</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Produtor',  value: produtor.nome },
            { label: 'Fazenda',   value: produtor.fazenda || '—' },
            { label: 'Safra',     value: safra },
            { label: 'Talhões',   value: `${talhoesProdutor.length}` },
          ].map(c => (
            <div key={c.label} className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="font-semibold text-sm truncate">{c.value}</p>
            </div>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando planejamentos...
          </p>
        ) : (
          <div className="rounded-xl border p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Conteúdo a exportar</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {talhoesComBlocos.map(({ talhao, blocos }) => (
                <div key={talhao.id} className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${blocos.length > 0 ? 'bg-green-50 border-green-200' : 'bg-muted/30 border-border'}`}>
                  {blocos.length > 0
                    ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  }
                  <span className="font-medium truncate">{talhao.nome}</span>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">
                    {blocos.length > 0 ? `${blocos.length} produto(s)` : 'sem planejamento'}
                  </span>
                </div>
              ))}
            </div>
            {totalBlocos === 0 && (
              <p className="text-amber-700 text-sm font-medium flex items-center gap-2 pt-1">
                <AlertTriangle className="w-4 h-4" />
                Nenhum produto com dose encontrado. Salve o planejamento antes de exportar.
              </p>
            )}
          </div>
        )}

        <Button
          onClick={handleGerar}
          disabled={gerando || isLoading || totalBlocos === 0}
          className="gap-2 h-11 text-base"
          size="lg"
        >
          {gerando ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
          {gerando ? 'Gerando PDF...' : 'Gerar PDF — Todos os Talhões'}
        </Button>
      </div>
    </div>
  );
}
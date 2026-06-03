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
  const ML = 14, MR = 14;
  const CW = PW - ML - MR;
  const hoje = new Date().toLocaleDateString('pt-BR');

  let y = 0;
  let pagina = 1;

  // Cores
  const DARK   = [30, 30, 30];
  const MED    = [80, 80, 80];
  const LIGHT  = [150, 150, 150];
  const BG_HDR = [28, 76, 38];    // verde escuro cabeçalho
  const BG_TAL = [245, 248, 245]; // fundo cabeçalho talhão
  const BG_CAL = [240, 248, 232]; // fundo bloco calagem
  const BDR_CAL = [100, 150, 60];
  const BG_FRT = [255, 255, 255]; // fundo bloco fertilizante
  const LINE   = [210, 215, 210]; // linhas divisórias
  const ACCENT = [46, 100, 58];   // verde médio

  const setFont = (style, size, color = DARK) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  function rodape() {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(ML, PH - 11, PW - MR, PH - 11);
    setFont('normal', 7, LIGHT);
    doc.text(
      `Pág. ${pagina}  ·  ${produtor.nome} — Safra ${safra}  ·  Emitido em ${hoje}`,
      PW / 2, PH - 7, { align: 'center' }
    );
  }

  function novaPage() {
    doc.addPage();
    pagina++;
    y = 15;
    rodape();
  }

  function checkY(h) {
    if (y + h > PH - 16) novaPage();
  }

  // ── CABEÇALHO ────────────────────────────────────────────────────────────────
  doc.setFillColor(...BG_HDR);
  doc.rect(0, 0, PW, 36, 'F');

  setFont('bold', 16, [255, 255, 255]);
  doc.text('Planejamento de Adubação do Cafeeiro', ML, 14);

  setFont('normal', 9, [180, 220, 185]);
  doc.text(`${produtor.nome}  ·  Fazenda ${produtor.fazenda || '—'}  ·  Safra ${safra}`, ML, 22);

  const infoLinha2 = [
    produtor.municipio ? `${produtor.municipio}${produtor.uf ? '/' + produtor.uf : ''}` : null,
    produtor.eng_responsavel ? `Eng.: ${produtor.eng_responsavel}` : null,
    `Emissão: ${hoje}`,
  ].filter(Boolean).join('   ·   ');
  setFont('normal', 8, [140, 200, 150]);
  doc.text(infoLinha2, ML, 29);

  y = 44;
  rodape();

  // ── POR TALHÃO ────────────────────────────────────────────────────────────────
  for (const { talhao, blocos } of talhoesComBlocos) {
    if (blocos.length === 0) continue;

    checkY(24);

    // Cabeçalho talhão
    doc.setFillColor(...BG_TAL);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.rect(ML, y, CW, 11, 'FD');

    // Barra lateral colorida
    doc.setFillColor(...ACCENT);
    doc.rect(ML, y, 3, 11, 'F');

    setFont('bold', 11, ACCENT);
    doc.text(talhao.nome, ML + 6, y + 7.5);

    // Infos à direita
    const infos = [
      talhao.area_ha ? `${talhao.area_ha} ha` : null,
      talhao.num_plantas ? `${talhao.num_plantas.toLocaleString()} plantas` : null,
      getMetros(talhao) > 0 ? `${getMetros(talhao).toLocaleString()} m lin.` : null,
      talhao.espacamento ? talhao.espacamento : null,
    ].filter(Boolean).join('   ');
    setFont('normal', 8, MED);
    doc.text(infos, PW - MR, y + 7.5, { align: 'right' });

    y += 14;

    // ── Blocos de produtos ──────────────────────────────────────────────────────
    for (const bloco of blocos) {
      const { isCalagem, nutriLabel, produtoNome, doseProdHa, totalKg, sc50, gPlanta, gMetro, numAplic, parcelas, observacoes } = bloco;

      // Estimar altura necessária
      const linhasParc = numAplic > 1 ? Math.ceil(numAplic / 4) * 8 + 6 : 0;
      const altBloco = 26 + linhasParc + (observacoes ? 5 : 0);
      checkY(altBloco);

      // Fundo e borda
      if (isCalagem) {
        doc.setFillColor(...BG_CAL);
        doc.setDrawColor(...BDR_CAL);
      } else {
        doc.setFillColor(...BG_FRT);
        doc.setDrawColor(...LINE);
      }
      doc.setLineWidth(0.25);
      doc.rect(ML, y, CW, altBloco, 'FD');

      // Badge nutriente
      const badgeColor = isCalagem ? [100, 150, 60] : ACCENT;
      doc.setFillColor(...badgeColor);
      doc.rect(ML, y, 22, 8.5, 'F');
      setFont('bold', 7.5, [255, 255, 255]);
      doc.text(nutriLabel, ML + 11, y + 5.5, { align: 'center' });

      // Nome do produto
      setFont('bold', 10, DARK);
      doc.text(produtoNome.substring(0, 60), ML + 26, y + 6);

      // Linha de métricas
      const metY = y + 14;
      const cols = [
        { l: 'Dose',         v: `${fmtNum(doseProdHa, 1)} kg/ha` },
        { l: 'Total',        v: fmtTotal(totalKg) },
        sc50   ? { l: 'Sacos 50 kg',  v: `${sc50} sc` }      : null,
        gPlanta ? { l: 'g / pé',       v: `${gPlanta} g` }    : null,
        gMetro  ? { l: 'g / metro',    v: `${gMetro} g` }     : null,
      ].filter(Boolean);

      let mx = ML + 4;
      for (const col of cols) {
        const wLabel = doc.getTextWidth(col.l);
        const wValue = doc.getTextWidth(col.v);
        const colW = Math.max(wLabel, wValue) + 8;

        setFont('normal', 7, LIGHT);
        doc.text(col.l, mx + colW / 2, metY - 3, { align: 'center' });
        setFont('bold', 9, isCalagem ? [50, 100, 30] : ACCENT);
        doc.text(col.v, mx + colW / 2, metY + 2.5, { align: 'center' });

        // Separador vertical sutil entre colunas
        if (mx > ML + 4) {
          doc.setDrawColor(...LINE);
          doc.setLineWidth(0.15);
          doc.line(mx, metY - 5, mx, metY + 4);
        }
        mx += colW;
      }

      // Parcelamento (se > 1 aplicação)
      if (numAplic > 1) {
        const pY = y + 22;
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.15);
        doc.line(ML + 4, pY - 1, ML + CW - 4, pY - 1);

        setFont('bold', 7, MED);
        doc.text('Parcelamento:', ML + 4, pY + 3);

        // Grade de parcelas — 4 por linha
        const PARC_W = 42;
        parcelas.forEach((parc, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const px = ML + 4 + col * (PARC_W + 2);
          const py = pY + 6 + row * 8;

          setFont('bold', 7.5, DARK);
          doc.text(`${i + 1}ª (${parc.pct}%)`, px, py);
          setFont('normal', 7, MED);
          const detalhes = [
            parc.kg != null ? fmtTotal(parc.kg) : null,
            parc.meses ? parc.meses : null,
          ].filter(Boolean).join(' · ');
          doc.text(detalhes, px, py + 4.5);
        });
      }

      // Observações
      if (observacoes) {
        const obsY = y + altBloco - 3.5;
        setFont('italic', 7, LIGHT);
        doc.text(`Obs: ${observacoes.substring(0, 100)}`, ML + 4, obsY);
      }

      y += altBloco + 3;
    }

    y += 6;
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
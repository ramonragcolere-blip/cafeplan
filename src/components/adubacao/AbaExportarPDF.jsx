import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, FileText } from 'lucide-react';
import jsPDF from 'jspdf';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getMetros(talhao) {
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  if (talhao?.num_plantas && linhaM > 0) return talhao.num_plantas * linhaM;
  if (talhao?.area_ha && linhaM > 0) return Math.round((talhao.area_ha * 10000) / linhaM);
  return 0;
}

function getMeses(meses) {
  if (!meses) return '';
  const flat = [];
  meses.forEach(m => {
    if (Array.isArray(m)) flat.push(...m);
    else if (m) flat.push(String(m));
  });
  return flat.filter(Boolean).join(', ');
}

// Dado um registro de BasePlanejamentoAdubacao e o produto encontrado,
// calcula a dose REAL do produto (kg/ha) e demais métricas.
function calcularDoseProduto(plan, produto, talhao) {
  const area       = talhao?.area_ha || 0;
  const numPlantas = talhao?.num_plantas || 0;
  const metros     = getMetros(talhao);

  // dose_rec_manual = dose do NUTRIENTE em kg/ha
  const doseNutriHa = parseFloat(plan.dose_rec_manual) || 0;
  if (!doseNutriHa) return null;

  // Para calagem: dose_rec_manual JÁ é a dose do produto
  if (plan.nutriente_key === 'calagem') {
    const totalKg = area > 0 ? Math.round(doseNutriHa * area) : null;
    return {
      doseProdHa : doseNutriHa,
      totalKg,
      gPlanta    : totalKg && numPlantas > 0 ? ((totalKg * 1000) / numPlantas).toFixed(1) : null,
      gMetro     : totalKg && metros > 0     ? ((totalKg * 1000) / metros).toFixed(1)     : null,
    };
  }

  // Para NPK/B: precisa da % do nutriente no produto para converter
  if (!produto) return { doseProdHa: doseNutriHa, totalKg: area > 0 ? Math.round(doseNutriHa * area) : null, gPlanta: null, gMetro: null };

  const pctNut = parseFloat(produto[plan.nutriente_key]) || 0;
  // Se o produto não tem o nutriente cadastrado, usa a dose direta (evita divisão por zero)
  const doseProdHa = pctNut > 0
    ? Math.round((doseNutriHa / (pctNut / 100)) * 10) / 10
    : doseNutriHa;

  const totalKg = area > 0 ? Math.round(doseProdHa * area) : null;
  return {
    doseProdHa,
    totalKg,
    gPlanta: totalKg && numPlantas > 0 ? ((totalKg * 1000) / numPlantas).toFixed(1) : null,
    gMetro : totalKg && metros > 0     ? ((totalKg * 1000) / metros).toFixed(1)     : null,
  };
}

// Filtra planejamentos que realmente têm produto e dose
function filtrarLinhasValidas(plans) {
  return plans.filter(p => {
    const nomeProd = (p.produto_nome || '').trim().toLowerCase();
    const semProduto = !p.produto_id
      || nomeProd === 'nenhum produto'
      || nomeProd === 'não utilizar'
      || nomeProd === '';
    if (semProduto) return false;
    const dose = parseFloat(p.dose_rec_manual) || 0;
    if (dose <= 0) return false;
    return true;
  });
}

// ── Geração do PDF ─────────────────────────────────────────────────────────────

function gerarPDFProfissional(produtor, safra, talhoesProdutor, planejamentos, todosProdutos) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210;
  const PH = 297;
  const ML = 14, MR = 14;
  const CW = PW - ML - MR;
  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  let y = 0;
  let pagina = 1;

  // ── Cores ──
  const COR_VERDE_ESCURO = [30, 80, 40];
  const COR_VERDE_MEDIO  = [60, 130, 70];
  const COR_VERDE_CLARO  = [220, 240, 222];
  const COR_LIME_BG      = [240, 255, 240];
  const COR_CALAGEM_BG   = [245, 255, 245];
  const COR_ROW_IMPAR    = [248, 252, 248];
  const COR_CINZA_LINHA  = [200, 210, 200];

  const setRGB = (r, g, b) => doc.setTextColor(r, g, b);
  const setFill = ([r, g, b]) => doc.setFillColor(r, g, b);
  const setDraw = ([r, g, b]) => doc.setDrawColor(r, g, b);

  const rodape = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setRGB(130, 130, 130);
    doc.text(`Página ${pagina}  ·  Emitido em ${dataEmissao}  ·  ${produtor.nome} — Safra ${safra}`, ML, PH - 8);
    doc.setDrawColor(200); doc.line(ML, PH - 11, PW - MR, PH - 11);
    setRGB(0, 0, 0);
  };

  const addPage = () => {
    doc.addPage();
    pagina++;
    y = 14;
    rodape();
  };

  const checkY = (needed = 10) => {
    if (y + needed > PH - 18) addPage();
  };

  // ── CAPA / CABEÇALHO PRINCIPAL ─────────────────────────────────────────────
  // Faixa verde topo
  setFill(COR_VERDE_ESCURO);
  doc.rect(0, 0, PW, 36, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setRGB(255, 255, 255);
  doc.text('Planejamento de Adubação', ML, 15);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('do Cafeeiro', ML, 23);

  // Dados do produtor no cabeçalho
  doc.setFontSize(9);
  const col2x = PW / 2 + 5;
  doc.text(`Produtor:`, col2x, 10);
  doc.setFont('helvetica', 'bold');
  doc.text(produtor.nome, col2x + 22, 10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fazenda:`, col2x, 16);
  doc.setFont('helvetica', 'bold');
  doc.text(produtor.fazenda || '—', col2x + 22, 16);
  doc.setFont('helvetica', 'normal');
  doc.text(`Safra:`, col2x, 22);
  doc.setFont('helvetica', 'bold');
  doc.text(safra, col2x + 22, 22);
  doc.setFont('helvetica', 'normal');
  if (produtor.eng_responsavel) {
    doc.text(`Eng.:`, col2x, 28);
    doc.setFont('helvetica', 'bold');
    doc.text(produtor.eng_responsavel, col2x + 22, 28);
    doc.setFont('helvetica', 'normal');
  }
  doc.text(`Emissão: ${dataEmissao}`, col2x, 34);

  setRGB(0, 0, 0);
  y = 44;
  rodape();

  // ── ITERAR POR TALHÃO ──────────────────────────────────────────────────────
  for (const talhao of talhoesProdutor) {
    const metros    = getMetros(talhao);
    const area      = talhao.area_ha || 0;
    const numPlantas = talhao.num_plantas || 0;

    const plansTalhao = filtrarLinhasValidas(
      planejamentos
        .filter(p => p.talhao_id === talhao.id)
        .sort((a, b) => {
          if (a.nutriente_key === 'calagem') return 1;
          if (b.nutriente_key === 'calagem') return -1;
          return 0;
        })
    );

    if (plansTalhao.length === 0) continue; // Pula talhões sem planejamento válido

    // Espaço necessário para o bloco do talhão
    checkY(22 + plansTalhao.length * 26);

    // ── Cabeçalho do talhão ──
    setFill(COR_VERDE_MEDIO);
    doc.rect(ML, y, CW, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setRGB(255, 255, 255);
    doc.text(`Talhão: ${talhao.nome}`, ML + 3, y + 6.5);

    // Dados do talhão (área, plantas, metros) à direita
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const infos = [
      area      ? `Área: ${area} ha`                   : '',
      numPlantas ? `Plantas: ${numPlantas.toLocaleString()}` : '',
      metros    ? `Metros lineares: ${metros.toLocaleString()}` : '',
      talhao.espacamento ? `Espaçamento: ${talhao.espacamento}` : '',
    ].filter(Boolean).join('   ');
    doc.text(infos, ML + 3, y + 15);
    y += 18;

    // ── Itens do planejamento ──
    plansTalhao.forEach((plan, idx) => {
      const produto = todosProdutos.find(p => p.id === plan.produto_id) || null;
      const doses   = calcularDoseProduto(plan, produto, talhao);
      const isCalagem = plan.nutriente_key === 'calagem';
      const meses     = getMeses(plan.meses);
      const numAplic  = plan.num_aplic || 1;
      const pcts      = (plan.pcts || [100]).map(p => `${p}%`).join(' + ');

      checkY(28);

      // Fundo alternado / especial calagem
      if (isCalagem) {
        setFill(COR_CALAGEM_BG);
      } else {
        setFill(idx % 2 === 0 ? [255, 255, 255] : COR_ROW_IMPAR);
      }
      doc.rect(ML, y, CW, 24, 'F');

      // Borda esquerda colorida por tipo
      if (isCalagem) {
        doc.setFillColor(100, 180, 80);
      } else {
        doc.setFillColor(...COR_VERDE_MEDIO);
      }
      doc.rect(ML, y, 2.5, 24, 'F');

      // Borda da caixa
      setDraw(COR_CINZA_LINHA);
      doc.setLineWidth(0.2);
      doc.rect(ML, y, CW, 24, 'S');

      // ── Linha 1: Nutriente + Produto ──
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setRGB(...COR_VERDE_ESCURO);

      const nutriLabel = plan.nutriente_label || plan.nutriente_key || '—';
      const nomeProd   = plan.produto_nome || '—';
      doc.text(`${nutriLabel}`, ML + 5, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setRGB(30, 30, 30);
      doc.text(`Produto: `, ML + 22, y + 6);
      doc.setFont('helvetica', 'bold');
      const maxNomeProd = 55;
      doc.text(nomeProd.length > maxNomeProd ? nomeProd.substring(0, maxNomeProd) + '…' : nomeProd, ML + 36, y + 6);

      // Fornecedor (se disponível)
      if (produto?.fornecedor) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        setRGB(100, 100, 100);
        doc.text(produto.fornecedor.substring(0, 40), ML + 36, y + 11);
      }

      // ── Linha 2: Métricas principais ──
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      setRGB(40, 40, 40);

      const metricas = [
        doses?.doseProdHa  != null ? `Dose: ${doses.doseProdHa} kg/ha`    : null,
        doses?.totalKg     != null ? `Total: ${doses.totalKg.toLocaleString()} kg` : null,
        doses?.gPlanta     != null ? `g/planta: ${doses.gPlanta} g`        : null,
        doses?.gMetro      != null ? `g/metro: ${doses.gMetro} g`          : null,
      ].filter(Boolean);

      // Desenhar métricas em caixinhas
      let mx = ML + 5;
      const my = y + 16;
      metricas.forEach(m => {
        const tw = doc.getTextWidth(m) + 6;
        setFill(COR_VERDE_CLARO);
        doc.rect(mx, my - 4, tw, 5.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        setRGB(...COR_VERDE_ESCURO);
        doc.text(m, mx + 3, my);
        mx += tw + 3;
      });

      // Aplicações + Meses à direita
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setRGB(60, 60, 60);
      const aplicInfo = `${numAplic}x  ${pcts}`;
      const aplicX = PW - MR - doc.getTextWidth(aplicInfo) - 4;
      doc.text(aplicInfo, aplicX, y + 6);

      if (meses) {
        doc.setFontSize(7.5);
        const mesesLabel = `Meses: ${meses}`;
        const mesesX = PW - MR - doc.getTextWidth(mesesLabel) - 4;
        doc.text(mesesLabel, mesesX, y + 11);
      }

      // Observações (se existir)
      if (plan.observacoes) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        setRGB(100, 100, 100);
        const obsText = `Obs: ${plan.observacoes}`;
        doc.text(obsText.substring(0, 90), ML + 5, y + 22);
      }

      setRGB(0, 0, 0);
      y += 26;
    });

    // Espaço entre talhões
    y += 6;
  }

  doc.save(`Adubacao_${produtor.codigo}_Safra${safra.replace('/', '-')}.pdf`);
}

// ── Componente principal ───────────────────────────────────────────────────────

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
  const { data: fontesSimples = [] }  = useQuery({ queryKey: ['fontes_simples'],  queryFn: () => base44.entities.FonteSimples.list() });

  const todosProdutos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f })),
    ...fontesSimples.map(f => ({ ...f })),
  ], [fertilizantes, fontesSimples]);

  const talhoesProdutor = useMemo(() =>
    talhoes.filter(t => t.codigo_produtor === codigoProdutor),
    [talhoes, codigoProdutor]);

  const linhasValidas = useMemo(() => filtrarLinhasValidas(planejamentos), [planejamentos]);

  const handleGerar = async () => {
    if (!produtor || !safra) return;
    setGerando(true);
    try {
      gerarPDFProfissional(produtor, safra, talhoesProdutor, planejamentos, todosProdutos);
    } finally {
      setGerando(false);
    }
  };

  if (!produtor || !safra) return (
    <div className="text-center py-12 text-muted-foreground">
      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p>Selecione produtor e safra para exportar.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <FileDown className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-base">Exportar Planejamento de Adubação</h3>
        </div>

        {/* Resumo */}
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

        {/* Contagem de itens */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando planejamentos...
          </p>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-1">
            <p className="font-semibold text-green-800">Itens encontrados na base</p>
            <p className="text-muted-foreground">Total registros: <strong>{planejamentos.length}</strong></p>
            <p className="text-muted-foreground">Itens válidos para exportar (com produto e dose): <strong className="text-green-700">{linhasValidas.length}</strong></p>
            {linhasValidas.length === 0 && (
              <p className="text-amber-700 font-medium mt-1">⚠ Nenhum item com produto e dose encontrado. Salve o planejamento primeiro.</p>
            )}
          </div>
        )}

        <Button
          onClick={handleGerar}
          disabled={gerando || isLoading || linhasValidas.length === 0}
          className="gap-2 h-10"
        >
          {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Gerar PDF — Todos os Talhões
        </Button>

        <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Conteúdo do PDF (formato retrato A4):</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Cabeçalho: Produtor, Fazenda, Safra, Engenheiro, Data</li>
            <li>Por talhão: área, nº plantas, metros lineares, espaçamento</li>
            <li>Por produto/nutriente: Dose kg/ha, Total kg, g/planta, g/metro, Nº aplicações, Parcelamento, Meses, Observações</li>
            <li>Calagem incluída quando enviada ao Planejamento</li>
            <li>Exporta apenas itens com produto e dose definidos</li>
          </ul>
        </div>
      </div>
    </div>
  );
}